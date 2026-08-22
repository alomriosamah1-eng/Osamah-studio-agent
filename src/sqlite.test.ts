import { strict as assert } from "node:assert";
import { copyFileSync, cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createApproval, createDeviceProfile, createPreviewSession, createSession, createWorkspace } from "./domain/entities.js";
import { approvalId, deviceProfileId, previewSessionId, sessionId, workspaceId } from "./domain/primitives.js";
import { InMemoryObservabilitySink, IncrementingIds } from "./infrastructure/in-memory.js";
import { LocalSqliteBackupProvider } from "./infrastructure/sqlite-backup.js";
import { createSqliteApplicationStorage, migrationChecksum, redactJson, SqliteDatabase } from "./infrastructure/sqlite.js";

const migrationsPath = join(process.cwd(), "db", "migrations");

const makeTempRoot = (): string => mkdtempSync(join(tmpdir(), "osamah-studio-sqlite-"));

const makeIds = (): IncrementingIds => new IncrementingIds();

test("SQLite applies migrations in order and persists the latest schema version", () => {
  const root = makeTempRoot();
  const databasePath = join(root, "studio.sqlite");
  const database = new SqliteDatabase({ databasePath, migrationsPath });
  try {
    assert.deepEqual(database.get("SELECT value FROM schema_meta WHERE key = ?", ["schema_version"]), { value: "004" });
    const tables = database.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").map((row) => row.name);
    assert.deepEqual(tables, ["agent_audit_records", "approval_tickets", "approvals", "artifacts", "device_profiles", "domain_events", "jobs", "observability_logs", "preview_sessions", "schema_meta", "sessions", "workspaces"]);
    const indexes = database.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_autoindex_%' ORDER BY name").map((row) => row.name);
    assert.deepEqual(indexes, ["idx_agent_audit_approval", "idx_agent_audit_correlation", "idx_agent_audit_session", "idx_agent_audit_time", "idx_approval_tickets_pending", "idx_approval_tickets_session", "idx_approvals_session", "idx_events_aggregate", "idx_observability_correlation", "idx_observability_time", "idx_preview_device", "idx_sessions_workspace"]);
  } finally {
    database.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("SQLite rejects a changed checksum for an applied migration", () => {
  const root = makeTempRoot();
  const temporaryMigrations = join(root, "migrations");
  mkdirSync(temporaryMigrations);
  copyFileSync(join(migrationsPath, "001_initial.sql"), join(temporaryMigrations, "001_initial.sql"));
  copyFileSync(join(migrationsPath, "002_observability.sql"), join(temporaryMigrations, "002_observability.sql"));
  copyFileSync(join(migrationsPath, "003_agent_audit.sql"), join(temporaryMigrations, "003_agent_audit.sql"));
  const databasePath = join(root, "studio.sqlite");
  const first = new SqliteDatabase({ databasePath, migrationsPath: temporaryMigrations });
  first.close();
  writeFileSync(join(temporaryMigrations, "001_initial.sql"), `${readFileSync(join(temporaryMigrations, "001_initial.sql"), "utf8")}\n-- changed after publication\n`, "utf8");
  try {
    assert.throws(() => new SqliteDatabase({ databasePath, migrationsPath: temporaryMigrations }), /checksum mismatch: 001_initial\.sql/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("SQLite repositories round-trip all current persisted entities across restart", () => {
  const root = makeTempRoot();
  const databasePath = join(root, "studio.sqlite");
  const ids = makeIds();
  const storage = createSqliteApplicationStorage({ databasePath, migrationsPath }, ids);
  const workspace = createWorkspace({ id: "workspace-sqlite", name: "SQLite workspace", rootPath: "/tmp/workspace", now: "2026-08-22T10:00:00.000Z" });
  const session = createSession({ id: "session-sqlite", workspaceId: workspace.id, now: "2026-08-22T10:01:00.000Z" });
  const approval = createApproval({ id: "approval-sqlite", sessionId: session.id, action: "write file", risk: "medium", scope: "src/", now: "2026-08-22T10:02:00.000Z" });
  const device = createDeviceProfile({ id: "device-sqlite", name: "Pixel fixture", platform: "android", osVersion: "15", width: 1080, height: 2400, dpi: 420, safeArea: { top: 24, right: 0, bottom: 32, left: 0 }, statusBarHeight: 24, navigationBarHeight: 32, orientation: "portrait", theme: "dark" });
  const preview = createPreviewSession({ id: "preview-sqlite", deviceProfileId: device.id, mode: "lightweight_web", now: "2026-08-22T10:03:00.000Z" });
  try {
    storage.repositories.workspaces.save(workspace);
    storage.repositories.sessions.save(session);
    storage.repositories.approvals.save(approval);
    storage.repositories.devices.save(device);
    storage.repositories.previews.save(preview);
    assert.deepEqual(storage.repositories.workspaces.get(workspace.id), workspace);
    assert.deepEqual(storage.repositories.sessions.get(session.id), session);
    assert.deepEqual(storage.repositories.approvals.get(approval.id), approval);
    assert.deepEqual(storage.repositories.devices.get(device.id), device);
    assert.deepEqual(storage.repositories.previews.get(preview.id), preview);
  } finally {
    storage.database.close();
  }

  const reopened = createSqliteApplicationStorage({ databasePath, migrationsPath }, makeIds());
  try {
    assert.deepEqual(reopened.repositories.workspaces.get(workspaceId("workspace-sqlite")), workspace);
    assert.deepEqual(reopened.repositories.sessions.get(sessionId("session-sqlite")), session);
    assert.deepEqual(reopened.repositories.approvals.get(approvalId("approval-sqlite")), approval);
    assert.deepEqual(reopened.repositories.devices.get(deviceProfileId("device-sqlite")), device);
    assert.deepEqual(reopened.repositories.previews.get(previewSessionId("preview-sqlite")), preview);
  } finally {
    reopened.database.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("SQLite event bus persists redacted domain events and notifies subscribers", () => {
  const root = makeTempRoot();
  const storage = createSqliteApplicationStorage({ databasePath: join(root, "studio.sqlite"), migrationsPath }, makeIds());
  const workspace = workspaceId("workspace-event");
  const received: string[] = [];
  const unsubscribe = storage.events.subscribe((event) => received.push(event.type));
  try {
    storage.events.publish({ type: "WorkspaceOpened", workspaceId: workspace, occurredAt: "2026-08-22T10:04:00.000Z" });
    unsubscribe();
    assert.deepEqual(received, ["WorkspaceOpened"]);
    assert.equal(storage.events.history.length, 1);
    const row = storage.database.get<{ event_type: string; aggregate_id: string; payload_json: string }>("SELECT event_type, aggregate_id, payload_json FROM domain_events");
    assert.equal(row?.event_type, "WorkspaceOpened");
    assert.equal(row?.aggregate_id, workspace);
    assert.deepEqual(JSON.parse(row?.payload_json ?? "{}"), { type: "WorkspaceOpened", workspaceId: workspace, occurredAt: "2026-08-22T10:04:00.000Z" });
  } finally {
    storage.database.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("SQLite observability sink stores redacted payloads and returns bounded newest-first records", () => {
  const root = makeTempRoot();
  const storage = createSqliteApplicationStorage({ databasePath: join(root, "studio.sqlite"), migrationsPath }, makeIds());
  try {
    storage.observability.record({ id: "log-1", occurredAt: "2026-08-22T10:05:00.000Z", level: "warn", eventType: "preview.degraded", correlationId: "corr-1", durationMs: 12, resultCode: "COMPATIBILITY_MODE", payload: { visible: "kept", apiKey: "must-hide", nested: { password: "must-hide" } } });
    storage.observability.record({ id: "log-2", occurredAt: "2026-08-22T10:06:00.000Z", level: "info", eventType: "preview.ready", payload: { visible: true } });
    const records = storage.observability.list(1);
    assert.equal(records.length, 1);
    assert.equal(records[0]?.id, "log-2");
    const full = storage.observability.list(10);
    assert.deepEqual(full[1]?.payload, { visible: "kept", apiKey: "[REDACTED]", nested: { password: "[REDACTED]" } });
  } finally {
    storage.database.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("SQLite approval store persists full tickets across restart", () => {
  const root = makeTempRoot();
  const databasePath = join(root, "studio.sqlite");
  const storage = createSqliteApplicationStorage({ databasePath, migrationsPath }, makeIds());
  const workspace = createWorkspace({ id: "workspace-ticket", name: "Ticket workspace", rootPath: "/tmp/ticket", now: "2026-08-22T10:04:00.000Z" });
  const session = createSession({ id: "session-ticket", workspaceId: workspace.id, now: "2026-08-22T10:04:01.000Z" });
  const requested = { approvalId: "approval-ticket", correlationId: "corr-ticket", action: { actionId: "action-ticket", sessionId: session.id, kind: "filesystem.write" as const, risk: "high" as const, scope: "src/file.ts", idempotencyKey: "idem-ticket" }, status: "requested" as const, createdAt: "2026-08-22T10:04:02.000Z" };
  const resolved = { ...requested, status: "approved" as const, resolvedAt: "2026-08-22T10:04:03.000Z" };
  try {
    storage.repositories.workspaces.save(workspace);
    storage.repositories.sessions.save(session);
    storage.approvalStore.save(requested);
    storage.approvalStore.save(resolved);
    assert.deepEqual(storage.approvalStore.list(1), [resolved]);
  } finally {
    storage.database.close();
  }

  const reopened = createSqliteApplicationStorage({ databasePath, migrationsPath }, makeIds());
  try {
    assert.deepEqual(reopened.approvalStore.list(1), [resolved]);
    assert.equal(reopened.approvalStore.list(0).length, 1);
  } finally {
    reopened.database.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("SQLite audit trail persists redacted decision fields across restart", () => {
  const root = makeTempRoot();
  const databasePath = join(root, "studio.sqlite");
  const storage = createSqliteApplicationStorage({ databasePath, migrationsPath }, makeIds());
  try {
    storage.audit.append({ id: "audit-1", occurredAt: "2026-08-22T10:05:00.000Z", correlationId: "corr-audit", actionId: "action-write", sessionId: "session-audit", kind: "filesystem.write", risk: "high", decision: "approval_required", approvalId: "approval-audit", scope: "root=/tmp prompt=do-not-store token=do-not-store", reason: "prompt=do-not-store authorization=do-not-store" });
    const record = storage.audit.list(1)[0];
    assert.equal(record?.decision, "approval_required");
    assert.equal(record?.scope, "root=/tmp prompt=[REDACTED] token=[REDACTED]");
    assert.equal(record?.reason, "prompt=[REDACTED] authorization=[REDACTED]");
  } finally {
    storage.database.close();
  }

  const reopened = createSqliteApplicationStorage({ databasePath, migrationsPath }, makeIds());
  try {
    const record = reopened.audit.list(1)[0];
    assert.equal(record?.id, "audit-1");
    assert.equal(record?.scope.includes("do-not-store"), false);
    assert.equal(record?.reason.includes("do-not-store"), false);
  } finally {
    reopened.database.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("redaction and transaction contracts are deterministic", () => {
  assert.equal(redactJson({ token: "secret", nested: { privateKey: "secret", value: 3 } }), JSON.stringify({ token: "[REDACTED]", nested: { privateKey: "[REDACTED]", value: 3 } }));
  assert.equal(migrationChecksum("abc").length, 64);
  const root = makeTempRoot();
  const database = new SqliteDatabase({ databasePath: join(root, "studio.sqlite"), migrationsPath });
  try {
    assert.throws(() => database.transaction(() => { database.run("INSERT INTO workspaces(id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", ["tx", "Tx", "/tmp/tx", "now", "now"]); throw new Error("rollback"); }), /rollback/);
    assert.equal(database.get("SELECT id FROM workspaces WHERE id = ?", ["tx"]), undefined);
    database.transaction(() => database.run("INSERT INTO workspaces(id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", ["tx-ok", "Tx", "/tmp/tx", "now", "now"]));
    assert.deepEqual(database.get("SELECT id FROM workspaces WHERE id = ?", ["tx-ok"]), { id: "tx-ok" });
  } finally {
    database.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("SQLite backup creates a verifiable snapshot and restores into a separate profile", async () => {
  const root = makeTempRoot();
  const liveRoot = join(root, "live");
  const backupRoot = join(root, "backup");
  const restoredRoot = join(root, "restored");
  mkdirSync(liveRoot, { recursive: true });
  const databasePath = join(liveRoot, "studio.sqlite");
  const storage = createSqliteApplicationStorage({ databasePath, migrationsPath }, makeIds());
  const provider = new LocalSqliteBackupProvider({ database: storage.database, databasePath, migrationsPath, clock: { now: () => "2026-08-22T10:08:00.000Z" } });
  try {
    storage.observability.record({ id: "backup-log", occurredAt: "2026-08-22T10:08:00.000Z", level: "info", eventType: "backup.fixture", payload: { apiKey: "never-export-raw" } });
    const manifest = await provider.create(backupRoot);
    assert.equal(manifest.formatVersion, 1);
    assert.equal(manifest.schemaVersion, "004");
    assert.equal(manifest.files[0]?.relativePath, "studio.sqlite");
    assert.deepEqual(await provider.verify(backupRoot), manifest);
    const restoredManifest = await provider.restore(backupRoot, restoredRoot);
    assert.deepEqual(restoredManifest, manifest);
    assert.deepEqual(await provider.verify(restoredRoot), manifest);
    await assert.rejects(() => provider.create(liveRoot), /separate profile directory/);

    const restored = new SqliteDatabase({ databasePath: join(restoredRoot, "studio.sqlite"), migrationsPath });
    try {
      const log = restored.get<{ payload_json: string }>("SELECT payload_json FROM observability_logs WHERE id = ?", ["backup-log"]);
      assert.deepEqual(JSON.parse(log?.payload_json ?? "{}"), { apiKey: "[REDACTED]" });
    } finally {
      restored.close();
    }

    writeFileSync(join(backupRoot, "studio.sqlite"), Buffer.from("tampered"), { flag: "a" });
    await assert.rejects(() => provider.verify(backupRoot), /checksum mismatch/);
  } finally {
    storage.database.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("in-memory observability sink remains available for fast application tests", () => {
  const sink = new InMemoryObservabilitySink();
  sink.record({ id: "memory-1", occurredAt: "2026-08-22T10:07:00.000Z", level: "debug", eventType: "test", payload: { ok: true } });
  assert.equal(sink.list(1)[0]?.id, "memory-1");
});
