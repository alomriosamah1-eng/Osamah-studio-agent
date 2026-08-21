import type { ApprovalId, DeviceProfileId, PreviewSessionId, SessionId, WorkspaceId } from "./primitives.js";

export type DomainEvent =
  | { readonly type: "WorkspaceOpened"; readonly workspaceId: WorkspaceId; readonly occurredAt: string }
  | { readonly type: "SessionCreated"; readonly sessionId: SessionId; readonly workspaceId: WorkspaceId; readonly occurredAt: string }
  | { readonly type: "ApprovalRequested"; readonly approvalId: ApprovalId; readonly sessionId: SessionId; readonly occurredAt: string }
  | { readonly type: "ApprovalResolved"; readonly approvalId: ApprovalId; readonly decision: "approved" | "denied"; readonly occurredAt: string }
  | { readonly type: "PreviewCreated"; readonly previewSessionId: PreviewSessionId; readonly deviceProfileId: DeviceProfileId; readonly occurredAt: string }
  | { readonly type: "PreviewStatusChanged"; readonly previewSessionId: PreviewSessionId; readonly status: string; readonly occurredAt: string };

export interface EventBus {
  publish(event: DomainEvent): void;
  subscribe(listener: (event: DomainEvent) => void): () => void;
}
