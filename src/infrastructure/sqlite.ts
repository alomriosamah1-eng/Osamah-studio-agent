import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { DomainEvent, EventBus } from "../domain/events.js";
import type { AgentSession, ApprovalRequest, DeviceProfile, PreviewSession, Workspace } from "../domain/entities.js";
import type { ApprovalId, DeviceProfileId, PreviewSessionId, SessionId, WorkspaceId } from "../domain/primitives.js";
import type {
  ApprovalRepository,
  Clock,
  DeviceProfileRepository,
  IdGenerator,
  ObservabilityLevel,
  ObservabilityRecord,
  ObservabilitySink,
  PreviewRepository,
  SessionRepository,
  SqlExecutor,
  SqlValue,
  WorkspaceRepository,
} from "../application/ports.js";

const migrationFilePattern = /^\d{3}_[a-z0-9-]+\.sql$/;
const sensitiveKeyPattern = /(token|secret|password|api[-_]?key|authorization|prompt|private[-_]?key)/i;

type SqlRow = Record<string, unknown>;

const asString = (value: unknown, field: string): string => {
  if (typeof value !== "string") throw new Error(`SQLite row field ${field} is not text.`);
  return value;
};

const asNumber = (value: unknown, field: string): number => {
  if (typeof value !== "number") throw new Error(`SQLite row field ${field} is not numeric.`);
  return value;
};

const parseObject = (value: unknown, field: string): Record<string, unknown> => {
  const parsed = JSON.parse(asString(value, field)) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`SQLite row field ${field} is not an object.`);
  return parsed as Record<string, unknown>;
};

const redactValue = (key: string, value: unknown): unknown => {
  if (sensitiveKeyPattern.test(key)) return "[REDACTED]";
  if (Array.isArray(value)) return value.map((item) => redactValue("item", item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, redactValue(childKey, childValue)]));
  }
  return value;
};

export const redactJson = (value: Readonly<Record<string, unknown>>): string => JSON.stringify(redactValue("root", value));

export const migrationChecksum = (sql: string): string => createHash("sha256").update(sql, "utf8").digest("hex");

export interface SqliteDatabaseOptions {
  readonly databasePath: string;
  readonly migrationsPath: string;
}

export class SqliteDatabase implements SqlExecutor {
  private readonly database: DatabaseSync;
  private closed = false;

  public constructor(options: SqliteDatabaseOptions) {
    this.database = new DatabaseSync(options.databasePath, {
      enableForeignKeyConstraints: true,
      timeout: 5000,
      allowExtension: false,
    });
    this.database.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;");
    this.applyMigrations(options.migrationsPath);
  }

  public exec(sql: string): void { this.database.exec(sql); }

  public run(sql: string, parameters: readonly SqlValue[] = []): void {
    this.database.prepare(sql).run(...parameters);
  }

  public get<T extends Record<string, unknown>>(sql: string, parameters: readonly SqlValue[] = []): T | undefined {
    const row = this.database.prepare(sql).get(...parameters) as Record<string, unknown> | undefined;
    return row ? Object.fromEntries(Object.entries(row)) as T : undefined;
  }

  public all<T extends Record<string, unknown>>(sql: string, parameters: readonly SqlValue[] = []): readonly T[] {
    return this.database.prepare(sql).all(...parameters).map((row) => Object.fromEntries(Object.entries(row))) as T[];
  }

  public transaction<T>(work: () => T): T {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = work();
      this.database.exec("COMMIT");
      return result;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  public snapshot(destinationPath: string): void {
    if (this.closed) throw new Error("Cannot snapshot a closed SQLite database.");
    const escapedDestination = destinationPath.replaceAll("'", "''");
    this.database.exec(`VACUUM INTO '${escapedDestination}'`);
  }

  public close(): void {
    if (!this.closed) {
      this.database.close();
      this.closed = true;
    }
  }

  private applyMigrations(migrationsPath: string): void {
    const migrations = readdirSync(migrationsPath)
      .filter((fileName) => migrationFilePattern.test(fileName))
      .sort();
    if (migrations.length === 0) throw new Error("No SQLite migrations found.");

    for (const fileName of migrations) {
      const sql = readFileSync(join(migrationsPath, fileName), "utf8");
      const checksum = migrationChecksum(sql);
      this.database.exec("BEGIN IMMEDIATE");
      try {
        const metadataTableExists = this.database.prepare("SELECT 1 AS present FROM sqlite_master WHERE type='table' AND name='schema_meta'").get();
        if (!metadataTableExists) {
          this.database.exec(sql);
          this.database.prepare("INSERT INTO schema_meta(key, value, updated_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))").run(`migration_checksum:${fileName}`, checksum);
        } else {
          const applied = this.database.prepare("SELECT value FROM schema_meta WHERE key = ?").get(`migration_checksum:${fileName}`) as { value?: unknown } | undefined;
          if (applied && applied.value !== checksum) throw new Error(`SQLite migration checksum mismatch: ${fileName}.`);
          if (!applied) {
            this.database.exec(sql);
            this.database.prepare("INSERT INTO schema_meta(key, value, updated_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))").run(`migration_checksum:${fileName}`, checksum);
          }
        }
        this.database.exec("COMMIT");
      } catch (error) {
        this.database.exec("ROLLBACK");
        throw error;
      }
    }
  }
}

export class SqliteRepositories {
  private readonly workspaceRepository: WorkspaceRepository;
  private readonly sessionRepository: SessionRepository;
  private readonly approvalRepository: ApprovalRepository;
  private readonly deviceRepository: DeviceProfileRepository;
  private readonly previewRepository: PreviewRepository;

  public constructor(private readonly database: SqlExecutor) {
    this.workspaceRepository = {
      save: (workspace) => this.saveWorkspace(workspace),
      get: (id) => this.getWorkspace(id),
    };
    this.sessionRepository = {
      save: (session) => this.saveSession(session),
      get: (id) => this.getSession(id),
    };
    this.approvalRepository = {
      save: (approval) => this.saveApproval(approval),
      get: (id) => this.getApproval(id),
    };
    this.deviceRepository = {
      save: (profile) => this.saveDevice(profile),
      get: (id) => this.getDevice(id),
    };
    this.previewRepository = {
      save: (preview) => this.savePreview(preview),
      get: (id) => this.getPreview(id),
    };
  }

  public get workspaces(): WorkspaceRepository { return this.workspaceRepository; }
  public get sessions(): SessionRepository { return this.sessionRepository; }
  public get approvals(): ApprovalRepository { return this.approvalRepository; }
  public get devices(): DeviceProfileRepository { return this.deviceRepository; }
  public get previews(): PreviewRepository { return this.previewRepository; }

  private saveWorkspace(workspace: Workspace): void {
    this.database.run(`INSERT INTO workspaces(id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, root_path=excluded.root_path, updated_at=excluded.updated_at`,
    [workspace.id, workspace.name, workspace.rootPath, workspace.createdAt, workspace.createdAt]);
  }

  private getWorkspace(id: WorkspaceId): Workspace | undefined {
    const row = this.database.get<SqlRow>("SELECT id, name, root_path, created_at FROM workspaces WHERE id = ?", [id]);
    if (!row) return undefined;
    return { id: asString(row.id, "id") as WorkspaceId, name: asString(row.name, "name"), rootPath: asString(row.root_path, "root_path"), createdAt: asString(row.created_at, "created_at") };
  }

  private saveSession(session: AgentSession): void {
    this.database.run(`INSERT INTO sessions(id, workspace_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET workspace_id=excluded.workspace_id, status=excluded.status, updated_at=excluded.updated_at`,
    [session.id, session.workspaceId, session.status, session.createdAt, session.createdAt]);
  }

  private getSession(id: SessionId): AgentSession | undefined {
    const row = this.database.get<SqlRow>("SELECT id, workspace_id, status, created_at FROM sessions WHERE id = ?", [id]);
    if (!row) return undefined;
    return { id: asString(row.id, "id") as SessionId, workspaceId: asString(row.workspace_id, "workspace_id") as WorkspaceId, status: asString(row.status, "status") as AgentSession["status"], createdAt: asString(row.created_at, "created_at") };
  }

  private saveApproval(approval: ApprovalRequest): void {
    this.database.run(`INSERT INTO approvals(id, session_id, action, risk, scope, status, created_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET session_id=excluded.session_id, action=excluded.action, risk=excluded.risk, scope=excluded.scope, status=excluded.status,
        resolved_at=CASE WHEN excluded.status = 'requested' THEN NULL ELSE COALESCE(approvals.resolved_at, excluded.created_at) END`,
    [approval.id, approval.sessionId, approval.action, approval.risk, approval.scope, approval.status, approval.createdAt, approval.status === "requested" ? null : approval.createdAt]);
  }

  private getApproval(id: ApprovalId): ApprovalRequest | undefined {
    const row = this.database.get<SqlRow>("SELECT id, session_id, action, risk, scope, status, created_at FROM approvals WHERE id = ?", [id]);
    if (!row) return undefined;
    return { id: asString(row.id, "id") as ApprovalId, sessionId: asString(row.session_id, "session_id") as SessionId, action: asString(row.action, "action"), risk: asString(row.risk, "risk") as ApprovalRequest["risk"], scope: asString(row.scope, "scope"), status: asString(row.status, "status") as ApprovalRequest["status"], createdAt: asString(row.created_at, "created_at") };
  }

  private saveDevice(profile: DeviceProfile): void {
    this.database.run(`INSERT INTO device_profiles(id, name, platform, os_version, width, height, dpi, safe_area_json, status_bar_height, navigation_bar_height, orientation, theme, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, platform=excluded.platform, os_version=excluded.os_version, width=excluded.width, height=excluded.height, dpi=excluded.dpi,
        safe_area_json=excluded.safe_area_json, status_bar_height=excluded.status_bar_height, navigation_bar_height=excluded.navigation_bar_height,
        orientation=excluded.orientation, theme=excluded.theme, updated_at=excluded.updated_at`,
    [profile.id, profile.name, profile.platform, profile.osVersion, profile.width, profile.height, profile.dpi, JSON.stringify(profile.safeArea), profile.statusBarHeight, profile.navigationBarHeight, profile.orientation, profile.theme, "1970-01-01T00:00:00.000Z", "1970-01-01T00:00:00.000Z"]);
  }

  private getDevice(id: DeviceProfileId): DeviceProfile | undefined {
    const row = this.database.get<SqlRow>("SELECT id, name, platform, os_version, width, height, dpi, safe_area_json, status_bar_height, navigation_bar_height, orientation, theme FROM device_profiles WHERE id = ?", [id]);
    if (!row) return undefined;
    const safeArea = parseObject(row.safe_area_json, "safe_area_json");
    return {
      id: asString(row.id, "id") as DeviceProfileId,
      name: asString(row.name, "name"),
      platform: asString(row.platform, "platform") as DeviceProfile["platform"],
      osVersion: asString(row.os_version, "os_version"),
      width: asNumber(row.width, "width"),
      height: asNumber(row.height, "height"),
      dpi: asNumber(row.dpi, "dpi"),
      safeArea: { top: asNumber(safeArea.top, "safe_area.top"), right: asNumber(safeArea.right, "safe_area.right"), bottom: asNumber(safeArea.bottom, "safe_area.bottom"), left: asNumber(safeArea.left, "safe_area.left") },
      statusBarHeight: asNumber(row.status_bar_height, "status_bar_height"),
      navigationBarHeight: asNumber(row.navigation_bar_height, "navigation_bar_height"),
      orientation: asString(row.orientation, "orientation") as DeviceProfile["orientation"],
      theme: asString(row.theme, "theme") as DeviceProfile["theme"],
    };
  }

  private savePreview(preview: PreviewSession): void {
    this.database.run(`INSERT INTO preview_sessions(id, device_profile_id, mode, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET device_profile_id=excluded.device_profile_id, mode=excluded.mode, status=excluded.status, updated_at=excluded.updated_at`,
    [preview.id, preview.deviceProfileId, preview.mode, preview.status, preview.createdAt, preview.createdAt]);
  }

  private getPreview(id: PreviewSessionId): PreviewSession | undefined {
    const row = this.database.get<SqlRow>("SELECT id, device_profile_id, mode, status, created_at FROM preview_sessions WHERE id = ?", [id]);
    if (!row) return undefined;
    return { id: asString(row.id, "id") as PreviewSessionId, deviceProfileId: asString(row.device_profile_id, "device_profile_id") as DeviceProfileId, mode: asString(row.mode, "mode") as PreviewSession["mode"], status: asString(row.status, "status") as PreviewSession["status"], createdAt: asString(row.created_at, "created_at") };
  }
}

const eventAggregateId = (event: DomainEvent): string => {
  if ("workspaceId" in event) return event.workspaceId;
  if ("sessionId" in event) return event.sessionId;
  if ("approvalId" in event) return event.approvalId;
  return event.previewSessionId;
};

export class SqliteEventBus implements EventBus {
  private readonly listeners = new Set<(event: DomainEvent) => void>();
  public readonly history: DomainEvent[] = [];

  public constructor(private readonly database: SqlExecutor, private readonly ids: IdGenerator) {}

  public publish(event: DomainEvent): void {
    this.database.run(`INSERT INTO domain_events(event_id, event_type, aggregate_id, correlation_id, schema_version, payload_json, occurred_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [this.ids.next("event"), event.type, eventAggregateId(event), eventAggregateId(event), 1, redactJson(event as unknown as Record<string, unknown>), event.occurredAt]);
    this.history.push(event);
    for (const listener of this.listeners) listener(event);
  }

  public subscribe(listener: (event: DomainEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export class SqliteObservabilitySink implements ObservabilitySink {
  public constructor(private readonly database: SqlExecutor) {}

  public record(record: ObservabilityRecord): void {
    this.database.run(`INSERT INTO observability_logs(id, occurred_at, level, event_type, correlation_id, duration_ms, result_code, payload_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [record.id, record.occurredAt, record.level, record.eventType, record.correlationId ?? null, record.durationMs ?? null, record.resultCode ?? null, redactJson(record.payload)]);
  }

  public list(limit = 100): readonly ObservabilityRecord[] {
    const boundedLimit = Math.max(1, Math.min(Math.floor(limit), 500));
    const rows = this.database.all<SqlRow>("SELECT id, occurred_at, level, event_type, correlation_id, duration_ms, result_code, payload_json FROM observability_logs ORDER BY occurred_at DESC, id DESC LIMIT ?", [boundedLimit]);
    return rows.map((row) => ({
      id: asString(row.id, "id"),
      occurredAt: asString(row.occurred_at, "occurred_at"),
      level: asString(row.level, "level") as ObservabilityLevel,
      eventType: asString(row.event_type, "event_type"),
      ...(row.correlation_id === null ? {} : { correlationId: asString(row.correlation_id, "correlation_id") }),
      ...(row.duration_ms === null ? {} : { durationMs: asNumber(row.duration_ms, "duration_ms") }),
      ...(row.result_code === null ? {} : { resultCode: asString(row.result_code, "result_code") }),
      payload: parseObject(row.payload_json, "payload_json"),
    }));
  }
}

export interface SqliteApplicationStorage {
  readonly database: SqliteDatabase;
  readonly repositories: SqliteRepositories;
  readonly events: SqliteEventBus;
  readonly observability: SqliteObservabilitySink;
}

export const createSqliteApplicationStorage = (options: SqliteDatabaseOptions, ids: IdGenerator): SqliteApplicationStorage => {
  const database = new SqliteDatabase(options);
  const repositories = new SqliteRepositories(database);
  const events = new SqliteEventBus(database, ids);
  const observability = new SqliteObservabilitySink(database);
  return { database, repositories, events, observability };
};
