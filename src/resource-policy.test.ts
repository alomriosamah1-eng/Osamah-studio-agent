import { strict as assert } from "node:assert";
import { test } from "node:test";
import { classifyProject } from "./domain/project.js";
import { LatestOnlyAsyncQueue, limitsForProfile, ResourcePolicy, resourceProfileForTotalMemory, SupersededTaskError } from "./application/resource-policy.js";

test("8GB hosts select low-memory policy with one preview and one agent job", () => {
  assert.equal(resourceProfileForTotalMemory(8 * 1024 * 1024 * 1024), "low_memory");
  const policy = new ResourcePolicy("low_memory");
  assert.equal(policy.acquirePreview().allowed, true);
  const secondPreview = policy.acquirePreview();
  assert.equal(secondPreview.allowed, false);
  if (!secondPreview.allowed) assert.equal(secondPreview.code, "PREVIEW_SESSION_LIMIT");
  assert.equal(policy.acquireAgentJob().allowed, true);
  const secondJob = policy.acquireAgentJob();
  assert.equal(secondJob.allowed, false);
  if (!secondJob.allowed) assert.equal(secondJob.code, "AGENT_JOB_LIMIT");
  policy.releasePreview();
  policy.releaseAgentJob();
  assert.deepEqual(policy.snapshot(), { activePreviewSessions: 0, activeAgentJobs: 0, profile: "low_memory" });
});

test("resource policy rejects oversized preview budgets before execution", () => {
  const policy = new ResourcePolicy("low_memory");
  const limits = limitsForProfile("low_memory");
  const cases = [
    [{ sourceBytes: limits.maxPreviewSourceBytes + 1, moduleCount: 1, assetCount: 1, warningCount: 1 }, "PREVIEW_SOURCE_LIMIT"],
    [{ sourceBytes: 1, moduleCount: limits.maxPreviewModules + 1, assetCount: 1, warningCount: 1 }, "PREVIEW_MODULE_LIMIT"],
    [{ sourceBytes: 1, moduleCount: 1, assetCount: limits.maxPreviewAssets + 1, warningCount: 1 }, "PREVIEW_ASSET_LIMIT"],
    [{ sourceBytes: 1, moduleCount: 1, assetCount: 1, warningCount: limits.maxPreviewWarnings + 1 }, "PREVIEW_WARNING_LIMIT"],
  ] as const;
  for (const [input, code] of cases) {
    const admission = policy.checkPreviewBudget(input);
    assert.equal(admission.allowed, false);
    if (!admission.allowed) assert.equal(admission.code, code);
  }
});

test("latest-only queue supersedes pending work while allowing the running task to finish", async () => {
  const queue = new LatestOnlyAsyncQueue<string>();
  let releaseFirst: (() => void) | undefined;
  const first = queue.enqueue(() => new Promise<string>((resolve) => { releaseFirst = () => resolve("first"); }));
  const second = queue.enqueue(async () => "second");
  const third = queue.enqueue(async () => "third");
  await assert.rejects(second, SupersededTaskError);
  assert.equal(queue.pendingCount(), 1);
  releaseFirst?.();
  assert.equal(await first, "first");
  assert.equal(await third, "third");
  assert.equal(queue.pendingCount(), 0);
});

test("project classifier routes React Native and React to lightweight Web preview", () => {
  const reactNative = classifyProject({ files: ["package.json", "app/index.tsx"], dependencies: { expo: "^53", react: "^19" } });
  assert.deepEqual(reactNative, { kind: "react_native", preview: "lightweight_web", confidence: "high", reasons: ["React Native or Expo dependency/configuration detected.", "Use Web compatibility preview; native transport is optional."] });
  const reactWeb = classifyProject({ files: ["package.json", "src/App.tsx", "index.html"], dependencies: { react: "^19", "react-dom": "^19" } });
  assert.equal(reactWeb.kind, "react");
  assert.equal(reactWeb.preview, "lightweight_web");
});

test("non-UI projects remain available to the general Workspace without preview processes", () => {
  const python = classifyProject({ files: ["pyproject.toml", "src/main.py"] });
  assert.equal(python.kind, "python");
  assert.equal(python.preview, "none");
  const generic = classifyProject({ files: ["README.md"] });
  assert.equal(generic.kind, "generic");
  assert.equal(generic.preview, "none");
});
