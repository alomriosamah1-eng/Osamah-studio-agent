import assert from "node:assert/strict";
import test from "node:test";
import {
  DESKTOP_CONTENT_SECURITY_POLICY,
  APPROVAL_EVENTS_CHANNEL,
  PROJECT_ROOT_PICKER_CHANNEL,
  isAllowedWorkspaceUrl,
  isTrustedIpcSender,
} from "./security.js";

test("desktop security policy allows only same file workspace URL", () => {
  const expectedUrl = "file:///workspace/index.html";
  assert.equal(isAllowedWorkspaceUrl(expectedUrl, expectedUrl), true);
  assert.equal(isAllowedWorkspaceUrl(`${expectedUrl}#osamah-smoke`, expectedUrl), true);
  assert.equal(isAllowedWorkspaceUrl(`${expectedUrl}?redirect=1`, expectedUrl), false);
  assert.equal(isAllowedWorkspaceUrl("https://example.com/", expectedUrl), false);
  assert.equal(isAllowedWorkspaceUrl("file:///workspace/other.html", expectedUrl), false);
  assert.equal(isAllowedWorkspaceUrl("not-a-url", expectedUrl), false);
  assert.match(DESKTOP_CONTENT_SECURITY_POLICY, /script-src 'self'/);
  assert.doesNotMatch(DESKTOP_CONTENT_SECURITY_POLICY, /script-src[^;]*unsafe-inline/);
  assert.equal(PROJECT_ROOT_PICKER_CHANNEL, "osamah:choose-project-root");
  assert.equal(APPROVAL_EVENTS_CHANNEL, "osamah:approval-events");
});

test("desktop IPC trusts only the expected renderer sender and URL", () => {
  const expectedUrl = "file:///workspace/index.html";
  assert.equal(isTrustedIpcSender({ senderId: 7, expectedSenderId: 7, frameUrl: expectedUrl, expectedFrameUrl: expectedUrl }), true);
  assert.equal(isTrustedIpcSender({ senderId: 8, expectedSenderId: 7, frameUrl: expectedUrl, expectedFrameUrl: expectedUrl }), false);
  assert.equal(isTrustedIpcSender({ senderId: 7, expectedSenderId: 7, frameUrl: "https://evil.example/", expectedFrameUrl: expectedUrl }), false);
});
