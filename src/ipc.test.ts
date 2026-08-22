import assert from "node:assert/strict";
import test from "node:test";
import { createFoundation } from "./composition.js";
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

test("typed IPC rejects malformed, unknown, and duplicate requests", async () => {
  const { transport } = setup();
  const malformed = await transport.dispatch({ method: "health.get" });
  assert.equal(malformed.ok, false);
  if (!malformed.ok) assert.equal(malformed.error.code, "INVALID_REQUEST");
  const unknown = await transport.dispatch({ protocolVersion: 1, requestId: "unknown-1", correlationId: "c-2", method: "preview.unknown", payload: {} });
  assert.equal(unknown.ok, false);
  if (!unknown.ok) assert.equal(unknown.error.code, "UNKNOWN_METHOD");
  const first = await transport.dispatch({ protocolVersion: 1, requestId: "health-duplicate", correlationId: "c-3", method: "health.get", payload: {} });
  assert.equal(first.ok, true);
  const duplicate = await transport.dispatch({ protocolVersion: 1, requestId: "health-duplicate", correlationId: "c-3", method: "health.get", payload: {} });
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) assert.equal(duplicate.error.code, "DUPLICATE_REQUEST");
});
