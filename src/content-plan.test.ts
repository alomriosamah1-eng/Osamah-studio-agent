import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryContentPlanService, ContentPlanError } from "./application/content-plan.js";
import { InMemorySourceRegistry } from "./application/source-registry.js";

test("content plan keeps claims unresolved until a known citation is attached", () => {
  const sources = new InMemorySourceRegistry();
  const plans = new InMemoryContentPlanService(sources);
  const created = plans.createPlan({ brief: "Prepare a bounded research outline" });
  const withSection = plans.addSection({ planId: created.planId, title: "Findings" });
  const withClaim = plans.addClaim({ planId: created.planId, sectionId: withSection.sections[0]!.sectionId, text: "The project has a local-first boundary.", confidence: 0.8 });
  assert.equal(withClaim.integrity.totalClaims, 1);
  assert.equal(withClaim.integrity.unresolvedClaims, 1);
  assert.equal(withClaim.claims[0]?.verificationState, "unresolved");
  assert.ok(withClaim.claims[0]?.warnings.includes("claim_has_no_citation"));
});

test("content plan marks a claim supported by a known citation and preserves unverified warning", () => {
  const sources = new InMemorySourceRegistry();
  const source = sources.registerSource({ kind: "user_url", locator: "https://example.test/source", verificationState: "metadata_validated" });
  const citation = sources.addCitation({ sourceId: source.sourceId, label: "Source paragraph", span: { start: 0, end: 12 }, verificationState: "unverified" });
  const plans = new InMemoryContentPlanService(sources);
  const created = plans.createPlan({ brief: "Summarize source" });
  const withSection = plans.addSection({ planId: created.planId, title: "Summary" });
  const withClaim = plans.addClaim({ planId: created.planId, sectionId: withSection.sections[0]!.sectionId, text: "A source was registered." });
  const attached = plans.attachCitation({ planId: created.planId, claimId: withClaim.claims[0]!.claimId, citationId: citation.citationId });
  assert.equal(attached.integrity.supportedClaims, 1);
  assert.equal(attached.integrity.unresolvedClaims, 0);
  assert.equal(attached.claims[0]?.verificationState, "supported");
  assert.ok(attached.claims[0]?.warnings.includes("citation_or_source_unverified"));
});

test("content plan marks invalid citation evidence conflicted and rejects duplicate attachment", () => {
  const sources = new InMemorySourceRegistry();
  const source = sources.registerSource({ kind: "workspace_document", locator: "workspace://notes.md", verificationState: "invalid" });
  const citation = sources.addCitation({ sourceId: source.sourceId, label: "Invalid note", verificationState: "invalid" });
  const plans = new InMemoryContentPlanService(sources);
  const created = plans.createPlan({ brief: "Review notes" });
  const withSection = plans.addSection({ planId: created.planId, title: "Review" });
  const withClaim = plans.addClaim({ planId: created.planId, sectionId: withSection.sections[0]!.sectionId, text: "This evidence must be reviewed." });
  const attached = plans.attachCitation({ planId: created.planId, claimId: withClaim.claims[0]!.claimId, citationId: citation.citationId });
  assert.equal(attached.integrity.conflictedClaims, 1);
  assert.equal(attached.claims[0]?.verificationState, "conflicted");
  assert.throws(() => plans.attachCitation({ planId: created.planId, claimId: withClaim.claims[0]!.claimId, citationId: citation.citationId }), ContentPlanError);
});

test("content plan rejects unknown sections/citations and unbounded input", () => {
  const sources = new InMemorySourceRegistry();
  const plans = new InMemoryContentPlanService(sources);
  const created = plans.createPlan({ brief: "Bounded plan" });
  assert.throws(() => plans.addClaim({ planId: created.planId, sectionId: "missing", text: "claim" }), ContentPlanError);
  assert.throws(() => plans.createPlan({ brief: "\n" }), ContentPlanError);
  const sectioned = plans.addSection({ planId: created.planId, title: "Section" });
  const claim = plans.addClaim({ planId: created.planId, sectionId: sectioned.sections[0]!.sectionId, text: "claim" });
  assert.throws(() => plans.attachCitation({ planId: created.planId, claimId: claim.claims[0]!.claimId, citationId: "missing" }), ContentPlanError);
  assert.throws(() => plans.addSection({ planId: created.planId, title: "\u0000bad" }), ContentPlanError);
});
