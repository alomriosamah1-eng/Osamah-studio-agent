import assert from "node:assert/strict";
import test from "node:test";
import { createFoundation } from "./composition.js";
import { DomainError } from "./domain/errors.js";

const setup = () => createFoundation();

test("opens a workspace, creates a session, and records domain events", () => {
  const { useCases, dependencies } = setup();
  const workspace = useCases.openWorkspace({ name: "Demo", rootPath: "/tmp/demo" });
  const session = useCases.createSession(workspace.id);
  assert.equal(session.status, "created");
  const events = (dependencies.events as unknown as { history: Array<{ type: string }> }).history;
  assert.deepEqual(events.map((event) => event.type), ["WorkspaceOpened", "SessionCreated"]);
});

test("requires approval for a sensitive action and resumes after approval", () => {
  const { useCases } = setup();
  const workspace = useCases.openWorkspace({ name: "Demo", rootPath: "/tmp/demo" });
  const session = useCases.createSession(workspace.id);
  useCases.startSession(session.id);
  const approval = useCases.requestApproval({ sessionId: session.id, action: "terminal.exec", risk: "high", scope: "workspace" });
  assert.equal(approval.status, "requested");
  const resolved = useCases.resolveApproval(approval.id, "approved");
  assert.equal(resolved.status, "approved");
  assert.equal(useCases.createSession, useCases.createSession);
});

test("rejects an invalid preview state transition", () => {
  const { useCases } = setup();
  const profile = useCases.registerDeviceProfile({ id: "pixel-9", name: "Pixel 9", platform: "android", osVersion: "15", width: 1080, height: 2424, dpi: 420 });
  const preview = useCases.createPreview({ deviceProfileId: profile.id });
  assert.throws(() => useCases.transitionPreview(preview.id, "ready"), (error: unknown) => error instanceof DomainError && error.code === "INVALID_TRANSITION");
});

test("supports lightweight preview geometry and ready lifecycle", () => {
  const { useCases, dependencies } = setup();
  const profile = useCases.registerDeviceProfile({ id: "iphone-preview", name: "iPhone Preview", platform: "ios", osVersion: "18", width: 393, height: 852, dpi: 3, safeArea: { top: 59, right: 0, bottom: 34, left: 0 }, theme: "dark" });
  const preview = useCases.createPreview({ deviceProfileId: profile.id, mode: "lightweight_web" });
  useCases.transitionPreview(preview.id, "starting");
  const ready = useCases.transitionPreview(preview.id, "ready");
  assert.equal(ready.status, "ready");
  assert.equal(dependencies.previews.get(ready.id)?.mode, "lightweight_web");
  assert.equal(profile.safeArea.top, 59);
});
