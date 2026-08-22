import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createEmbeddedApplication } from "./composition.js";
import { OllamaProviderAdapter } from "./infrastructure/local-http-provider.js";
import { FixtureProviderAdapter } from "./infrastructure/fixture-provider.js";
import type { ProviderManifest } from "./application/provider-contracts.js";
import { defaultLocalProviderConfig } from "./application/provider-policy.js";

const migrationsPath = join(process.cwd(), "db", "migrations");

test("composition keeps the lightweight in-memory backend as the default", () => {
  const application = createEmbeddedApplication();
  try {
    assert.equal(application.storageKind, "memory");
    assert.equal(application.sqlite, undefined);
    assert.equal(application.storageFallbackReason, undefined);
    assert.equal(application.resourcePolicy.profile, "low_memory");
  } finally {
    application.close();
    application.close();
  }
});

test("composition registers explicitly provided local providers without probing them at startup", () => {
  let fetchCalls = 0;
  const provider = new OllamaProviderAdapter({
    baseUrl: "http://127.0.0.1:11434",
    modelId: "local-model",
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response(JSON.stringify({ models: [] }), { status: 200 });
    },
  });
  const application = createEmbeddedApplication({ providers: [provider] });
  try {
    assert.deepEqual(application.providerGateway.listProviders().map((manifest) => manifest.id), ["ollama"]);
    assert.equal(fetchCalls, 0);
  } finally {
    application.close();
  }
});

test("composition registers the OpenCode SDK provider only when opted in and does not probe at startup", () => {
  let fetchCalls = 0;
  const application = createEmbeddedApplication({
    openCode: {
      baseUrl: "http://127.0.0.1:4096",
      modelId: "local-model",
      fetchImpl: async () => {
        fetchCalls += 1;
        return new Response(JSON.stringify({ healthy: true }), { status: 200 });
      },
    },
  });
  try {
    assert.deepEqual(application.providerGateway.listProviders().map((manifest) => manifest.id), ["opencode"]);
    assert.equal(fetchCalls, 0);
  } finally {
    application.close();
  }
});

test("composition registers Hermes ACP only when opted in and does not spawn at startup", () => {
  let spawnCalls = 0;
  const spawnImpl = ((..._args: never[]) => {
    spawnCalls += 1;
    throw new Error("Hermes worker must not spawn during composition.");
  }) as unknown as typeof spawn;
  const application = createEmbeddedApplication({ hermes: { workspaceRoot: process.cwd(), spawnImpl } });
  try {
    assert.deepEqual(application.providerGateway.listProviders().map((manifest) => manifest.id), ["hermes"]);
    assert.equal(spawnCalls, 0);
  } finally {
    application.close();
  }
});

test("composition routes a plan-less WorkCycle through the selected local provider and stops at Human Gate", async () => {
  const root = await mkdtemp(join(tmpdir(), "osamah-composition-provider-planner-"));
  const sourcePath = join(root, "app.ts");
  await writeFile(sourcePath, "export const value = 1;\n", "utf8");
  const manifest: ProviderManifest = {
    id: "ollama",
    label: "Ollama fixture",
    transport: "fixture",
    privacy: "local",
    offline: true,
    capabilities: ["text", "structured_output"],
    models: [{ id: "fixture-model", capabilities: ["text", "structured_output"], contextWindow: 4096, streaming: false, offline: true, estimatedLatencyMs: 1 }],
  };
  const provider = new FixtureProviderAdapter({
    manifest,
    responseText: JSON.stringify({ summary: "Generated safely", steps: [{ id: "review", title: "Review", description: "Review bounded context." }] }),
  });
  const config = { ...defaultLocalProviderConfig("ollama", "fixture-model"), enabled: true };
  const application = createEmbeddedApplication({ providers: [provider], providerConfigs: [config] });
  try {
    const result = await application.agentWorkCycle.start({
      cycleId: "cycle-provider-planner",
      sessionId: "session-provider-planner",
      rootPath: root,
      goal: "Update the application safely",
      constraints: ["Do not run project scripts"],
      targetedPaths: ["app.ts"],
      providerId: "ollama",
      modelId: "fixture-model",
      offlineMode: true,
      patch: { proposalId: "patch-provider-planner", operations: [{ relativePath: "app.ts", mode: "update", content: "export const value = 2;\n" }] },
    });
    assert.equal(result.cycle.stage, "waiting_approval");
    assert.equal(result.plan.summary, "Generated safely");
    assert.equal(provider.requests.length, 1);
    assert.equal(provider.requests[0]?.providerId, "ollama");
    assert.equal(provider.requests[0]?.modelId, "fixture-model");
    assert.equal(application.humanGate.listPending(10).length, 1);
    assert.equal(await readFile(sourcePath, "utf8"), "export const value = 1;\n");
  } finally {
    application.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("composition opts into SQLite and preserves workspace data across restart", async () => {
  const root = await mkdtemp(join(tmpdir(), "osamah-composition-sqlite-"));
  const databasePath = join(root, "profile.sqlite");
  const storage = { kind: "sqlite" as const, databasePath, migrationsPath };
  try {
    const first = createEmbeddedApplication({ storage });
    const workspace = first.useCases.openWorkspace({ name: "Persistent workspace", rootPath: root });
    assert.equal(first.storageKind, "sqlite");
    assert.ok(first.sqlite);
    first.close();

    const second = createEmbeddedApplication({ storage });
    try {
      assert.deepEqual(second.dependencies.workspaces.get(workspace.id), workspace);
      assert.equal(second.storageKind, "sqlite");
    } finally {
      second.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("composition hydrates pending approval tickets after SQLite restart", async () => {
  const root = await mkdtemp(join(tmpdir(), "osamah-composition-approval-"));
  const storage = { kind: "sqlite" as const, databasePath: join(root, "profile.sqlite"), migrationsPath };
  const action = { actionId: "action-hydrate", sessionId: "session-hydrate", kind: "filesystem.write" as const, risk: "high" as const, scope: "src/app.ts", idempotencyKey: "idem-hydrate" };
  try {
    const first = createEmbeddedApplication({ storage });
    const workspace = first.useCases.openWorkspace({ name: "Approval workspace", rootPath: root });
    const session = first.useCases.createSession(workspace.id);
    const authorization = first.approvalWorkflow.authorize({ ...action, sessionId: session.id });
    assert.equal(authorization.decision, "approval_required");
    if (authorization.decision !== "approval_required") throw new Error("Expected approval to be required.");
    const approvalId = authorization.approvalId;
    assert.equal(first.humanGate.listPending(10).length, 1);
    first.close();

    const second = createEmbeddedApplication({ storage });
    try {
      const hydrated = second.humanGate.listPending(10);
      assert.equal(hydrated.length, 1);
      assert.equal(hydrated[0]?.approvalId, approvalId);
      assert.deepEqual(hydrated[0]?.action, { ...action, sessionId: session.id });
      const duplicate = second.approvalWorkflow.authorize({ ...action, sessionId: session.id });
      assert.deepEqual(duplicate, { decision: "approval_required", correlationId: duplicate.correlationId, approvalId, reason: "A human approval request already exists for this action." });
      const resolved = second.humanGate.decide(approvalId, "approved");
      assert.equal(resolved.status, "approved");
    } finally {
      second.close();
    }

    const third = createEmbeddedApplication({ storage });
    try {
      assert.deepEqual(third.humanGate.listPending(10), []);
      assert.equal(third.approvalWorkflow.get(approvalId)?.status, "approved");
    } finally {
      third.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("composition uses a standard profile path and releases its exclusive lock", async () => {
  const root = await mkdtemp(join(tmpdir(), "osamah-composition-profile-"));
  const storage = { kind: "sqlite-profile" as const, userDataDirectory: root, profileId: "workspace", migrationsPath };
  try {
    const first = createEmbeddedApplication({ storage });
    assert.equal(first.storageKind, "sqlite");
    assert.equal(first.profilePaths?.databasePath, join(root, "profiles", "workspace", "studio.sqlite"));
    assert.throws(() => createEmbeddedApplication({ storage }), /already locked/);
    first.close();

    const second = createEmbeddedApplication({ storage });
    try {
      assert.equal(second.storageKind, "sqlite");
      assert.ok(second.profilePaths);
    } finally {
      second.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("composition falls back to memory only when explicitly allowed", async () => {
  const root = await mkdtemp(join(tmpdir(), "osamah-composition-fallback-"));
  const databasePath = join(root, "not-a-database");
  await mkdir(databasePath);
  try {
    const fallback = createEmbeddedApplication({ storage: { kind: "sqlite", databasePath, migrationsPath, allowFallback: true } });
    try {
      assert.equal(fallback.storageKind, "memory");
      assert.equal(fallback.sqlite, undefined);
      assert.equal(fallback.storageFallbackReason, "sqlite_initialization_failed");
    } finally {
      fallback.close();
    }
    assert.throws(() => createEmbeddedApplication({ storage: { kind: "sqlite", databasePath, migrationsPath } }));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
