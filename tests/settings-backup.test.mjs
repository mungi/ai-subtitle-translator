import assert from "node:assert/strict";
import test from "node:test";
import {
  createEncryptedSettingsBackup,
  decryptSettingsBackup,
  settingsBackupInternals,
  validateBackupSeed
} from "../extension/shared/settings-backup.js";

const settings = {
  activeProvider: "openai",
  targetLanguage: "ko",
  platforms: { youtube: true, udemy: true },
  subtitleStyle: { fontSize: 30 },
  providers: {
    openai: { apiKey: "sk-backup-plain-secret", model: "gpt-test" }
  }
};

test("backup seed requires letters, numbers, special characters, and at least 10 characters", () => {
  assert.deepEqual(validateBackupSeed("Abcdef1!xy"), { ok: true });
  assert.deepEqual(validateBackupSeed("Ab1!short"), { ok: false, error: "minLength" });
  assert.deepEqual(validateBackupSeed("123456789!"), { ok: false, error: "letter" });
  assert.deepEqual(validateBackupSeed("abcdefghij!"), { ok: false, error: "number" });
  assert.deepEqual(validateBackupSeed("abcdefgh12"), { ok: false, error: "special" });
  assert.deepEqual(validateBackupSeed("abcdefgh1한"), { ok: false, error: "special" });
  assert.deepEqual(validateBackupSeed("My Backup 2026!"), { ok: true });
  assert.deepEqual(validateBackupSeed(" Abcdef1!xy"), { ok: false, error: "whitespace" });
  assert.deepEqual(validateBackupSeed("Abcdef1!xy "), { ok: false, error: "whitespace" });
  assert.deepEqual(validateBackupSeed("Abcdef1!\txy"), { ok: false, error: "whitespace" });
  assert.deepEqual(validateBackupSeed("Abcdef1!\nxy"), { ok: false, error: "whitespace" });
  assert.deepEqual(validateBackupSeed("Abcdef1!\u00a0xy"), { ok: false, error: "whitespace" });
});

test("settings backup encrypts API keys and decrypts with the same seed", async () => {
  const backup = await createEncryptedSettingsBackup(settings, "My Backup 2026!");

  assert.doesNotMatch(backup, /sk-backup-plain-secret/);
  assert.doesNotMatch(backup, /My Backup 2026!/);
  assert.deepEqual(await decryptSettingsBackup(backup, "My Backup 2026!"), settings);
  const envelope = JSON.parse(backup);
  assert.equal(envelope.format, settingsBackupInternals.BACKUP_FORMAT);
  assert.equal(envelope.kdf.iterations, settingsBackupInternals.PBKDF2_ITERATIONS);
});

test("settings backups use random salt and nonce", async () => {
  const first = JSON.parse(await createEncryptedSettingsBackup(settings, "BackupSeed1!"));
  const second = JSON.parse(await createEncryptedSettingsBackup(settings, "BackupSeed1!"));

  assert.notEqual(first.kdf.salt, second.kdf.salt);
  assert.notEqual(first.cipher.iv, second.cipher.iv);
  assert.notEqual(first.payload, second.payload);
});

test("settings restore rejects an incorrect seed and damaged files", async () => {
  const backup = await createEncryptedSettingsBackup(settings, "BackupSeed1!");

  await assert.rejects(
    () => decryptSettingsBackup(backup, "WrongSeed2@"),
    /incorrect or the backup file is damaged/
  );
  await assert.rejects(
    () => decryptSettingsBackup("not-json", "BackupSeed1!"),
    /not valid JSON/
  );
  await assert.rejects(
    () => decryptSettingsBackup("x".repeat(settingsBackupInternals.MAX_BACKUP_FILE_BYTES + 1), "BackupSeed1!"),
    /too large/
  );
});
