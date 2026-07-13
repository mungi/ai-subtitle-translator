const BACKUP_FORMAT = "ai-subtitle-translator-settings-backup";
const BACKUP_VERSION = 1;
const PBKDF2_ITERATIONS = 250000;
const MAX_BACKUP_FILE_BYTES = 5 * 1024 * 1024;

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

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function createBackupError(code, message) {
  return Object.assign(new Error(message), { code });
}

export function validateBackupSeed(seed) {
  const value = String(seed || "");
  if (value.length < 10) return { ok: false, error: "minLength" };
  if (!/[A-Za-z]/.test(value)) return { ok: false, error: "letter" };
  if (!/[0-9]/.test(value)) return { ok: false, error: "number" };
  if (!/[!-/:-@[-`{-~]/.test(value)) return { ok: false, error: "special" };
  if (/^ | $|[^\S ]/.test(value)) return { ok: false, error: "whitespace" };
  return { ok: true };
}

function validateSettingsPayload(settings) {
  if (!isPlainObject(settings)) throw createBackupError("invalidSettings", "Backup settings payload is invalid.");
  if (!isPlainObject(settings.providers)
    || Object.values(settings.providers).some((provider) => !isPlainObject(provider))) {
    throw createBackupError("invalidSettings", "Backup provider settings are invalid.");
  }
  if (!isPlainObject(settings.platforms)) throw createBackupError("invalidSettings", "Backup platform settings are invalid.");
  if (!isPlainObject(settings.subtitleStyle)) throw createBackupError("invalidSettings", "Backup subtitle style is invalid.");
  return settings;
}

function getAdditionalData() {
  return new TextEncoder().encode(`${BACKUP_FORMAT}:${BACKUP_VERSION}`);
}

async function deriveBackupKey(seed, salt, usages) {
  const cryptoApi = getCrypto();
  const keyMaterial = await cryptoApi.subtle.importKey(
    "raw",
    new TextEncoder().encode(seed),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return cryptoApi.subtle.deriveKey({
    name: "PBKDF2",
    salt,
    iterations: PBKDF2_ITERATIONS,
    hash: "SHA-256"
  }, keyMaterial, { name: "AES-GCM", length: 256 }, false, usages);
}

export async function createEncryptedSettingsBackup(settings, seed) {
  if (!validateBackupSeed(seed).ok) throw createBackupError("invalidSeed", "Backup seed does not meet the requirements.");
  validateSettingsPayload(settings);

  const cryptoApi = getCrypto();
  const salt = cryptoApi.getRandomValues(new Uint8Array(16));
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const key = await deriveBackupKey(seed, salt, ["encrypt"]);
  const plaintext = new TextEncoder().encode(JSON.stringify({ settings }));
  const ciphertext = await cryptoApi.subtle.encrypt({
    name: "AES-GCM",
    iv,
    additionalData: getAdditionalData()
  }, key, plaintext);

  return JSON.stringify({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    kdf: {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: PBKDF2_ITERATIONS,
      salt: bytesToBase64Url(salt)
    },
    cipher: {
      name: "AES-GCM",
      iv: bytesToBase64Url(iv)
    },
    payload: bytesToBase64Url(new Uint8Array(ciphertext))
  }, null, 2);
}

export async function decryptSettingsBackup(backupText, seed) {
  if (!validateBackupSeed(seed).ok) throw createBackupError("invalidSeed", "Backup seed does not meet the requirements.");
  if (new TextEncoder().encode(String(backupText || "")).byteLength > MAX_BACKUP_FILE_BYTES) {
    throw createBackupError("fileTooLarge", "Backup file is too large.");
  }

  let backup;
  try {
    backup = JSON.parse(String(backupText || ""));
  } catch {
    throw createBackupError("invalidJson", "Backup file is not valid JSON.");
  }
  if (!isPlainObject(backup)
    || backup.format !== BACKUP_FORMAT
    || backup.version !== BACKUP_VERSION
    || backup.kdf?.name !== "PBKDF2"
    || backup.kdf?.hash !== "SHA-256"
    || backup.kdf?.iterations !== PBKDF2_ITERATIONS
    || backup.cipher?.name !== "AES-GCM"
    || typeof backup.kdf?.salt !== "string"
    || typeof backup.cipher?.iv !== "string"
    || typeof backup.payload !== "string") {
    throw createBackupError("unsupportedFormat", "Backup file format is unsupported.");
  }

  try {
    const salt = base64UrlToBytes(backup.kdf.salt);
    const iv = base64UrlToBytes(backup.cipher.iv);
    if (salt.length !== 16 || iv.length !== 12) throw new Error("invalid parameters");
    const key = await deriveBackupKey(seed, salt, ["decrypt"]);
    const plaintext = await getCrypto().subtle.decrypt({
      name: "AES-GCM",
      iv,
      additionalData: getAdditionalData()
    }, key, base64UrlToBytes(backup.payload));
    const payload = JSON.parse(new TextDecoder().decode(plaintext));
    return validateSettingsPayload(payload?.settings);
  } catch (error) {
    if (error?.code === "invalidSettings") throw error;
    throw createBackupError("decryptFailed", "Backup seed is incorrect or the backup file is damaged.");
  }
}

export const settingsBackupInternals = {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  PBKDF2_ITERATIONS,
  MAX_BACKUP_FILE_BYTES
};
