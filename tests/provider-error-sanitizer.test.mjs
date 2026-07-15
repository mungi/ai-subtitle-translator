import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeProviderErrorMessage } from "../extension/shared/provider-error-sanitizer.js";

test("provider error messages redact configured and URL-encoded API keys", () => {
  const apiKey = "test key+/=";
  const message = [
    `HTTP 401: invalid key ${apiKey}`,
    `encoded=${encodeURIComponent(apiKey)}`,
    "Authorization: Bearer echoed-server-token",
    "https://llm.example.test/v1?access_token=endpoint-token&model=test"
  ].join("; ");

  assert.equal(
    sanitizeProviderErrorMessage(message, { apiKey }),
    "HTTP 401: invalid key [redacted]; encoded=[redacted]; Authorization: Bearer [redacted]; https://llm.example.test/v1?access_token=[redacted]&model=test"
  );
});
