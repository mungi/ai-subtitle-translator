import assert from "node:assert/strict";
import test from "node:test";
import { maskSecretValue, resolveSecretFieldValue } from "../extension/shared/secret-fields.js";

test("saved API keys are displayed with only the first 6 and last 4 characters visible", () => {
  assert.equal(maskSecretValue("sk-test-abcdefghijklmnopqrstuvwxyz1234"), "sk-tes•••••1234");
});

test("short saved API keys are fully masked instead of being revealed", () => {
  assert.equal(maskSecretValue("short-key"), "*********");
});

test("unchanged masked API key fields preserve the stored secret when saved", () => {
  const storedSecret = "sk-test-abcdefghijklmnopqrstuvwxyz1234";
  const displayedSecret = maskSecretValue(storedSecret);

  assert.equal(resolveSecretFieldValue(displayedSecret, storedSecret), storedSecret);
});

test("edited API key fields replace the stored secret when saved", () => {
  assert.equal(
    resolveSecretFieldValue("sk-new-abcdefghijklmnopqrstuvwxyz5678", "sk-old-abcdefghijklmnopqrstuvwxyz1234"),
    "sk-new-abcdefghijklmnopqrstuvwxyz5678"
  );
  assert.equal(resolveSecretFieldValue("", "sk-old-abcdefghijklmnopqrstuvwxyz1234"), "");
});
