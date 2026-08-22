import assert from "node:assert/strict";
import test from "node:test";
import { createStorageSettingsSnapshot, StaticStorageSettings, StorageSettingsError, storageSettingsContract } from "./application/storage-settings.js";

test("storage settings describe the default in-memory backend without side effects", () => {
  const settings = new StaticStorageSettings(createStorageSettingsSnapshot({ storageKind: "memory", hasProfileLock: false }));
  assert.deepEqual(settings.get(), {
    version: 1,
    backend: "memory",
    location: "ephemeral_memory",
    lockState: "not_applicable",
    backupState: "not_configured",
    retentionState: "not_configured",
    quotaState: "not_measured",
  });
  assert.equal(storageSettingsContract.mutatesFilesystem, false);
  assert.equal(storageSettingsContract.startsBackup, false);
  assert.equal(storageSettingsContract.startsRestore, false);
  assert.equal(storageSettingsContract.deletesData, false);
});

test("storage settings describe sqlite profile metadata without exposing paths", () => {
  const settings = new StaticStorageSettings(createStorageSettingsSnapshot({ storageKind: "sqlite", profileId: "default", hasProfileLock: true }));
  assert.deepEqual(settings.get(), {
    version: 1,
    backend: "sqlite",
    location: "profile_directory",
    profileId: "default",
    databaseFile: "studio.sqlite",
    schemaVersion: 4,
    lockState: "held",
    backupState: "available_by_explicit_flow",
    retentionState: "not_configured",
    quotaState: "not_measured",
  });
  assert.equal("databasePath" in settings.get(), false);
  assert.equal("lockPath" in settings.get(), false);
});

test("storage settings reject contradictory or unsafe snapshots", () => {
  assert.throws(() => new StaticStorageSettings({ version: 1, backend: "sqlite", location: "ephemeral_memory", lockState: "not_applicable", backupState: "not_configured", retentionState: "not_configured", quotaState: "not_measured" }), StorageSettingsError);
  assert.throws(() => new StaticStorageSettings({ version: 1, backend: "sqlite", location: "profile_directory", databaseFile: "studio.sqlite", lockState: "held", backupState: "available_by_explicit_flow", retentionState: "not_configured", quotaState: "not_measured" }), /profile ID/);
  assert.throws(() => new StaticStorageSettings({ version: 1, backend: "memory", location: "ephemeral_memory", schemaVersion: 0, lockState: "not_applicable", backupState: "not_configured", retentionState: "not_configured", quotaState: "not_measured" }), /schema version/);
});
