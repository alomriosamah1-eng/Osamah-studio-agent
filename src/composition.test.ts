import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createEmbeddedApplication } from "./composition.js";

const migrationsPath = join(process.cwd(), "db", "migrations");

test("composition keeps the lightweight in-memory backend as the default", () => {
  const application = createEmbeddedApplication();
  try {
    assert.equal(application.storageKind, "memory");
    assert.equal(application.sqlite, undefined);
    assert.equal(application.storageFallbackReason, undefined);
    assert.equal(application.resourcePolicy.profile, "low_memory");
  } finally {
    application.close();
    application.close();
  }
});

test("composition opts into SQLite and preserves workspace data across restart", async () => {
  const root = await mkdtemp(join(tmpdir(), "osamah-composition-sqlite-"));
  const databasePath = join(root, "profile.sqlite");
  const storage = { kind: "sqlite" as const, databasePath, migrationsPath };
  try {
    const first = createEmbeddedApplication({ storage });
    const workspace = first.useCases.openWorkspace({ name: "Persistent workspace", rootPath: root });
    assert.equal(first.storageKind, "sqlite");
    assert.ok(first.sqlite);
    first.close();

    const second = createEmbeddedApplication({ storage });
    try {
      assert.deepEqual(second.dependencies.workspaces.get(workspace.id), workspace);
      assert.equal(second.storageKind, "sqlite");
    } finally {
      second.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("composition falls back to memory only when explicitly allowed", async () => {
  const root = await mkdtemp(join(tmpdir(), "osamah-composition-fallback-"));
  const databasePath = join(root, "not-a-database");
  await mkdir(databasePath);
  try {
    const fallback = createEmbeddedApplication({ storage: { kind: "sqlite", databasePath, migrationsPath, allowFallback: true } });
    try {
      assert.equal(fallback.storageKind, "memory");
      assert.equal(fallback.sqlite, undefined);
      assert.equal(fallback.storageFallbackReason, "sqlite_initialization_failed");
    } finally {
      fallback.close();
    }
    assert.throws(() => createEmbeddedApplication({ storage: { kind: "sqlite", databasePath, migrationsPath } }));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
