const SHORT_SECRET_MASK_CHAR = "*";
const SECRET_MASK_SEPARATOR = "•••••";
const VISIBLE_SECRET_PREFIX_LENGTH = 6;
const VISIBLE_SECRET_SUFFIX_LENGTH = 4;

export function maskSecretValue(value) {
  const secret = String(value ?? "").trim();
  if (!secret) return "";
  if (secret.length <= VISIBLE_SECRET_PREFIX_LENGTH + VISIBLE_SECRET_SUFFIX_LENGTH) {
    return SHORT_SECRET_MASK_CHAR.repeat(secret.length);
  }

  return [
    secret.slice(0, VISIBLE_SECRET_PREFIX_LENGTH),
    SECRET_MASK_SEPARATOR,
    secret.slice(-VISIBLE_SECRET_SUFFIX_LENGTH)
  ].join("");
}

export function resolveSecretFieldValue(inputValue, storedValue) {
  const value = String(inputValue ?? "").trim();
  const storedSecret = String(storedValue ?? "").trim();
  if (storedSecret && value === maskSecretValue(storedSecret)) {
    return storedSecret;
  }
  return value;
}
