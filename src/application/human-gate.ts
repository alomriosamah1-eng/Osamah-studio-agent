import type { ApprovalTicket, ApprovalWorkflowPort } from "./agent-contracts.js";

export type HumanGateDecision = "approved" | "denied";

export interface HumanGatePort {
  listPending(limit?: number): readonly ApprovalTicket[];
  get(approvalId: string): ApprovalTicket | undefined;
  decide(approvalId: string, decision: HumanGateDecision): ApprovalTicket;
}

export class HumanGatePolicyError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "HumanGatePolicyError";
  }
}

const validDecision = (value: string): value is HumanGateDecision => value === "approved" || value === "denied";

export class InMemoryHumanGate implements HumanGatePort {
  public constructor(private readonly workflow: ApprovalWorkflowPort) {}

  public listPending(limit = 64): readonly ApprovalTicket[] {
    return this.workflow.listPending(limit);
  }

  public get(approvalId: string): ApprovalTicket | undefined {
    const trimmed = approvalId.trim();
    if (!trimmed || trimmed.length > 256 || trimmed.includes("\u0000")) throw new HumanGatePolicyError("approvalId is invalid.");
    return this.workflow.get(trimmed);
  }

  public decide(approvalId: string, decision: HumanGateDecision): ApprovalTicket {
    const trimmed = approvalId.trim();
    if (!trimmed || trimmed.length > 256 || trimmed.includes("\u0000")) throw new HumanGatePolicyError("approvalId is invalid.");
    if (!validDecision(decision)) throw new HumanGatePolicyError("Human Gate decision is invalid.");
    const ticket = this.workflow.get(trimmed);
    if (!ticket) throw new HumanGatePolicyError(`Approval ${trimmed} was not found.`);
    if (ticket.status !== "requested") throw new HumanGatePolicyError(`Approval ${trimmed} is already ${ticket.status}.`);
    return this.workflow.resolve(trimmed, decision);
  }
}
