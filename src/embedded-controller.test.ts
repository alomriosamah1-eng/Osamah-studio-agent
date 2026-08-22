import assert from "node:assert/strict";
import test from "node:test";
import { createFoundation } from "./composition.js";
import { InMemoryLightweightPreviewAdapter } from "./mobile/preview.js";
import { InMemoryEmbeddedSimulatorController } from "./mobile/embedded-controller.js";
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
