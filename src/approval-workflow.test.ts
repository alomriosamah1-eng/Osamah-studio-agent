import assert from "node:assert/strict";
import test from "node:test";
import { AgentAuthorizationError, BoundedAgentRuntime } from "./application/agent-runtime.js";
import { InMemoryApprovalWorkflow } from "./application/approval-workflow.js";
import { createFoundation } from "./composition.js";
import { InMemoryAuditTrail, type InMemoryEventBus } from "./infrastructure/in-memory.js";
import { ResourcePolicy } from "./application/resource-policy.js";

const highRiskAction = {
  actionId: "write-1",
  sessionId: "session-1",
  kind: "filesystem.write" as const,
  risk: "high" as const,
  scope: "src/example.ts",
};

test("approval workflow allows low-risk reads and audits the decision", () => {
  const foundation = createFoundation();
  const audit = new InMemoryAuditTrail();
  const workflow = new InMemoryApprovalWorkflow(foundation.dependencies, audit);
  const decision = workflow.authorize({
    actionId: "read-1",
    sessionId: "session-1",
    kind: "filesystem.read",
    risk: "low",
    scope: "src/index.ts",
  });
  assert.equal(decision.decision, "allowed");
  assert.equal(audit.list(1)[0]?.decision, "allowed");
  assert.equal(foundation.dependencies.approvals.get("approval-1" as never), undefined);
});

test("approval workflow creates a typed ticket, persists it, and resumes only after approval", () => {
  const foundation = createFoundation();
  const audit = new InMemoryAuditTrail();
  const workflow = new InMemoryApprovalWorkflow(foundation.dependencies, audit);
  const requested = workflow.authorize(highRiskAction);
  assert.equal(requested.decision, "approval_required");
  if (requested.decision !== "approval_required") return;
  assert.equal(workflow.get(requested.approvalId)?.status, "requested");
  assert.equal(foundation.dependencies.approvals.get(requested.approvalId as never)?.status, "requested");

  const repeated = workflow.authorize(highRiskAction);
  assert.equal(repeated.decision, "approval_required");
  if (repeated.decision !== "approval_required") return;
  assert.equal(repeated.approvalId, requested.approvalId);
  assert.equal(repeated.reason, "A human approval request already exists for this action.");
  const resolved = workflow.resolve(requested.approvalId, "approved");
  assert.equal(resolved.status, "approved");
  assert.equal(foundation.dependencies.approvals.get(requested.approvalId as never)?.status, "approved");
  const allowed = workflow.authorize(highRiskAction, requested.approvalId);
  assert.equal(allowed.decision, "allowed");
  assert.equal(audit.list().some((record) => record.decision === "approved"), true);
  const events = foundation.dependencies.events as InMemoryEventBus;
  assert.equal(events.history.filter((event) => event.type === "ApprovalRequested").length, 1);
  assert.equal(events.history.filter((event) => event.type === "ApprovalResolved").length, 1);
});

test("approval workflow denies mismatched and already denied actions", () => {
  const foundation = createFoundation();
  const audit = new InMemoryAuditTrail();
  const workflow = new InMemoryApprovalWorkflow(foundation.dependencies, audit);
  const requested = workflow.authorize(highRiskAction);
  assert.equal(requested.decision, "approval_required");
  if (requested.decision !== "approval_required") return;
  const mismatch = workflow.authorize({ ...highRiskAction, scope: "src/other.ts" }, requested.approvalId);
  assert.equal(mismatch.decision, "denied");
  workflow.resolve(requested.approvalId, "denied");
  const denied = workflow.authorize(highRiskAction, requested.approvalId);
  assert.equal(denied.decision, "denied");
  assert.equal(denied.approvalId, requested.approvalId);
  assert.throws(() => workflow.resolve(requested.approvalId, "approved"), /already denied/);
});

test("submitGuarded blocks before queueing and runs after the matching approval", async () => {
  const foundation = createFoundation();
  const audit = new InMemoryAuditTrail();
  const workflow = new InMemoryApprovalWorkflow(foundation.dependencies, audit);
  const runtime = new BoundedAgentRuntime(new ResourcePolicy("low_memory"), workflow);
  const request = { jobId: "guarded-job", run: async () => "completed" };
  const blocked = runtime.submitGuarded(request, highRiskAction);
  await assert.rejects(blocked, (error: unknown) => error instanceof AgentAuthorizationError && error.decision === "approval_required");
  assert.equal(runtime.inspect("guarded-job"), undefined);
  const approval = workflow.authorize(highRiskAction);
  assert.equal(approval.decision, "approval_required");
  if (approval.decision !== "approval_required") return;
  workflow.resolve(approval.approvalId, "approved");
  const result = await runtime.submitGuarded(request, highRiskAction, approval.approvalId);
  assert.equal(result, "completed");
  assert.equal(runtime.inspect("guarded-job")?.state, "completed");
  assert.equal(audit.list().some((record) => record.decision === "approved"), true);
});

test("guarded actions fail closed when no authorization port is configured", async () => {
  const runtime = new BoundedAgentRuntime(new ResourcePolicy("low_memory"));
  const blocked = runtime.submitGuarded({ jobId: "unconfigured-job", run: async () => "never" }, highRiskAction);
  await assert.rejects(blocked, (error: unknown) => error instanceof AgentAuthorizationError && error.decision === "denied");
  assert.equal(runtime.inspect("unconfigured-job"), undefined);
});
