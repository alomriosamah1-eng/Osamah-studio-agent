import type {
  AgentSession,
  ApprovalRequest,
  DeviceProfile,
  PreviewSession,
  Workspace,
} from "../domain/entities.js";
import type { EventBus } from "../domain/events.js";
import type { ApprovalId, DeviceProfileId, PreviewSessionId, SessionId, WorkspaceId } from "../domain/primitives.js";

export interface WorkspaceRepository {
  save(workspace: Workspace): void;
  get(id: WorkspaceId): Workspace | undefined;
}

export interface SessionRepository {
  save(session: AgentSession): void;
  get(id: SessionId): AgentSession | undefined;
}

export interface ApprovalRepository {
  save(approval: ApprovalRequest): void;
  get(id: ApprovalId): ApprovalRequest | undefined;
}

export interface DeviceProfileRepository {
  save(profile: DeviceProfile): void;
  get(id: DeviceProfileId): DeviceProfile | undefined;
}

export interface PreviewRepository {
  save(preview: PreviewSession): void;
  get(id: PreviewSessionId): PreviewSession | undefined;
}

export interface ProjectScanner {
  listRelativeFiles(rootPath: string): Promise<readonly string[]>;
  readText(rootPath: string, relativePath: string): Promise<string | undefined>;
  readJson(rootPath: string, relativePath: string): Promise<Record<string, unknown> | undefined>;
}

export interface Clock {
  now(): string;
}

export interface IdGenerator {
  next(prefix: string): string;
}

export type SqlValue = string | number | null | Uint8Array;

export interface SqlExecutor {
  exec(sql: string): void;
  run(sql: string, parameters?: readonly SqlValue[]): void;
  get<T extends Record<string, unknown>>(sql: string, parameters?: readonly SqlValue[]): T | undefined;
  all<T extends Record<string, unknown>>(sql: string, parameters?: readonly SqlValue[]): readonly T[];
  transaction<T>(work: () => T): T;
  close(): void;
}

export type ObservabilityLevel = "debug" | "info" | "warn" | "error";

export interface ObservabilityRecord {
  readonly id: string;
  readonly occurredAt: string;
  readonly level: ObservabilityLevel;
  readonly eventType: string;
  readonly correlationId?: string;
  readonly durationMs?: number;
  readonly resultCode?: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface ObservabilitySink {
  record(record: ObservabilityRecord): void;
  list(limit?: number): readonly ObservabilityRecord[];
}

export interface BackupFileEntry {
  readonly relativePath: string;
  readonly sha256: string;
  readonly bytes: number;
}

export interface BackupManifest {
  readonly formatVersion: 1;
  readonly createdAt: string;
  readonly schemaVersion: string;
  readonly databaseSha256: string;
  readonly files: readonly BackupFileEntry[];
}

export interface BackupProvider {
  create(destinationRoot: string): Promise<BackupManifest>;
  verify(backupRoot: string): Promise<BackupManifest>;
  restore(backupRoot: string, destinationRoot: string): Promise<BackupManifest>;
}

export interface ApplicationDependencies {
  readonly workspaces: WorkspaceRepository;
  readonly sessions: SessionRepository;
  readonly approvals: ApprovalRepository;
  readonly devices: DeviceProfileRepository;
  readonly previews: PreviewRepository;
  readonly events: EventBus;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}
