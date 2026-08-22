export type AgentActionKind =
  | "filesystem.read"
  | "filesystem.write"
  | "terminal.exec"
  | "git.commit"
  | "github.push"
  | "mcp.tool"
  | "browser.submit"
  | "media.publish"
  | "provider.invoke";

export interface AgentActionRequest {
  readonly actionId: string;
  readonly sessionId: string;
  readonly kind: AgentActionKind;
  readonly risk: "low" | "medium" | "high" | "critical";
  readonly scope: string;
  readonly idempotencyKey?: string;
}

export type AgentAuthorizationDecision =
  | {
      readonly decision: "allowed";
      readonly correlationId: string;
      readonly reason: string;
    }
  | {
      readonly decision: "approval_required";
      readonly correlationId: string;
      readonly approvalId: string;
      readonly reason: string;
    }
  | {
      readonly decision: "denied";
      readonly correlationId: string;
      readonly approvalId?: string;
      readonly reason: string;
    };

export interface AgentAuthorizationPort {
  authorize(action: AgentActionRequest, approvalId?: string): AgentAuthorizationDecision;
}

export interface ApprovalTicket {
  readonly approvalId: string;
  readonly correlationId: string;
  readonly action: AgentActionRequest;
  readonly status: "requested" | "approved" | "denied";
  readonly createdAt: string;
  readonly resolvedAt?: string;
}

export interface ApprovalWorkflowPort extends AgentAuthorizationPort {
  get(approvalId: string): ApprovalTicket | undefined;
  listPending(limit?: number): readonly ApprovalTicket[];
  resolve(approvalId: string, decision: "approved" | "denied"): ApprovalTicket;
}

export interface ApprovalStore {
  save(ticket: ApprovalTicket): void;
  list(limit?: number): readonly ApprovalTicket[];
}

export type AuditDecision = "allowed" | "approval_required" | "approved" | "denied";

const sensitiveAuditAssignment = /\b(token|secret|password|api[-_]?key|authorization|prompt|private[-_]?key)\s*[:=]\s*[^\s,;]+/gi;

export const sanitizeAuditText = (value: string, maxLength: number): string => value.replace(sensitiveAuditAssignment, (_match, key: string) => `${key}=[REDACTED]`).slice(0, maxLength);

export interface AuditRecord {
  readonly id: string;
  readonly occurredAt: string;
  readonly correlationId: string;
  readonly actionId: string;
  readonly sessionId: string;
  readonly kind: AgentActionKind;
  readonly risk: "low" | "medium" | "high" | "critical";
  readonly decision: AuditDecision;
  readonly approvalId?: string;
  readonly scope: string;
  readonly reason: string;
}

export interface AuditTrail {
  append(record: AuditRecord): void;
  list(limit?: number): readonly AuditRecord[];
}

export interface AuditRetentionStore {
  deleteBefore(occurredBefore: string): number;
  deleteIds(ids: readonly string[]): number;
}

export interface AuditExportManifest {
  readonly formatVersion: 1;
  readonly createdAt: string;
  readonly recordCount: number;
  readonly bytes: number;
  readonly sha256: string;
  readonly relativePath: "audit.ndjson";
}

export interface AuditExportProvider {
  create(destinationRoot: string, limit?: number): Promise<AuditExportManifest>;
}
