import assert from "node:assert/strict";
import test from "node:test";
import { createFoundation } from "./composition.js";
import { InMemoryLightweightPreviewAdapter } from "./mobile/preview.js";
import { InMemoryEmbeddedSimulatorController } from "./mobile/embedded-controller.js";
import { InMemoryIpcTransport } from "./ipc/in-memory-transport.js";
import { registerEmbeddedSimulatorHandlers } from "./ipc/embedded-handlers.js";
import { buildProjectPreviewBundle } from "./mobile/preview-runtime.js";
import type { PreviewSession } from "./domain/entities.js";
import type { PreviewInspection, IpcResponse } from "./ipc/contracts.js";

const setup = () => {
  const { useCases } = createFoundation();
  const profile = useCases.registerDeviceProfile({ id: "ipc-pixel", name: "IPC Pixel", platform: "android", osVersion: "15", width: 1080, height: 2424, dpi: 420 });
  const controller = new InMemoryEmbeddedSimulatorController(useCases, new InMemoryLightweightPreviewAdapter());
  controller.registerProfile(profile);
  const transport = new InMemoryIpcTransport();
  registerEmbeddedSimulatorHandlers(transport, controller);
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
