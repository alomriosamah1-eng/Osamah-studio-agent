import assert from "node:assert/strict";
import test from "node:test";
import { ArtifactAssemblyError, InMemoryArtifactAssembly } from "./application/artifact-assembly.js";
import { InMemoryAssetCatalog } from "./application/asset-catalog.js";
import { InMemoryContentPlanService } from "./application/content-plan.js";
import { InMemorySourceRegistry } from "./application/source-registry.js";

test("artifact assembly builds deterministic manifest from supported claims and linked assets", () => {
  const sources = new InMemorySourceRegistry();
  const source = sources.registerSource({ kind: "user_url", locator: "https://example.test/article", bytes: 512, sha256: "c".repeat(64), verificationState: "content_validated" });
  const citation = sources.addCitation({ sourceId: source.sourceId, label: "Evidence", span: { start: 0, end: 8 }, verificationState: "content_validated" });
  const plans = new InMemoryContentPlanService(sources);
  const plan = plans.createPlan({ brief: "Build a report" });
  const sectioned = plans.addSection({ planId: plan.planId, title: "Findings" });
  const claim = plans.addClaim({ planId: plan.planId, sectionId: sectioned.sections[0]!.sectionId, text: "The evidence is available." });
  const supportedPlan = plans.attachCitation({ planId: plan.planId, claimId: claim.claims[0]!.claimId, citationId: citation.citationId });
  const catalog = new InMemoryAssetCatalog(sources);
  const asset = catalog.registerAsset({ kind: "image", title: "Chart", locator: "studio://assets/chart.png", sha256: "b".repeat(64), bytes: 256, license: { name: "Internal", state: "verified", warnings: [] }, sourceIds: [source.sourceId] });
  const brief = catalog.createBrief({ title: "Report visual brief", intent: "Use the chart" });
  const linkedBrief = catalog.attachAsset({ briefId: brief.briefId, assetId: asset.assetId });
  const assembly = new InMemoryArtifactAssembly({ getPlan: (id) => id === supportedPlan.planId ? supportedPlan : undefined }, catalog, catalog, sources);
  const draft = assembly.createDraft({ kind: "document", title: "Reviewable report", contentPlanId: supportedPlan.planId, briefId: linkedBrief.briefId });
  assert.equal(draft.reviewState, "ready_for_render");
  assert.deepEqual(draft.manifest.claims, [claim.claims[0]!.claimId]);
  assert.deepEqual(draft.manifest.assets, [asset.assetId]);
  assert.deepEqual(draft.manifest.sources, [source.sourceId]);
  assert.deepEqual(draft.manifest.tools, []);
  assert.equal(draft.manifest.warnings.length, 0);
});

test("artifact assembly blocks unresolved claims and preserves review warnings", () => {
  const sources = new InMemorySourceRegistry();
  const plans = new InMemoryContentPlanService(sources);
  const plan = plans.createPlan({ brief: "Review unsupported claim" });
  const sectioned = plans.addSection({ planId: plan.planId, title: "Review" });
  const withClaim = plans.addClaim({ planId: plan.planId, sectionId: sectioned.sections[0]!.sectionId, text: "Needs evidence." });
  const assembly = new InMemoryArtifactAssembly({ getPlan: (id) => id === withClaim.planId ? withClaim : undefined }, { getBrief: () => undefined }, { getAsset: () => undefined }, sources);
  const draft = assembly.createDraft({ kind: "markdown", title: "Needs review", contentPlanId: withClaim.planId });
  assert.equal(draft.reviewState, "blocked");
  assert.ok(draft.warnings.some((warning) => warning.includes("no_citation")));
  assert.deepEqual(draft.manifest.tools, []);
});

test("artifact assembly blocks blocked assets and rejects unknown or duplicate ids", () => {
  const sources = new InMemorySourceRegistry();
  const plans = new InMemoryContentPlanService(sources);
  const plan = plans.createPlan({ brief: "Assemble a visual" });
  const sectioned = plans.addSection({ planId: plan.planId, title: "Visual" });
  const claim = plans.addClaim({ planId: plan.planId, sectionId: sectioned.sections[0]!.sectionId, text: "Visual needs review." });
  const catalog = new InMemoryAssetCatalog(sources);
  const blocked = catalog.registerAsset({ kind: "video", title: "Restricted", locator: "studio://assets/restricted.mp4", license: { name: "Restricted", state: "blocked", warnings: [] } });
  const brief = catalog.createBrief({ title: "Brief", intent: "Review visual" });
  assert.throws(() => catalog.attachAsset({ briefId: brief.briefId, assetId: blocked.assetId }), /blocked/);
  const assembly = new InMemoryArtifactAssembly({ getPlan: (id) => id === claim.planId ? claim : undefined }, catalog, catalog, sources);
  assert.throws(() => assembly.createDraft({ kind: "presentation", title: "Bad", contentPlanId: claim.planId, claimIds: ["missing"] }), ArtifactAssemblyError);
  assert.throws(() => assembly.createDraft({ kind: "presentation", title: "Duplicate", contentPlanId: claim.planId, claimIds: [claim.claims[0]!.claimId, claim.claims[0]!.claimId] }), ArtifactAssemblyError);
});

test("artifact assembly rejects unbounded references and unknown brief", () => {
  const sources = new InMemorySourceRegistry();
  const plans = new InMemoryContentPlanService(sources);
  const plan = plans.createPlan({ brief: "Bounded" });
  const assembly = new InMemoryArtifactAssembly(plans, { getBrief: () => undefined }, { getAsset: () => undefined }, sources, { maxClaims: 2 });
  assert.throws(() => assembly.createDraft({ kind: "document", title: "Unknown brief", contentPlanId: plan.planId, briefId: "missing" }), ArtifactAssemblyError);
  assert.throws(() => assembly.createDraft({ kind: "document", title: "Bad list", contentPlanId: plan.planId, claimIds: ["a", "b", "c"] }), ArtifactAssemblyError);
});
