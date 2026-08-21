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
  readJson(rootPath: string, relativePath: string): Promise<Record<string, unknown> | undefined>;
}

export interface Clock {
  now(): string;
}

export interface IdGenerator {
  next(prefix: string): string;
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
