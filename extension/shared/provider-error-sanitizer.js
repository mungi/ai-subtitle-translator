const SECRET_QUERY_PARAMETER = /([?&](?:api[_-]?key|apikey|key|access[_-]?token|token|authorization|secret|client[_-]?secret|password)=)([^&#\s]*)/gi;
const SECRET_FIELD = /(\b(?:authorization|x-api-key|api[_-]?key|apikey|access[_-]?token|token|client[_-]?secret|password|secret)\b["']?\s*[:=]\s*["']?(?:bearer\s+)?)([^"'\s,;}&]+)/gi;
const URL_CREDENTIALS = /(https?:\/\/)([^/\s:@]+):([^@/\s]+)@/gi;

function redactConfiguredSecret(message, apiKey) {
  const secret = String(apiKey || "").trim();
  if (!secret) return message;

  let safeMessage = message.split(secret).join("[redacted]");
  const encodedSecret = encodeURIComponent(secret);
  if (encodedSecret !== secret) {
    safeMessage = safeMessage.split(encodedSecret).join("[redacted]");
  }
  return safeMessage;
}

export function sanitizeProviderErrorMessage(message, provider = {}) {
  const safeMessage = redactConfiguredSecret(
    String(message || "Connection test failed."),
    provider.apiKey
  );

  return safeMessage
    .replace(SECRET_QUERY_PARAMETER, "$1[redacted]")
    .replace(SECRET_FIELD, "$1[redacted]")
    .replace(URL_CREDENTIALS, "$1[redacted]@");
}
