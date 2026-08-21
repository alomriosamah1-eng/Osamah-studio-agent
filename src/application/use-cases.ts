import {
  createApproval,
  createDeviceProfile,
  createPreviewSession,
  createSession,
  createWorkspace,
  resolveApproval,
  transitionPreview,
  transitionSession,
  type AgentSession,
  type ApprovalRequest,
  type DeviceProfile,
  type PreviewSession,
  type Workspace,
} from "../domain/entities.js";
import type { ApplicationDependencies } from "./ports.js";
import type { ApprovalId, DeviceProfileId, PreviewSessionId, SessionId, WorkspaceId } from "../domain/primitives.js";

export class FoundationUseCases {
  public constructor(private readonly deps: ApplicationDependencies) {}

  public openWorkspace(input: { name: string; rootPath: string }): Workspace {
    const entity = createWorkspace({ id: this.deps.ids.next("workspace"), ...input, now: this.deps.clock.now() });
    this.deps.workspaces.save(entity);
    this.deps.events.publish({ type: "WorkspaceOpened", workspaceId: entity.id, occurredAt: this.deps.clock.now() });
    return entity;
  }

  public createSession(workspaceId: WorkspaceId): AgentSession {
    if (!this.deps.workspaces.get(workspaceId)) throw new Error(`Workspace ${workspaceId} was not found.`);
    const entity = createSession({ id: this.deps.ids.next("session"), workspaceId, now: this.deps.clock.now() });
    this.deps.sessions.save(entity);
    this.deps.events.publish({ type: "SessionCreated", sessionId: entity.id, workspaceId, occurredAt: this.deps.clock.now() });
    return entity;
  }

  public startSession(id: SessionId): AgentSession {
    const current = this.requireSession(id);
    const next = transitionSession(current, "running");
    this.deps.sessions.save(next);
    return next;
  }

  public requestApproval(input: { sessionId: SessionId; action: string; risk: Parameters<typeof createApproval>[0]["risk"]; scope: string }): ApprovalRequest {
    this.requireSession(input.sessionId);
    const entity = createApproval({ id: this.deps.ids.next("approval"), ...input, now: this.deps.clock.now() });
    this.deps.approvals.save(entity);
    this.deps.events.publish({ type: "ApprovalRequested", approvalId: entity.id, sessionId: entity.sessionId, occurredAt: this.deps.clock.now() });
    const session = this.requireSession(input.sessionId);
    if (session.status === "running") this.deps.sessions.save(transitionSession(session, "waiting_approval"));
    return entity;
  }

  public resolveApproval(id: ApprovalId, decision: "approved" | "denied"): ApprovalRequest {
    const current = this.deps.approvals.get(id);
    if (!current) throw new Error(`Approval ${id} was not found.`);
    const entity = resolveApproval(current, decision);
    this.deps.approvals.save(entity);
    this.deps.events.publish({ type: "ApprovalResolved", approvalId: id, decision, occurredAt: this.deps.clock.now() });
    const session = this.requireSession(entity.sessionId);
    if (session.status === "waiting_approval") this.deps.sessions.save(transitionSession(session, decision === "approved" ? "running" : "cancelled"));
    return entity;
  }

  public registerDeviceProfile(input: Parameters<typeof createDeviceProfile>[0]): DeviceProfile {
    const entity = createDeviceProfile(input);
    this.deps.devices.save(entity);
    return entity;
  }

  public createPreview(input: { deviceProfileId: DeviceProfileId; mode?: PreviewSession["mode"] }): PreviewSession {
    if (!this.deps.devices.get(input.deviceProfileId)) throw new Error(`Device profile ${input.deviceProfileId} was not found.`);
    const entity = createPreviewSession({ id: this.deps.ids.next("preview"), deviceProfileId: input.deviceProfileId, mode: input.mode, now: this.deps.clock.now() });
    this.deps.previews.save(entity);
    this.deps.events.publish({ type: "PreviewCreated", previewSessionId: entity.id, deviceProfileId: entity.deviceProfileId, occurredAt: this.deps.clock.now() });
    return entity;
  }

  public transitionPreview(id: PreviewSessionId, status: PreviewSession["status"]): PreviewSession {
    const current = this.deps.previews.get(id);
    if (!current) throw new Error(`Preview session ${id} was not found.`);
    const entity = transitionPreview(current, status);
    this.deps.previews.save(entity);
    this.deps.events.publish({ type: "PreviewStatusChanged", previewSessionId: id, status, occurredAt: this.deps.clock.now() });
    return entity;
  }

  private requireSession(id: SessionId): AgentSession {
    const entity = this.deps.sessions.get(id);
    if (!entity) throw new Error(`Session ${id} was not found.`);
    return entity;
  }
}
