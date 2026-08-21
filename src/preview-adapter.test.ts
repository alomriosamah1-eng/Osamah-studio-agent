import assert from "node:assert/strict";
import test from "node:test";
import { createDeviceProfile, createPreviewSession } from "./domain/entities.js";
import { InMemoryLightweightPreviewAdapter } from "./mobile/preview.js";

test("lightweight preview exposes device frame, orientation, and screenshot contract", async () => {
  const profile = createDeviceProfile({ id: "pixel", name: "Pixel Preview", platform: "android", osVersion: "15", width: 1080, height: 2400, dpi: 420, orientation: "portrait" });
  const session = createPreviewSession({ id: "preview-1", deviceProfileId: profile.id });
  const adapter = new InMemoryLightweightPreviewAdapter();
  const frame = await adapter.start(session, profile);
  assert.equal(frame.cssWidth, 1080);
  assert.equal(frame.cssHeight, 2400);
  const landscape = await adapter.sendInput(session.id, { type: "rotate", orientation: "landscape" });
  assert.equal(landscape.cssWidth, 2400);
  assert.equal(landscape.cssHeight, 1080);
  const screenshot = await adapter.capture(session.id);
  assert.equal(screenshot.mimeType, "image/png");
  await adapter.stop(session.id);
  await assert.rejects(() => adapter.capture(session.id));
});
