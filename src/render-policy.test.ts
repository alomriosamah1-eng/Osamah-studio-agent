import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryRenderPolicy, RenderPolicyError } from "./application/render-policy.js";
import type { ArtifactDraft } from "./application/artifact-assembly.js";

const draft = (overrides: Partial<ArtifactDraft> = {}): ArtifactDraft => ({
  artifactId: "artifact-1",
  kind: "document",
  title: "Report",
  contentPlanId: "plan-1",
  claimIds: ["claim-1"],
  assetIds: [],
  reviewState: "ready_for_render",
  manifest: { sources: ["source-1"], assets: [], tools: [], claims: ["claim-1"], warnings: [] },
  warnings: [],
  ...overrides,
});

test("render policy allows a bounded preview without starting execution", () => {
  const policy = new InMemoryRenderPolicy({ getDraft: (id) => id === "artifact-1" ? draft() : undefined });
  const result = policy.preview({ artifactId: "artifact-1", format: "html", relativeDestination: "preview/report.html" });
  assert.equal(result.decision, "allowed_preview");
  assert.equal(result.adapter, "html");
  assert.equal(result.executionStarted, false);
  assert.deepEqual(result.budget, { timeoutMs: 30_000, maxMemoryMb: 512, maxOutputBytes: 64 * 1024 * 1024, maxPages: 100 });
  assert.ok(result.checks.includes("tools_not_invoked"));
  assert.ok(result.checks.includes("relative_destination_safe"));
});

test("render policy requires review for an artifact with warnings and blocks missing artifacts", () => {
  const policy = new InMemoryRenderPolicy({ getDraft: (id) => id === "review" ? draft({ artifactId: "review", reviewState: "needs_review", warnings: ["asset_license_unverified"] }) : undefined });
  const review = policy.preview({ artifactId: "review", format: "pdf" });
  assert.equal(review.decision, "review_required");
  assert.equal(review.adapter, "document");
  assert.ok(review.warnings.includes("asset_license_unverified"));
  const missing = policy.preview({ artifactId: "missing", format: "pdf" });
  assert.equal(missing.decision, "blocked");
  assert.equal(missing.adapter, "none");
  assert.ok(missing.checks.includes("artifact_manifest_missing"));
});

test("render policy blocks incompatible formats and blocked artifacts", () => {
  const policy = new InMemoryRenderPolicy({ getDraft: (id) => id === "presentation" ? draft({ artifactId: id, kind: "presentation" }) : id === "blocked" ? draft({ artifactId: id, reviewState: "blocked", warnings: ["claim:no_citation"] }) : undefined });
  const incompatible = policy.preview({ artifactId: "presentation", format: "video" });
  assert.equal(incompatible.decision, "blocked");
  assert.equal(incompatible.adapter, "none");
  assert.ok(incompatible.warnings.some((warning) => warning.includes("not_supported")));
  const blocked = policy.preview({ artifactId: "blocked", format: "markdown" });
  assert.equal(blocked.decision, "blocked");
  assert.ok(blocked.checks.includes("artifact_review_blocked"));
});

test("render policy rejects unsafe destination and oversized low-memory budgets", () => {
  const policy = new InMemoryRenderPolicy({ getDraft: () => draft() });
  assert.throws(() => policy.preview({ artifactId: "artifact-1", format: "markdown", relativeDestination: "/tmp/out.md" }), RenderPolicyError);
  assert.throws(() => policy.preview({ artifactId: "artifact-1", format: "markdown", relativeDestination: "../out.md" }), RenderPolicyError);
  assert.throws(() => policy.preview({ artifactId: "artifact-1", format: "markdown", budget: { maxMemoryMb: 513 } }), RenderPolicyError);
  assert.throws(() => policy.preview({ artifactId: "artifact-1", format: "markdown", budget: { timeoutMs: 0 } }), RenderPolicyError);
});
