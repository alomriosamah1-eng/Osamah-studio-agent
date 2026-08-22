import assert from "node:assert/strict";
import test from "node:test";
import { AgentTimeoutError, BoundedAgentRuntime } from "./application/agent-runtime.js";
import { ResourcePolicy } from "./application/resource-policy.js";

test("bounded agent runtime runs one job at a time and preserves result ordering", async () => {
  const runtime = new BoundedAgentRuntime(new ResourcePolicy("low_memory"));
  let releaseFirst: (() => void) | undefined;
  const first = runtime.submit({ jobId: "agent-1", run: () => new Promise<string>((resolve) => { releaseFirst = () => resolve("first"); }) });
  const second = runtime.submit({ jobId: "agent-2", run: async () => "second" });
  assert.equal(runtime.resourceSnapshot().activeAgentJobs, 1);
  assert.equal(runtime.inspect("agent-2")?.state, "queued");
  releaseFirst?.();
  assert.equal(await first, "first");
  assert.equal(await second, "second");
  assert.equal(runtime.resourceSnapshot().activeAgentJobs, 0);
  assert.equal(runtime.inspect("agent-1")?.state, "completed");
  assert.equal(runtime.inspect("agent-2")?.state, "completed");
});

test("bounded agent runtime cancels queued work without starting it", async () => {
  const runtime = new BoundedAgentRuntime(new ResourcePolicy("low_memory"));
  let release: (() => void) | undefined;
  const running = runtime.submit({ jobId: "agent-running", run: () => new Promise<void>((resolve) => { release = resolve; }) });
  const queued = runtime.submit({ jobId: "agent-queued", run: async () => "never" });
  assert.equal(runtime.cancel("agent-queued"), true);
  await assert.rejects(queued, /was cancelled/);
  assert.equal(runtime.inspect("agent-queued")?.state, "cancelled");
  release?.();
  await running;
});

test("bounded agent runtime aborts cooperative work on timeout", async () => {
  const runtime = new BoundedAgentRuntime(new ResourcePolicy("low_memory"));
  const timedOut = runtime.submit({
    jobId: "agent-timeout",
    timeoutMs: 5,
    run: (signal) => new Promise<string>((resolve) => {
      signal.addEventListener("abort", () => resolve("cooperative-stop"), { once: true });
    }),
  });
  await assert.rejects(timedOut, AgentTimeoutError);
  assert.equal(runtime.inspect("agent-timeout")?.state, "timed_out");
  assert.equal(runtime.resourceSnapshot().activeAgentJobs, 0);
});

test("bounded agent runtime keeps only low-memory history", async () => {
  const runtime = new BoundedAgentRuntime(new ResourcePolicy("low_memory"));
  for (let index = 0; index < 40; index += 1) await runtime.submit({ jobId: `agent-history-${index}`, run: async () => index });
  assert.equal(runtime.list().length, 32);
  assert.equal(runtime.inspect("agent-history-0"), undefined);
  assert.equal(runtime.inspect("agent-history-39")?.state, "completed");
});
