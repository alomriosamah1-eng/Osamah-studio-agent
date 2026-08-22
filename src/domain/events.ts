import type { ApprovalId, DeviceProfileId, PreviewSessionId, SessionId, WorkspaceId } from "./primitives.js";

export type DomainEvent =
  | { readonly type: "WorkspaceOpened"; readonly workspaceId: WorkspaceId; readonly occurredAt: string }
  | { readonly type: "SessionCreated"; readonly sessionId: SessionId; readonly workspaceId: WorkspaceId; readonly occurredAt: string }
  | { readonly type: "ApprovalRequested"; readonly approvalId: ApprovalId; readonly sessionId: SessionId; readonly occurredAt: string }
  | { readonly type: "ApprovalResolved"; readonly approvalId: ApprovalId; readonly decision: "approved" | "denied"; readonly occurredAt: string }
  | { readonly type: "PreviewCreated"; readonly previewSessionId: PreviewSessionId; readonly deviceProfileId: DeviceProfileId; readonly occurredAt: string }
  | { readonly type: "PreviewStatusChanged"; readonly previewSessionId: PreviewSessionId; readonly status: string; readonly occurredAt: string }
  | { readonly type: "WorkCycleStarted"; readonly cycleId: string; readonly sessionId: SessionId; readonly occurredAt: string }
  | { readonly type: "WorkCycleWaitingApproval"; readonly cycleId: string; readonly approvalId: ApprovalId; readonly occurredAt: string }
  | { readonly type: "WorkCycleCheckpointed"; readonly cycleId: string; readonly checkpointId: string; readonly occurredAt: string }
  | { readonly type: "WorkCycleApplied"; readonly cycleId: string; readonly checkpointId: string; readonly occurredAt: string }
  | { readonly type: "WorkCycleDenied"; readonly cycleId: string; readonly occurredAt: string }
  | { readonly type: "WorkCycleFailed"; readonly cycleId: string; readonly occurredAt: string };

export interface EventBus {
  publish(event: DomainEvent): void;
  subscribe(listener: (event: DomainEvent) => void): () => void;
}
