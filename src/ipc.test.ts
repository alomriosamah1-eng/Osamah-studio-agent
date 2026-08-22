import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEmbeddedApplication, createFoundation } from "./composition.js";
import { FilesystemProjectPreviewService } from "./application/project-preview-service.js";
import { FilesystemProjectScanner } from "./infrastructure/filesystem-project-scanner.js";
import { resolve } from "node:path";
import { InMemoryLightweightPreviewAdapter } from "./mobile/preview.js";
import { InMemoryEmbeddedSimulatorController } from "./mobile/embedded-controller.js";
import { InMemoryIpcTransport } from "./ipc/in-memory-transport.js";
import { registerEmbeddedSimulatorHandlers } from "./ipc/embedded-handlers.js";
import { buildProjectPreviewBundle } from "./mobile/preview-runtime.js";
import type { PreviewSession } from "./domain/entities.js";
import type { PreviewInspection, IpcResponse, PreviewProjectOpenResult } from "./ipc/contracts.js";
import type { ProjectContextSnapshot } from "./application/project-context.js";
import type { WorkCycleResult } from "./application/agent-work-cycle.js";

const setup = () => {
  const { useCases } = createFoundation();
  const profile = useCases.registerDeviceProfile({ id: "ipc-pixel", name: "IPC Pixel", platform: "android", osVersion: "15", width: 1080, height: 2424, dpi: 420 });
  const controller = new InMemoryEmbeddedSimulatorController(useCases, new InMemoryLightweightPreviewAdapter());
  controller.registerProfile(profile);
  const transport = new InMemoryIpcTransport();
  const projectPreviewService = new FilesystemProjectPreviewService(new FilesystemProjectScanner());
  registerEmbeddedSimulatorHandlers(transport, controller, projectPreviewService);
  return { profile, transport };
};

test("typed IPC starts and inspects embedded preview", async () => {
  const { profile, transport } = setup();
  const health = await transport.dispatch({ protocolVersion: 1, requestId: "health-1", correlationId: "c-1", method: "health.get", payload: {} });
  assert.equal(health.ok, true);
  const bundle = buildProjectPreviewBundle({ projectId: "ipc-fixture", rootPath: "/fixtures", entry: "app/index.tsx", files: {
    "app/index.tsx": `import { Text } from "react-native"; export default function App() { return <Text>IPC content</Text>; }`,
  } });
  const started = await transport.dispatch({ protocolVersion: 1, requestId: "start-1", correlationId: "c-1", method: "preview.start", payload: { deviceProfileId: profile.id, bundle } } as const) as IpcResponse<PreviewSession>;
  assert.equal(started.ok, true);
  if (!started.ok) return;
  const sessionId = started.result.id;
  const inspected = await transport.dispatch({ protocolVersion: 1, requestId: "inspect-1", correlationId: "c-1", method: "preview.inspect", payload: { sessionId } } as const) as IpcResponse<PreviewInspection>;
  assert.equal(inspected.ok, true);
  if (inspected.ok) {
    assert.equal(inspected.result.nativeFidelity, "compatibility");
    assert.equal(inspected.result.bundle?.sourceHash, bundle.sourceHash);
  }
  const refreshed = await transport.dispatch({ protocolVersion: 1, requestId: "refresh-1", correlationId: "c-1", method: "preview.refresh", payload: { sessionId, kind: "fast", bundle } } as const);
  assert.equal(refreshed.ok, true);
});

test("typed IPC opens a filesystem project and starts the embedded preview", async () => {
  const { profile, transport } = setup();
  const opened = await transport.dispatch({
    protocolVersion: 1,
    requestId: "open-project-1",
    correlationId: "c-project-1",
    method: "preview.openProject",
    payload: {
      projectId: "filesystem-ipc-fixture",
      rootPath: resolve("fixtures/mobile-expo"),
      deviceProfileId: profile.id,
      mode: "lightweight_web",
    },
  } as const) as IpcResponse<PreviewProjectOpenResult>;
  assert.equal(opened.ok, true);
  if (!opened.ok) return;
  assert.equal(opened.result.session.status, "ready");
  assert.equal(opened.result.bundle.projectId, "filesystem-ipc-fixture");
  assert.equal(opened.result.bundle.entry, "app/index.tsx");
  assert.equal(opened.result.bundle.moduleCount, 2);

  const inspected = await transport.dispatch({
    protocolVersion: 1,
    requestId: "inspect-project-1",
    correlationId: "c-project-1",
    method: "preview.inspect",
    payload: { sessionId: opened.result.session.id },
  } as const) as IpcResponse<PreviewInspection>;
  assert.equal(inspected.ok, true);
  if (inspected.ok) assert.equal(inspected.result.bundle?.projectId, "filesystem-ipc-fixture");
});

test("typed IPC rejects project entries that escape the selected root", async () => {
  const { profile, transport } = setup();
  const blocked = await transport.dispatch({
    protocolVersion: 1,
    requestId: "open-project-unsafe-1",
    correlationId: "c-project-unsafe-1",
    method: "preview.openProject",
    payload: {
      projectId: "unsafe-fixture",
      rootPath: resolve("fixtures/mobile-expo"),
      entry: "../package.json",
      deviceProfileId: profile.id,
    },
  } as const) as IpcResponse<PreviewProjectOpenResult>;
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.match(blocked.error.message, /Unsafe preview path/);
});

test("typed IPC exposes project context and a full guarded work cycle", async () => {
  const root = await mkdtemp(join(tmpdir(), "osamah-ipc-cycle-"));
  const app = createEmbeddedApplication();
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "package.json"), JSON.stringify({ name: "ipc-cycle-fixture", version: "1.0.0" }));
    await writeFile(join(root, "src", "example.ts"), "export const value = 1;\n");
    const context = await app.ipc.dispatch({ protocolVersion: 1, requestId: "context-1", correlationId: "ipc-cycle", method: "context.index", payload: { rootPath: root } } as const) as IpcResponse<ProjectContextSnapshot>;
    assert.equal(context.ok, true);
    if (context.ok) assert.equal(context.result.manifests[0]?.name, "ipc-cycle-fixture");

    const startPayload = {
      cycleId: "ipc-cycle-1",
      sessionId: "ipc-session-1",
      rootPath: root,
      goal: "Update the file through IPC.",
      constraints: ["Do not execute scripts."],
      targetedPaths: ["src/example.ts"],
      plan: { summary: "Update the file through IPC.", steps: [{ id: "read", title: "Read", description: "Read the selected file." }] },
      patch: { proposalId: "ipc-patch-1", operations: [{ relativePath: "src/example.ts", mode: "update" as const, content: "export const value = 2;\n" }] },
    };
    const waiting = await app.ipc.dispatch({ protocolVersion: 1, requestId: "cycle-start-1", correlationId: "ipc-cycle", method: "workCycle.start", payload: startPayload } as const) as IpcResponse<WorkCycleResult>;
    assert.equal(waiting.ok, true);
    if (!waiting.ok) return;
    assert.equal(waiting.result.cycle.stage, "waiting_approval");
    assert.ok(waiting.result.cycle.approvalId);
    const pendingApprovals = await app.ipc.dispatch({ protocolVersion: 1, requestId: "approval-list-1", correlationId: "ipc-cycle", method: "approval.listPending", payload: { limit: 10 } } as const);
    assert.equal(pendingApprovals.ok, true);
    if (pendingApprovals.ok) assert.equal(pendingApprovals.result.length, 1);
    const decision = await app.ipc.dispatch({ protocolVersion: 1, requestId: "approval-decide-1", correlationId: "ipc-cycle", method: "approval.decide", payload: { approvalId: waiting.result.cycle.approvalId, decision: "approved" } } as const);
    assert.equal(decision.ok, true);
    if (decision.ok) assert.equal(decision.result.status, "approved");
    const resumed = await app.ipc.dispatch({ protocolVersion: 1, requestId: "cycle-start-2", correlationId: "ipc-cycle", method: "workCycle.start", payload: { ...startPayload, approvalId: waiting.result.cycle.approvalId } } as const) as IpcResponse<WorkCycleResult>;
    assert.equal(resumed.ok, true);
    if (!resumed.ok) return;
    assert.equal(resumed.result.cycle.stage, "applied");
    assert.equal(await readFile(join(root, "src", "example.ts"), "utf8"), "export const value = 2;\n");
    const inspected = await app.ipc.dispatch({ protocolVersion: 1, requestId: "cycle-inspect-1", correlationId: "ipc-cycle", method: "workCycle.inspect", payload: { cycleId: "ipc-cycle-1" } } as const);
    assert.equal(inspected.ok, true);
    const cancelled = await app.ipc.dispatch({ protocolVersion: 1, requestId: "cycle-cancel-1", correlationId: "ipc-cycle", method: "workCycle.cancel", payload: { cycleId: "ipc-cycle-1" } } as const);
    assert.equal(cancelled.ok, true);
    if (cancelled.ok) assert.equal(cancelled.result.cancelled, false);
  } finally {
    app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("typed IPC can cancel a waiting work cycle before approval", async () => {
  const root = await mkdtemp(join(tmpdir(), "osamah-ipc-cancel-"));
  const app = createEmbeddedApplication();
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src", "example.ts"), "export const value = 1;\n");
    const waiting = await app.ipc.dispatch({ protocolVersion: 1, requestId: "cancel-start-1", correlationId: "ipc-cancel", method: "workCycle.start", payload: {
      cycleId: "ipc-cancel-1", sessionId: "ipc-session-1", rootPath: root, goal: "Cancel this patch", constraints: [], targetedPaths: ["src/example.ts"],
      plan: { summary: "Cancel this patch", steps: [] }, patch: { proposalId: "ipc-cancel-patch", operations: [{ relativePath: "src/example.ts", mode: "update" as const, content: "cancelled\n" }] },
    } } as const) as IpcResponse<WorkCycleResult>;
    assert.equal(waiting.ok, true);
    const cancelled = await app.ipc.dispatch({ protocolVersion: 1, requestId: "cancel-1", correlationId: "ipc-cancel", method: "workCycle.cancel", payload: { cycleId: "ipc-cancel-1" } } as const);
    assert.equal(cancelled.ok, true);
    if (cancelled.ok) {
      assert.equal(cancelled.result.cancelled, true);
      assert.equal(cancelled.result.cycle?.stage, "cancelled");
    }
    assert.equal(await readFile(join(root, "src", "example.ts"), "utf8"), "export const value = 1;\n");
  } finally {
    app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("typed IPC rejects malformed, unknown, and duplicate requests", async () => {
  const { transport } = setup();
  const malformed = await transport.dispatch({ method: "health.get" });
  assert.equal(malformed.ok, false);
  if (!malformed.ok) assert.equal(malformed.error.code, "INVALID_REQUEST");
  const unknown = await transport.dispatch({ protocolVersion: 1, requestId: "unknown-1", correlationId: "c-2", method: "preview.unknown", payload: {} });
  assert.equal(unknown.ok, false);
  if (!unknown.ok) assert.equal(unknown.error.code, "UNKNOWN_METHOD");
  const malformedContext = await transport.dispatch({ protocolVersion: 1, requestId: "context-invalid-1", correlationId: "c-2", method: "context.index", payload: {} });
  assert.equal(malformedContext.ok, false);
  if (!malformedContext.ok) assert.equal(malformedContext.error.code, "INVALID_REQUEST");
  const malformedCycle = await transport.dispatch({ protocolVersion: 1, requestId: "cycle-invalid-1", correlationId: "c-2", method: "workCycle.start", payload: { cycleId: "missing-fields" } });
  assert.equal(malformedCycle.ok, false);
  if (!malformedCycle.ok) assert.equal(malformedCycle.error.code, "INVALID_REQUEST");
  const malformedApproval = await transport.dispatch({ protocolVersion: 1, requestId: "approval-invalid-1", correlationId: "c-2", method: "approval.decide", payload: { approvalId: "approval-1", decision: "unknown" } });
  assert.equal(malformedApproval.ok, false);
  if (!malformedApproval.ok) assert.equal(malformedApproval.error.code, "INVALID_REQUEST");
  const first = await transport.dispatch({ protocolVersion: 1, requestId: "health-duplicate", correlationId: "c-3", method: "health.get", payload: {} });
  assert.equal(first.ok, true);
  const duplicate = await transport.dispatch({ protocolVersion: 1, requestId: "health-duplicate", correlationId: "c-3", method: "health.get", payload: {} });
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) assert.equal(duplicate.error.code, "DUPLICATE_REQUEST");
});
