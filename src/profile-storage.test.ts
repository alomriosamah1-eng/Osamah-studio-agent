import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import test from "node:test";
import { FileProfileLock, ProfileLockedError, resolveProfilePaths, validateProfileId } from "./infrastructure/profile-storage.js";

test("profile paths are deterministic and reject unsafe profile IDs", async () => {
  const root = await mkdtemp(join(tmpdir(), "osamah-profile-paths-"));
  try {
    const paths = resolveProfilePaths({ userDataDirectory: root, profileId: "work_linux" });
    assert.equal(paths.profileId, "work_linux");
    assert.equal(paths.profileDirectory, join(root, "profiles", "work_linux"));
    assert.equal(paths.databasePath, join(paths.profileDirectory, "studio.sqlite"));
    assert.equal(paths.lockPath, join(paths.profileDirectory, ".profile.lock"));
    assert.equal(paths.backupsDirectory, join(paths.profileDirectory, "backups"));
    assert.throws(() => validateProfileId("../escape"), /Profile ID/);
    assert.throws(() => validateProfileId("with space"), /Profile ID/);
    assert.throws(() => resolveProfilePaths({ userDataDirectory: sep }), /filesystem root/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("profile lock is exclusive and release is idempotent", async () => {
  const root = await mkdtemp(join(tmpdir(), "osamah-profile-lock-"));
  const lockPath = join(root, ".profile.lock");
  try {
    const first = FileProfileLock.acquire(root, lockPath);
    try {
      assert.equal(existsSync(lockPath), true);
      assert.throws(() => FileProfileLock.acquire(root, lockPath), (error: unknown) => error instanceof ProfileLockedError);
    } finally {
      first.release();
      first.release();
    }
    assert.equal(existsSync(lockPath), false);
    const second = FileProfileLock.acquire(root, lockPath);
    second.release();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
