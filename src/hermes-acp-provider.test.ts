import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { HermesAcpProviderAdapter } from "./infrastructure/hermes-acp-provider.js";

const fixturePath = join(process.cwd(), "fixtures", "hermes-acp", "mock-agent.mjs");

const request = (sessionId: string, input: string) => ({
  requestId: `request-${sessionId}-${input}`,
  sessionId,
  capability: "text" as const,
  input,
  privacy: "remote_allowed" as const,
  sideEffect: "none" as const,
});

test("Hermes ACP adapter uses a real stdio child, reuses sessions, and reads only inside workspace", async () => {
  const root = await mkdtemp(join(tmpdir(), "osamah-hermes-acp-"));
  const outsidePath = join(root, "..", "hermes-acp-outside.txt");
  await writeFile(join(root, "note.txt"), "safe-note\n", "utf8");
  await writeFile(outsidePath, "outside-note\n", "utf8");
  const adapter = new HermesAcpProviderAdapter({
    workspaceRoot: root,
    command: process.execPath,
    args: [fixturePath],
    modelId: "hermes-acp",
    timeoutMs: 10_000,
  });
  try {
    const health = await adapter.health();
    assert.equal(health.status, "healthy");

    const first = await adapter.invoke(request("session-1", "hello"));
    assert.equal(first.providerId, "hermes");
    assert.equal(first.text, "fixture:1:hello");

    const second = await adapter.invoke(request("session-1", "again"));
    assert.equal(second.text, "fixture:2:again");

    const read = await adapter.invoke(request("session-1", "read"));
    assert.equal(read.text, "read:safe-note\n");

    const outside = await adapter.invoke(request("session-1", "read-outside"));
    assert.equal(outside.text, "read-denied");
  } finally {
    await adapter.close();
    await rm(outsidePath, { force: true });
    await rm(root, { recursive: true, force: true });
  }
});

test("Hermes ACP adapter rejects mutation, model mismatch, and unsafe worker configuration", async () => {
  const adapter = new HermesAcpProviderAdapter({ workspaceRoot: process.cwd(), command: process.execPath, args: [fixturePath] });
  await assert.rejects(
    adapter.invoke({ ...request("session-2", "mutate"), sideEffect: "mutation" }),
    (error: unknown) => error instanceof Error && error.name === "ProviderGatewayError" && error.message.includes("mutation"),
  );
  await assert.rejects(
    adapter.invoke({ ...request("session-2", "wrong-model"), modelId: "other-model" }),
    (error: unknown) => error instanceof Error && error.name === "ProviderGatewayError" && error.message.includes("model mismatch"),
  );
  assert.throws(() => new HermesAcpProviderAdapter({ workspaceRoot: "relative-workspace" }), /absolute safe path/);
  await adapter.close();
});
