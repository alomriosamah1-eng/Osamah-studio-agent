import { createApproval, resolveApproval } from "../domain/entities.js";
import { approvalId, sessionId, type ApprovalId } from "../domain/primitives.js";
import type { ApplicationDependencies } from "./ports.js";
import type {
  AgentActionRequest,
  AgentAuthorizationDecision,
  ApprovalTicket,
  ApprovalWorkflowPort,
  AuditRecord,
  AuditTrail,
} from "./agent-contracts.js";

const knownActionKinds = new Set<AgentActionRequest["kind"]>([
  "filesystem.read",
  "filesystem.write",
  "terminal.exec",
  "git.commit",
  "github.push",
  "mcp.tool",
  "browser.submit",
  "media.publish",
  "provider.invoke",
]);

const approvalRequiredKinds = new Set<AgentActionRequest["kind"]>([
  "filesystem.write",
  "terminal.exec",
  "git.commit",
  "github.push",
  "mcp.tool",
  "browser.submit",
  "media.publish",
]);

const trimRequired = (value: string, field: string): string => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 512 || trimmed.includes("\n") || trimmed.includes("\r")) throw new ApprovalPolicyError(`${field} is invalid.`);
  return trimmed;
};

const normalizeAction = (action: AgentActionRequest): AgentActionRequest => {
  if (!knownActionKinds.has(action.kind)) throw new ApprovalPolicyError("action kind is invalid.");
  if (!["low", "medium", "high", "critical"].includes(action.risk)) throw new ApprovalPolicyError("risk tier is invalid.");
  return {
    actionId: trimRequired(action.actionId, "actionId"),
    sessionId: trimRequired(action.sessionId, "sessionId"),
    kind: action.kind,
    risk: action.risk,
    scope: trimRequired(action.scope, "scope"),
    idempotencyKey: action.idempotencyKey ? trimRequired(action.idempotencyKey, "idempotencyKey") : undefined,
  };
};

const actionKey = (action: AgentActionRequest): string => JSON.stringify([
  action.actionId,
  action.sessionId,
  action.kind,
  action.risk,
  action.scope,
  action.idempotencyKey ?? null,
]);

const isApprovalRequired = (action: AgentActionRequest): boolean => action.risk !== "low" || approvalRequiredKinds.has(action.kind);

export class ApprovalPolicyError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ApprovalPolicyError";
  }
}

export class InMemoryApprovalWorkflow implements ApprovalWorkflowPort {
  private readonly tickets = new Map<string, ApprovalTicket>();
  private readonly actionToApproval = new Map<string, string>();

  public constructor(
    private readonly dependencies: Pick<ApplicationDependencies, "approvals" | "events" | "clock" | "ids">,
    private readonly audit: AuditTrail,
  ) {}

  public authorize(input: AgentActionRequest, requestedApprovalId?: string): AgentAuthorizationDecision {
    const action = normalizeAction(input);
    const correlationId = this.dependencies.ids.next("correlation");

    if (requestedApprovalId) {
      const ticket = this.tickets.get(requestedApprovalId);
      if (!ticket || actionKey(ticket.action) !== actionKey(action)) {
        const reason = "Approval ticket does not match the requested action.";
        this.appendAudit({ action, correlationId, decision: "denied", reason });
        return { decision: "denied", correlationId, reason };
      }
      if (ticket.status !== "approved") {
        const reason = `Approval ticket is ${ticket.status}; execution is denied.`;
        this.appendAudit({ action, correlationId, decision: "denied", approvalId: ticket.approvalId, reason });
        return { decision: "denied", correlationId, approvalId: ticket.approvalId, reason };
      }
      const reason = "Human approval ticket is valid for this action.";
      this.appendAudit({ action, correlationId, decision: "approved", approvalId: ticket.approvalId, reason });
      return { decision: "allowed", correlationId, reason };
    }

    if (!isApprovalRequired(action)) {
      const reason = "Low-risk action is allowed by the default policy.";
      this.appendAudit({ action, correlationId, decision: "allowed", reason });
      return { decision: "allowed", correlationId, reason };
    }

    const key = actionKey(action);
    const existingApprovalId = this.actionToApproval.get(key);
    if (existingApprovalId) {
      const reason = "A human approval request already exists for this action.";
      this.appendAudit({ action, correlationId, decision: "approval_required", approvalId: existingApprovalId, reason });
      return { decision: "approval_required", correlationId, approvalId: existingApprovalId, reason };
    }

    const createdAt = this.dependencies.clock.now();
    const id = this.dependencies.ids.next("approval");
    const ticket: ApprovalTicket = {
      approvalId: id,
      correlationId,
      action,
      status: "requested",
      createdAt,
    };
    this.tickets.set(id, ticket);
    this.actionToApproval.set(key, id);
    const entity = createApproval({
      id,
      sessionId: sessionId(action.sessionId),
      action: action.kind,
      risk: action.risk,
      scope: action.scope,
      now: createdAt,
    });
    this.dependencies.approvals.save(entity);
    this.dependencies.events.publish({ type: "ApprovalRequested", approvalId: entity.id, sessionId: entity.sessionId, occurredAt: createdAt });
    const reason = "Action requires explicit human approval before execution.";
    this.appendAudit({ action, correlationId, decision: "approval_required", approvalId: id, reason });
    return { decision: "approval_required", correlationId, approvalId: id, reason };
  }

  public get(approvalIdValue: string): ApprovalTicket | undefined {
    return this.tickets.get(approvalIdValue);
  }

  public resolve(approvalIdValue: string, decision: "approved" | "denied"): ApprovalTicket {
    const current = this.tickets.get(approvalIdValue);
    if (!current) throw new ApprovalPolicyError(`Approval ${approvalIdValue} was not found.`);
    if (current.status !== "requested") throw new ApprovalPolicyError(`Approval ${approvalIdValue} is already ${current.status}.`);
    const currentEntity = this.dependencies.approvals.get(approvalId(approvalIdValue));
    if (!currentEntity) throw new ApprovalPolicyError(`Approval ${approvalIdValue} repository record was not found.`);
    const resolvedAt = this.dependencies.clock.now();
    const entity = resolveApproval(currentEntity, decision);
    this.dependencies.approvals.save(entity);
    this.dependencies.events.publish({ type: "ApprovalResolved", approvalId: entity.id, decision, occurredAt: resolvedAt });
    const resolved: ApprovalTicket = { ...current, status: decision, resolvedAt };
    this.tickets.set(approvalIdValue, resolved);
    this.appendAudit({
      action: resolved.action,
      correlationId: resolved.correlationId,
      decision,
      approvalId: approvalIdValue,
      reason: `Human approval decision: ${decision}.`,
    });
    return resolved;
  }

  private appendAudit(input: {
    action: AgentActionRequest;
    correlationId: string;
    decision: AuditRecord["decision"];
    approvalId?: string;
    reason: string;
  }): void {
    this.audit.append({
      id: this.dependencies.ids.next("audit"),
      occurredAt: this.dependencies.clock.now(),
      correlationId: input.correlationId,
      actionId: input.action.actionId,
      sessionId: input.action.sessionId,
      kind: input.action.kind,
      risk: input.action.risk,
      decision: input.decision,
      approvalId: input.approvalId,
      scope: input.action.scope,
      reason: input.reason,
    });
  }
}
