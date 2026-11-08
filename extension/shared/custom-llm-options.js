// Options only the Custom LLM provider has: a fixed reasoning effort, a JSON response mode for
// translation requests, and up to three extra HTTP headers sent with every request to the server.

export const CUSTOM_LLM_PROVIDER_ID = "local";
// "auto" probes from "low" and steps down to "none" on an error at the connection test; "omit" leaves reasoning_effort out.
export const CUSTOM_LLM_REASONING_OPTIONS = ["auto", "none", "minimal", "low", "medium", "high", "omit"];
// "json_object" asks for any JSON object; "json_schema" also gives the exact translation shape.
export const CUSTOM_LLM_JSON_MODES = ["off", "json_object", "json_schema"];
export const MAX_CUSTOM_HEADERS = 3;
// The vault record that keeps header values encrypted next to the API key.
export const CUSTOM_HEADER_SECRET_SUFFIX = ":headers";

// RFC 9110 token characters. Content-Type stays the extension's, and browsers refuse to let a page
// set the forbidden request headers, so those names are skipped rather than silently dropped later.
const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const RESERVED_HEADER_NAMES = new Set([
  "content-type", "content-length", "host", "origin", "referer", "cookie", "cookie2", "connection",
  "keep-alive", "transfer-encoding", "te", "trailer", "upgrade", "via", "expect", "date", "dnt",
  "accept-charset", "accept-encoding", "access-control-request-headers", "access-control-request-method"
]);

export function normalizeReasoningEffort(value) {
  return CUSTOM_LLM_REASONING_OPTIONS.includes(value) ? value : "auto";
}

export function normalizeJsonMode(value) {
  return CUSTOM_LLM_JSON_MODES.includes(value) ? value : "off";
}

export function normalizeCustomHeaders(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_CUSTOM_HEADERS).map((header) => ({
    name: String(header?.name ?? "").trim(),
    value: String(header?.value ?? "").replace(/[\r\n]+/g, " ").trim()
  }));
}

export function isUsableHeaderName(name) {
  const text = String(name || "");
  return HEADER_NAME_PATTERN.test(text)
    && !RESERVED_HEADER_NAMES.has(text.toLowerCase())
    && !/^(?:proxy-|sec-)/i.test(text);
}

// Headers to add to a request; only for the Custom LLM, only rows with a usable name and a value.
export function buildCustomHeaders(provider) {
  if (provider?.id !== CUSTOM_LLM_PROVIDER_ID) return {};
  const headers = {};
  for (const header of normalizeCustomHeaders(provider.customHeaders)) {
    if (header.value && isUsableHeaderName(header.name)) headers[header.name] = header.value;
  }
  return headers;
}
