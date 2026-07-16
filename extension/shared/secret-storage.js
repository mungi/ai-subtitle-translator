// This was rotated once during pre-release development for the CST -> AST reset.
// Keep this key stable after release. Future format changes must increment
// VAULT_VERSION and add a step to VAULT_MIGRATIONS instead of resetting users.
const SECRET_VAULT_STORAGE_KEY = "runtimeIndexV3";
const KEY_FRAGMENT_STORAGE_KEYS = [
  "renderProfileRevision",
  "modelCatalogRevision",
  "fontCacheRevision"
];
const VAULT_VERSION = 1;
const VAULT_MIGRATIONS = Object.freeze({
  // Example for a future format change:
  // 1: async (vault) => ({ ...vault, version: 2 })
});
const SEED_LENGTH = 32;
const KEY_CONTEXT = "ast/runtime-provider-state/v1";
const SHARE_MULTIPLIERS = [5, 7, 11];
const SHARE_SHIFTS = [3, 9, 17];
let vaultWriteQueue = Promise.resolve();

function getCrypto() {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle || typeof cryptoApi.getRandomValues !== "function") {
    throw new Error("Web Crypto API is unavailable.");
  }
  return cryptoApi;
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(normalized + padding);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function getShareMask(shareIndex, position) {
  return (0xa7 + shareIndex * 53 + position * 29) & 0xff;
}

function encodeKeyShare(share, shareIndex) {
  const output = new Uint8Array(share.length);
  const multiplier = SHARE_MULTIPLIERS[shareIndex];
  const shift = SHARE_SHIFTS[shareIndex];
  for (let position = 0; position < share.length; position += 1) {
    const sourceIndex = (position * multiplier + shift) % share.length;
    output[position] = share[sourceIndex] ^ getShareMask(shareIndex, position);
  }
  return bytesToBase64Url(output);
}

function decodeKeyShare(value, shareIndex) {
  const encoded = base64UrlToBytes(value);
  if (encoded.length !== SEED_LENGTH) {
    throw new Error("Stored provider state is invalid.");
  }
  const share = new Uint8Array(encoded.length);
  const multiplier = SHARE_MULTIPLIERS[shareIndex];
  const shift = SHARE_SHIFTS[shareIndex];
  for (let position = 0; position < encoded.length; position += 1) {
    const sourceIndex = (position * multiplier + shift) % encoded.length;
    share[sourceIndex] = encoded[position] ^ getShareMask(shareIndex, position);
  }
  return share;
}

function splitSeed(seed) {
  const cryptoApi = getCrypto();
  const first = cryptoApi.getRandomValues(new Uint8Array(seed.length));
  const second = cryptoApi.getRandomValues(new Uint8Array(seed.length));
  const third = new Uint8Array(seed.length);
  for (let index = 0; index < seed.length; index += 1) {
    third[index] = seed[index] ^ first[index] ^ second[index];
  }
  return [first, second, third];
}

function joinSeed(shares) {
  const seed = new Uint8Array(SEED_LENGTH);
  for (let index = 0; index < seed.length; index += 1) {
    seed[index] = shares[0][index] ^ shares[1][index] ^ shares[2][index];
  }
  return seed;
}

async function deriveVaultKey(seed) {
  const cryptoApi = getCrypto();
  const encoder = new TextEncoder();
  const runtimeId = globalThis.chrome?.runtime?.id || "development-runtime";
  const context = encoder.encode(`${KEY_CONTEXT}:${runtimeId}`);
  const material = new Uint8Array(seed.length + context.length);
  material.set(seed);
  material.set(context, seed.length);
  const digest = await cryptoApi.subtle.digest("SHA-256", material);
  return cryptoApi.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function loadVaultKey({ create = false } = {}) {
  const stored = await chrome.storage.local.get(KEY_FRAGMENT_STORAGE_KEYS);
  const values = KEY_FRAGMENT_STORAGE_KEYS.map((key) => stored[key]);
  const existingCount = values.filter((value) => typeof value === "string" && value).length;

  let seed;
  if (existingCount === 0 && create) {
    seed = getCrypto().getRandomValues(new Uint8Array(SEED_LENGTH));
    const shares = splitSeed(seed);
    await chrome.storage.local.set(Object.fromEntries(KEY_FRAGMENT_STORAGE_KEYS.map((key, index) => [
      key,
      encodeKeyShare(shares[index], index)
    ])));
  } else if (existingCount === KEY_FRAGMENT_STORAGE_KEYS.length) {
    seed = joinSeed(values.map(decodeKeyShare));
  } else if (existingCount === 0) {
    return null;
  } else {
    throw new Error("Stored provider state is incomplete.");
  }

  return deriveVaultKey(seed);
}

function getAdditionalData(providerId) {
  return new TextEncoder().encode(`provider-secret:${VAULT_VERSION}:${providerId}`);
}

async function encryptSecret(key, providerId, secret) {
  const cryptoApi = getCrypto();
  const nonce = cryptoApi.getRandomValues(new Uint8Array(12));
  const ciphertext = await cryptoApi.subtle.encrypt({
    name: "AES-GCM",
    iv: nonce,
    additionalData: getAdditionalData(providerId)
  }, key, new TextEncoder().encode(secret));
  return {
    n: bytesToBase64Url(nonce),
    c: bytesToBase64Url(new Uint8Array(ciphertext))
  };
}

async function decryptSecret(key, providerId, record) {
  const plaintext = await getCrypto().subtle.decrypt({
    name: "AES-GCM",
    iv: base64UrlToBytes(record?.n),
    additionalData: getAdditionalData(providerId)
  }, key, base64UrlToBytes(record?.c));
  return new TextDecoder().decode(plaintext);
}

async function migrateVaultToCurrentVersion(vault) {
  if (!Number.isInteger(vault?.version) || vault.version < 1 || vault.version > VAULT_VERSION) {
    throw new Error("Stored provider vault format is unsupported.");
  }

  let migrated = vault;
  while (migrated.version < VAULT_VERSION) {
    const migrate = VAULT_MIGRATIONS[migrated.version];
    if (typeof migrate !== "function") {
      throw new Error(`Provider vault migration from version ${migrated.version} is unavailable.`);
    }
    const previousVersion = migrated.version;
    migrated = await migrate(migrated);
    if (migrated?.version !== previousVersion + 1) {
      throw new Error("Provider vault migration produced an invalid version.");
    }
  }

  if (migrated !== vault) {
    await chrome.storage.local.set({ [SECRET_VAULT_STORAGE_KEY]: migrated });
  }
  return migrated;
}

export async function readEncryptedProviderSecrets() {
  const stored = await chrome.storage.local.get(SECRET_VAULT_STORAGE_KEY);
  const storedVault = stored[SECRET_VAULT_STORAGE_KEY];
  if (!storedVault) return {};
  const vault = await migrateVaultToCurrentVersion(storedVault);
  if (!vault.records || typeof vault.records !== "object") {
    throw new Error("Stored provider vault format is unsupported.");
  }

  const key = await loadVaultKey();
  if (!key) throw new Error("Stored provider vault key is missing.");

  const secrets = {};
  for (const [providerId, record] of Object.entries(vault.records)) {
    try {
      secrets[providerId] = await decryptSecret(key, providerId, record);
    } catch {
      throw new Error("Stored provider secrets could not be decrypted.");
    }
  }
  return secrets;
}

function enqueueVaultWrite(operation) {
  vaultWriteQueue = vaultWriteQueue.catch(() => {}).then(operation);
  return vaultWriteQueue;
}

export function writeEncryptedProviderSecrets(secrets = {}) {
  return enqueueVaultWrite(async () => {
    const entries = Object.entries(secrets)
      .filter(([, secret]) => typeof secret === "string" && secret.length > 0);
    if (entries.length === 0) {
      await chrome.storage.local.remove([SECRET_VAULT_STORAGE_KEY, ...KEY_FRAGMENT_STORAGE_KEYS]);
      return;
    }

    const key = await loadVaultKey({ create: true });
    const records = {};
    for (const [providerId, secret] of entries) {
      records[providerId] = await encryptSecret(key, providerId, secret);
    }
    await chrome.storage.local.set({
      [SECRET_VAULT_STORAGE_KEY]: {
        version: VAULT_VERSION,
        records
      }
    });
  });
}

export function clearEncryptedProviderSecrets() {
  return enqueueVaultWrite(() => chrome.storage.local.remove([
    SECRET_VAULT_STORAGE_KEY,
    ...KEY_FRAGMENT_STORAGE_KEYS
  ]));
}

export const secretStorageInternals = {
  SECRET_VAULT_STORAGE_KEY,
  VAULT_VERSION,
  KEY_FRAGMENT_STORAGE_KEYS,
  encodeKeyShare,
  decodeKeyShare,
  splitSeed,
  joinSeed
};
