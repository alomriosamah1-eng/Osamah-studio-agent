import type { DomainEvent, EventBus } from "../domain/events.js";
import type { AgentSession, ApprovalRequest, DeviceProfile, PreviewSession, Workspace } from "../domain/entities.js";
import type { ApprovalId, DeviceProfileId, PreviewSessionId, SessionId, WorkspaceId } from "../domain/primitives.js";
import type {
  ApprovalRepository,
  Clock,
  DeviceProfileRepository,
  IdGenerator,
  ObservabilityRecord,
  ObservabilitySink,
  PreviewRepository,
  SessionRepository,
  WorkspaceRepository,
} from "../application/ports.js";

export class InMemoryEventBus implements EventBus {
  private readonly listeners = new Set<(event: DomainEvent) => void>();
  public readonly history: DomainEvent[] = [];

  public publish(event: DomainEvent): void {
    this.history.push(event);
    for (const listener of this.listeners) listener(event);
  }

  public subscribe(listener: (event: DomainEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

class MapRepository<T, I> {
  public readonly map = new Map<I, T>();
  public save(entity: T & { id: I }): void { this.map.set(entity.id, entity); }
  public get(id: I): T | undefined { return this.map.get(id); }
}

export class InMemoryRepositories {
  private readonly workspaceStore = new MapRepository<Workspace, WorkspaceId>();
  private readonly sessionStore = new MapRepository<AgentSession, SessionId>();
  private readonly approvalStore = new MapRepository<ApprovalRequest, ApprovalId>();
  private readonly deviceStore = new MapRepository<DeviceProfile, DeviceProfileId>();
  private readonly previewStore = new MapRepository<PreviewSession, PreviewSessionId>();

  public readonly workspaces: WorkspaceRepository = this.workspaceStore;
  public readonly sessions: SessionRepository = this.sessionStore;
  public readonly approvals: ApprovalRepository = this.approvalStore;
  public readonly devices: DeviceProfileRepository = this.deviceStore;
  public readonly previews: PreviewRepository = this.previewStore;
}

export class InMemoryObservabilitySink implements ObservabilitySink {
  public readonly records: ObservabilityRecord[] = [];

  public record(record: ObservabilityRecord): void {
    this.records.push(record);
  }

  public list(limit = 100): readonly ObservabilityRecord[] {
    const boundedLimit = Math.max(1, Math.min(Math.floor(limit), 500));
    return this.records.slice(-boundedLimit).reverse();
  }
}

export class FixedClock implements Clock {
  public constructor(private readonly value: string = "2026-08-22T00:00:00.000Z") {}
  public now(): string { return this.value; }
}

export class IncrementingIds implements IdGenerator {
  private counter = 0;
  public next(prefix: string): string { this.counter += 1; return `${prefix}-${this.counter}`; }
}
