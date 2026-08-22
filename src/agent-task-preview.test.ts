import assert from "node:assert/strict";
import test from "node:test";
import { AgentTaskPreviewError, AgentTaskPreviewService, taskPreviewContract } from "./application/agent-task-preview.js";
import type { ProjectContextSnapshot, TargetedContextFile } from "./application/project-context.js";

const context: ProjectContextSnapshot = {
  rootPath: "/tmp/project",
  generatedAt: "2026-08-22T00:00:00.000Z",
  files: [{ relativePath: "app.ts", extension: ".ts" }],
  manifests: [],
  git: { isRepository: true, branch: "main", stagedCount: 0, unstagedCount: 0, untrackedCount: 0, conflictedCount: 0 },
  truncated: false,
  warnings: [],
};

const targetedFiles: readonly TargetedContextFile[] = [{
  relativePath: "app.ts",
  bytes: 19,
  sha256: "a".repeat(64),
  content: "export const app = 1;",
}];

const plan = { summary: "Review app", steps: [{ id: "inspect", title: "Inspect", description: "Review the bounded file." }] };

const createService = (reviewCalls: { count: number } = { count: 0 }) => new AgentTaskPreviewService(
  {
    build: async () => context,
    readTargeted: async () => targetedFiles,
  },
  {
    review: (request) => {
      reviewCalls.count += 1;
      assert.equal(request.goal, "Review app");
      return { plan, critique: { accepted: true, issues: [] } };
    },
  },
);

test("agent task preview returns context, plan, critique, and no-mutation contract", async () => {
  const result = await createService().preview({ rootPath: "/tmp/project", goal: "Review app", constraints: ["Do not execute scripts."], targetedPaths: ["app.ts"], offlineMode: true });
  assert.equal(result.safeToProceed, true);
  assert.equal(result.plan.summary, "Review app");
  assert.equal(result.targetedFiles[0]?.relativePath, "app.ts");
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(taskPreviewContract, { mutatesFilesystem: false, executesCommands: false, requiresHumanGateForMutation: true });
});

test("agent task preview propagates bounded context warnings without mutation", async () => {
  const service = new AgentTaskPreviewService(
    { build: async () => ({ ...context, truncated: true, warnings: ["Some files were omitted."] }), readTargeted: async () => targetedFiles },
    { review: () => ({ plan, critique: { accepted: true, issues: [{ code: "context_truncated", severity: "warning", message: "Review bounded context." }] } }) },
  );
  const result = await service.preview({ rootPath: "/tmp/project", goal: "Review app", constraints: [], targetedPaths: ["app.ts"] });
  assert.equal(result.safeToProceed, true);
  assert.deepEqual(result.warnings, ["Some files were omitted.", "Project context is truncated by resource policy.", "Review bounded context."]);
});

test("agent task preview rejects unsafe paths before context or planner access", async () => {
  const calls = { count: 0 };
  await assert.rejects(
    () => createService(calls).preview({ rootPath: "/tmp/project", goal: "Review app", constraints: [], targetedPaths: ["../secret"] }),
    (error: unknown) => error instanceof AgentTaskPreviewError && error.message.includes("safe relative path"),
  );
  assert.equal(calls.count, 0);
});

test("agent task preview rejects oversized bounded request", async () => {
  await assert.rejects(
    () => createService().preview({ rootPath: "/tmp/project", goal: "Review app", constraints: Array.from({ length: 33 }, () => "constraint"), targetedPaths: [] }),
    (error: unknown) => error instanceof AgentTaskPreviewError && error.message.includes("bounded limits"),
  );
});
