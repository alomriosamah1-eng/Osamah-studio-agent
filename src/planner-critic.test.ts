import assert from "node:assert/strict";
import { test } from "node:test";
import { assertPlanAccepted, BoundedPlanCritic, DeterministicPlannerCritic, LlmPlanner, LlmPlannerError, ProviderBackedPlannerCritic, type PlannerRequest } from "./application/planner-critic.js";
import { ProviderGateway } from "./application/provider-gateway.js";
import type { ProviderManifest } from "./application/provider-contracts.js";
import { FixtureProviderAdapter } from "./infrastructure/fixture-provider.js";
import type { ProjectContextSnapshot, TargetedContextFile } from "./application/project-context.js";

const context = (overrides: Partial<ProjectContextSnapshot> = {}): ProjectContextSnapshot => ({
  rootPath: "/tmp/workspace",
  generatedAt: "2026-08-22T11:00:00.000Z",
  files: [{ relativePath: "src/app.ts", extension: ".ts" }],
  manifests: [],
  git: { isRepository: false, stagedCount: 0, unstagedCount: 0, untrackedCount: 0, conflictedCount: 0 },
  truncated: false,
  warnings: [],
  ...overrides,
});

const targeted = (relativePath = "src/app.ts", content = "export const app = true;", bytes = Buffer.byteLength(content, "utf8")): TargetedContextFile => ({ relativePath, content, bytes, sha256: "a".repeat(64) });

const request = (overrides: Partial<PlannerRequest> = {}): PlannerRequest => ({
  goal: "Improve the workspace safely",
  constraints: ["Do not run project scripts"],
  context: context(),
  targetedFiles: [targeted()],
  ...overrides,
});

test("deterministic planner creates a bounded reviewable plan", () => {
  const result = new DeterministicPlannerCritic().review(request());
  assert.equal(result.critique.accepted, true);
  assert.equal(result.plan.steps.length, 4);
  assert.equal(result.plan.steps[0]?.id, "context");
  assert.equal(result.plan.steps.at(-1)?.id, "verify");
  assertPlanAccepted(result.critique);
});

test("critic keeps truncated context reviewable with a warning", () => {
  const result = new DeterministicPlannerCritic().review(request({ context: context({ truncated: true, warnings: ["Index was bounded."] }) }));
  assert.equal(result.critique.accepted, true);
  assert.deepEqual(result.critique.issues.map((issue) => issue.code), ["context_truncated"]);
  assert.equal(result.plan.steps[2]?.id, "uncertainty");
});

test("critic rejects unsafe targeted paths and mismatched byte counts", () => {
  const badRequest = request({ targetedFiles: [targeted("../secret.txt", "secret", 999)] });
  const plan = new DeterministicPlannerCritic().review(badRequest).plan;
  const critique = new BoundedPlanCritic().critique({ request: badRequest, plan });
  assert.equal(critique.accepted, false);
  assert.equal(critique.issues.some((issue) => issue.code === "unsafe_target" && issue.severity === "blocking"), true);
  assert.equal(critique.issues.some((issue) => issue.code === "context_mismatch" && issue.severity === "blocking"), true);
  assert.throws(() => assertPlanAccepted(critique), /rejected the plan/);
});

test("LLM planner routes the bounded prompt to the selected offline provider and parses strict JSON", async () => {
  const providerManifest: ProviderManifest = {
    id: "ollama",
    label: "Ollama fixture",
    transport: "fixture",
    privacy: "local",
    offline: true,
    capabilities: ["text", "structured_output"],
    models: [{ id: "fixture-model", capabilities: ["text", "structured_output"], contextWindow: 4096, streaming: false, offline: true, estimatedLatencyMs: 1 }],
  };
  const fixture = new FixtureProviderAdapter({
    manifest: providerManifest,
    responseText: JSON.stringify({ summary: "Fixture plan", steps: [{ id: "inspect", title: "Inspect", description: "Inspect bounded context." }] }),
  });
  const planner = new LlmPlanner({ providerGateway: new ProviderGateway([fixture]), nextRequestId: () => "planner-request-1" });
  const result = await planner.plan({ ...request(), requestId: "cycle-1:planner", sessionId: "session-1", providerId: "ollama", modelId: "fixture-model", offlineMode: true });
  assert.equal(result.summary, "Fixture plan");
  assert.equal(result.steps[0]?.id, "inspect");
  assert.equal(fixture.requests.length, 1);
  assert.equal(fixture.requests[0]?.providerId, "ollama");
  assert.equal(fixture.requests[0]?.modelId, "fixture-model");
  assert.equal(fixture.requests[0]?.privacy, "local_only");
  assert.equal(fixture.requests[0]?.offlineMode, true);
  assert.equal(fixture.requests[0]?.sideEffect, "none");
});

test("LLM planner rejects malformed or fenced output before WorkCycle can mutate", async () => {
  const providerManifest: ProviderManifest = {
    id: "ollama",
    label: "Ollama fixture",
    transport: "fixture",
    privacy: "local",
    offline: true,
    capabilities: ["text", "structured_output"],
    models: [{ id: "fixture-model", capabilities: ["text", "structured_output"], contextWindow: 4096, streaming: false, offline: true, estimatedLatencyMs: 1 }],
  };
  const fixture = new FixtureProviderAdapter({ manifest: providerManifest, responseText: "```json {\"summary\":\"bad\"} ```" });
  const planner = new LlmPlanner({ providerGateway: new ProviderGateway([fixture]), nextRequestId: () => "planner-request-2" });
  await assert.rejects(planner.plan({ ...request(), providerId: "ollama", modelId: "fixture-model", offlineMode: true }), (error: unknown) => error instanceof LlmPlannerError);
});

test("provider-backed planner critic reviews generated plans without granting mutation authorization", async () => {
  const providerManifest: ProviderManifest = {
    id: "ollama",
    label: "Ollama fixture",
    transport: "fixture",
    privacy: "local",
    offline: true,
    capabilities: ["text", "structured_output"],
    models: [{ id: "fixture-model", capabilities: ["text", "structured_output"], contextWindow: 4096, streaming: false, offline: true, estimatedLatencyMs: 1 }],
  };
  const fixture = new FixtureProviderAdapter({
    manifest: providerManifest,
    responseText: JSON.stringify({ summary: "Safe plan", steps: [{ id: "review", title: "Review", description: "Review bounded context." }] }),
  });
  const planner = new LlmPlanner({ providerGateway: new ProviderGateway([fixture]), nextRequestId: () => "planner-request-3" });
  const reviewed = await new ProviderBackedPlannerCritic(planner).review({ ...request(), providerId: "ollama", modelId: "fixture-model", offlineMode: true });
  assert.equal(reviewed.critique.accepted, true);
  assert.equal(reviewed.plan.summary, "Safe plan");
  assert.equal(fixture.requests.length, 1);
});

test("critic rejects duplicate plan steps and never treats blocking issues as accepted", () => {
  const input = request();
  const plan = {
    summary: "duplicate",
    steps: [
      { id: "same", title: "Step", description: "One" },
      { id: "same", title: "Step", description: "Two" },
    ],
  };
  const critique = new BoundedPlanCritic().critique({ request: input, plan });
  assert.equal(critique.accepted, false);
  assert.equal(critique.issues.some((issue) => issue.code === "invalid_plan"), true);
});
