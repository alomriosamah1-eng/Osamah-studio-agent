import assert from "node:assert/strict";
import test from "node:test";
import { createFoundation } from "./composition.js";
import { InMemoryLightweightPreviewAdapter } from "./mobile/preview.js";
import { InMemoryEmbeddedSimulatorController } from "./mobile/embedded-controller.js";
import { ResourcePolicy } from "./application/resource-policy.js";
import { buildProjectPreviewBundle } from "./mobile/preview-runtime.js";

test("embedded simulator runs inside the application controller lifecycle", async () => {
  const { useCases } = createFoundation();
  const profile = useCases.registerDeviceProfile({ id: "pixel-embedded", name: "Pixel Embedded", platform: "android", osVersion: "15", width: 1080, height: 2424, dpi: 420 });
  const controller = new InMemoryEmbeddedSimulatorController(useCases, new InMemoryLightweightPreviewAdapter());
  controller.registerProfile(profile);
  const bundle = buildProjectPreviewBundle({ projectId: "embedded-fixture", rootPath: "/fixtures", entry: "app/index.tsx", files: {
    "app/index.tsx": `import { Text } from "react-native"; export default function App() { return <Text>Embedded content</Text>; }`,
  } });
  const session = await controller.start({ deviceProfileId: profile.id, bundle });
  assert.equal(session.status, "ready");
  const frame = await controller.sendInput(session.id, { type: "rotate", orientation: "landscape" });
  assert.equal(frame.orientation, "landscape");
  assert.equal(frame.cssWidth, 2424);
  const inspection = controller.inspect(session.id);
  assert.equal(inspection.nativeFidelity, "compatibility");
  assert.equal(inspection.warnings.length, 1);
  assert.equal(inspection.bundle?.sourceHash, bundle.sourceHash);
  assert.equal(inspection.bundle?.moduleCount, 1);
  assert.equal(inspection.events[0]?.type, "bundle_loaded");
  await controller.refresh(session.id, "fast", buildProjectPreviewBundle({ projectId: "embedded-fixture", rootPath: "/fixtures", entry: "app/index.tsx", files: {
    "app/index.tsx": `import { Text } from "react-native"; export default function App() { return <Text>Updated embedded content</Text>; }`,
  } }));
  assert.equal(controller.inspect(session.id).events.at(-1)?.type, "refresh_completed");
  const screenshot = await controller.capture(session.id);
  assert.equal(screenshot.sessionId, session.id);
  await controller.stop(session.id);
  assert.equal(controller.inspect(session.id).state, "stopped");
});

test("lightweight embedded controller refuses native transports and enforces one preview session", async () => {
  const { useCases } = createFoundation();
  const profile = useCases.registerDeviceProfile({ id: "pixel-budget", name: "Pixel Budget", platform: "android", osVersion: "15", width: 720, height: 1280, dpi: 320 });
  const resourcePolicy = new ResourcePolicy("low_memory");
  const controller = new InMemoryEmbeddedSimulatorController(useCases, new InMemoryLightweightPreviewAdapter(), resourcePolicy);
  controller.registerProfile(profile);
  await assert.rejects(() => controller.start({ deviceProfileId: profile.id, mode: "android_emulator" }), /Native transport android_emulator is not available/);
  const first = await controller.start({ deviceProfileId: profile.id });
  await assert.rejects(() => controller.start({ deviceProfileId: profile.id }), /PREVIEW_SESSION_LIMIT/);
  assert.deepEqual(resourcePolicy.snapshot(), { activePreviewSessions: 1, activeAgentJobs: 0, profile: "low_memory" });
  await controller.stop(first.id);
  assert.deepEqual(resourcePolicy.snapshot(), { activePreviewSessions: 0, activeAgentJobs: 0, profile: "low_memory" });
});

test("missing lightweight preview profile does not consume the resource admission slot", async () => {
  const { useCases } = createFoundation();
  const resourcePolicy = new ResourcePolicy("low_memory");
  const controller = new InMemoryEmbeddedSimulatorController(useCases, new InMemoryLightweightPreviewAdapter(), resourcePolicy);
  await assert.rejects(() => controller.start({ deviceProfileId: "missing-profile" as never }), /was not registered/);
  assert.deepEqual(resourcePolicy.snapshot(), { activePreviewSessions: 0, activeAgentJobs: 0, profile: "low_memory" });
});
