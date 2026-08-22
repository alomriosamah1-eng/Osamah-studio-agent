import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createEmbeddedApplication } from "./composition.js";
import { InMemoryEventBus } from "./infrastructure/in-memory.js";

const sha256 = (content: string): string => createHash("sha256").update(content, "utf8").digest("hex");

const plan = {
  summary: "Update the selected source file safely.",
  steps: [{ id: "inspect", title: "Inspect", description: "Read only the selected file." }],
};

const makeRequest = (rootPath: string, expectedSha256?: string) => ({
  cycleId: "cycle-1",
  sessionId: "session-1",
  rootPath,
  goal: "Update the selected source file safely.",
  constraints: ["Do not execute project scripts."],
  targetedPaths: ["src/example.ts"],
  plan,
  patch: {
    proposalId: "patch-1",
    operations: [{ relativePath: "src/example.ts", mode: "update" as const, content: "export const value = 2;\n", expectedSha256 }],
  },
});

const createFixture = async (prefix: string): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), prefix));
  await mkdir(join(root, "src"));
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "cycle-fixture", version: "1.0.0" }));
  await writeFile(join(root, "src", "example.ts"), "export const value = 1;\n");
  return root;
};

test("agent work cycle waits for approval, checkpoints, applies, and emits lifecycle events", async () => {
  const root = await createFixture("osamah-cycle-");
  const app = createEmbeddedApplication();
  try {
    const waiting = await app.agentWorkCycle.start(makeRequest(root, sha256("export const value = 1;\n")));
    assert.equal(waiting.cycle.stage, "waiting_approval");
    assert.ok(waiting.cycle.approvalId);
    assert.equal(await readFile(join(root, "src", "example.ts"), "utf8"), "export const value = 1;\n");
    app.approvalWorkflow.resolve(waiting.cycle.approvalId!, "approved");

    const resumed = await app.agentWorkCycle.start({ ...makeRequest(root, sha256("export const value = 1;\n")), approvalId: waiting.cycle.approvalId });
    assert.equal(resumed.cycle.stage, "applied", resumed.cycle.error ?? "no error");
    assert.ok(resumed.checkpoint?.checkpointId);
    assert.equal(await readFile(join(root, "src", "example.ts"), "utf8"), "export const value = 2;\n");
    assert.equal(app.checkpointStore.list(1).length, 1);
    const events = app.dependencies.events as InMemoryEventBus;
    assert.equal(events.history.filter((event) => event.type === "WorkCycleStarted").length, 1);
    assert.equal(events.history.filter((event) => event.type === "WorkCycleWaitingApproval").length, 1);
    assert.equal(events.history.filter((event) => event.type === "WorkCycleCheckpointed").length, 1);
    assert.equal(events.history.filter((event) => event.type === "WorkCycleApplied").length, 1);
  } finally {
    app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("work cycle resume rejects provider selection changes after approval", async () => {
  const root = await createFixture("osamah-cycle-provider-resume-");
  const app = createEmbeddedApplication();
  try {
    const waiting = await app.agentWorkCycle.start({ ...makeRequest(root, sha256("export const value = 1;\n")), providerId: "ollama", modelId: "model-a", offlineMode: true });
    assert.equal(waiting.cycle.stage, "waiting_approval");
    assert.ok(waiting.cycle.approvalId);
    app.approvalWorkflow.resolve(waiting.cycle.approvalId!, "approved");
    await assert.rejects(app.agentWorkCycle.start({ ...makeRequest(root, sha256("export const value = 1;\n")), providerId: "ollama", modelId: "model-b", offlineMode: true, approvalId: waiting.cycle.approvalId }), /provider selection does not match/);
    assert.equal(await readFile(join(root, "src", "example.ts"), "utf8"), "export const value = 1;\n");
  } finally {
    app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("denied work cycle never applies its patch", async () => {
  const root = await createFixture("osamah-cycle-denied-");
  const app = createEmbeddedApplication();
  try {
    const waiting = await app.agentWorkCycle.start(makeRequest(root, sha256("export const value = 1;\n")));
    assert.equal(waiting.cycle.stage, "waiting_approval");
    assert.ok(waiting.cycle.approvalId);
    app.approvalWorkflow.resolve(waiting.cycle.approvalId!, "denied");
    const denied = await app.agentWorkCycle.start({ ...makeRequest(root, sha256("export const value = 1;\n")), approvalId: waiting.cycle.approvalId });
    assert.equal(denied.cycle.stage, "denied");
    assert.equal(await readFile(join(root, "src", "example.ts"), "utf8"), "export const value = 1;\n");
  } finally {
    app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("planner critique rejects a malformed plan before approval or filesystem mutation", async () => {
  const root = await createFixture("osamah-cycle-critic-");
  const app = createEmbeddedApplication();
  try {
    const rejected = await app.agentWorkCycle.start({
      ...makeRequest(root, sha256("export const value = 1;\n")),
      cycleId: "cycle-critic-rejected",
      plan: { summary: "Invalid duplicate plan", steps: [{ id: "same", title: "Same", description: "First" }, { id: "same", title: "Same", description: "Second" }] },
    });
    assert.equal(rejected.cycle.stage, "failed");
    assert.match(rejected.cycle.error ?? "", /Planner critique rejected the plan/);
    assert.equal(app.approvalWorkflow.listPending().length, 0);
    assert.equal(await readFile(join(root, "src", "example.ts"), "utf8"), "export const value = 1;\n");
  } finally {
    app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("patch conflict fails before approval and traversal never reaches the filesystem", async () => {
  const root = await createFixture("osamah-cycle-conflict-");
  const app = createEmbeddedApplication();
  try {
    const conflict = await app.agentWorkCycle.start(makeRequest(root, "0".repeat(64)));
    assert.equal(conflict.cycle.stage, "failed");
    assert.match(conflict.cycle.error ?? "", /expected source hash/);
    assert.equal(app.approvalWorkflow.get("approval-1" as never), undefined);

    const traversal = await app.agentWorkCycle.start({
      ...makeRequest(root, sha256("export const value = 1;\n")),
      cycleId: "cycle-traversal",
      patch: { proposalId: "patch-traversal", operations: [{ relativePath: "../escape.ts", mode: "create" as const, content: "unsafe" }] },
      targetedPaths: [],
    });
    assert.equal(traversal.cycle.stage, "failed");
    assert.match(traversal.cycle.error ?? "", /Unsafe patch path|escapes root/);
  } finally {
    app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("an empty patch creates a checkpoint without entering the approval path", async () => {
  const root = await createFixture("osamah-cycle-noop-");
  const app = createEmbeddedApplication();
  try {
    const result = await app.agentWorkCycle.start({
      ...makeRequest(root),
      cycleId: "cycle-noop",
      targetedPaths: ["src/example.ts"],
      patch: { proposalId: "patch-noop", operations: [] },
    });
    assert.equal(result.cycle.stage, "checkpointed");
    assert.ok(result.checkpoint?.checkpointId);
    assert.equal(app.agentRuntime.list().length, 0);
  } finally {
    app.close();
    await rm(root, { recursive: true, force: true });
  }
});
