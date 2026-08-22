import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryContentPlanService } from "./application/content-plan.js";
import { InMemoryReportDocumentService, ReportDocumentError, reportDocumentContract } from "./application/report-document.js";
import { InMemorySourceRegistry } from "./application/source-registry.js";

const createDependencies = () => {
  let sequence = 0;
  const sourceRegistry = new InMemorySourceRegistry({ nextId: (prefix) => `${prefix}-${++sequence}`, now: () => "2026-08-22T00:00:00.000Z" });
  const contentPlans = new InMemoryContentPlanService(sourceRegistry, { nextId: (prefix) => `${prefix}-${++sequence}` });
  const artifacts = { getDraft: (_artifactId: string) => undefined };
  const reportSequences = new Map<string, number>();
  const reports = new InMemoryReportDocumentService(sourceRegistry, contentPlans, artifacts, { nextId: (prefix) => { const next = (reportSequences.get(prefix) ?? 0) + 1; reportSequences.set(prefix, next); return `${prefix}-${next}`; }, now: () => "2026-08-22T00:00:00.000Z" });
  return { sourceRegistry, contentPlans, artifacts, reports };
};

test("report document links supported evidence and allows explicit local approval", () => {
  const { sourceRegistry, reports } = createDependencies();
  const source = sourceRegistry.registerSource({ kind: "workspace_document", locator: "workspace://notes/architecture.md", bytes: 128, sha256: "a".repeat(64), verificationState: "content_validated" });
  const citation = sourceRegistry.addCitation({ sourceId: source.sourceId, label: "Architecture span", span: { start: 0, end: 40 }, verificationState: "content_validated" });
  const report = reports.create({
    kind: "technical_analysis",
    title: "Bounded architecture report",
    scope: "Agent catalog boundary",
    author: "Local reviewer",
    evidence: [{ label: "Architecture evidence", citationId: citation.citationId }],
    claims: [{ text: "The catalog is read-only.", evidenceIds: ["evidence-1"] }],
    assumptions: ["No external provider is enabled."],
    decisions: ["Keep execution behind separate gates."],
  });
  assert.equal(report.reviewState, "review_required");
  assert.equal(report.claims[0]?.verificationState, "supported");
  assert.deepEqual(report.sourceRefs, [source.sourceId]);
  assert.deepEqual(report.artifactRefs, []);
  assert.equal(report.redactionState, "clean");
  const approved = reports.review({ reportId: report.reportId, decision: "approve", reason: "Reviewed locally by the user." });
  assert.equal(approved.reviewState, "approved");
  assert.equal(approved.reviewedAt, "2026-08-22T00:00:00.000Z");
  assert.ok(approved.warnings.includes("user_approved_not_externally_verified"));
  assert.deepEqual(reportDocumentContract, {
    mutatesFilesystem: false,
    executesCommands: false,
    invokesProviders: false,
    rendersOrExports: false,
    requiresHumanGateForMutation: true,
    factualVerificationIsNotImplied: true,
  });
});

test("report document keeps claims unresolved without evidence and blocks invalid evidence", () => {
  const { sourceRegistry, reports } = createDependencies();
  const unresolved = reports.create({ kind: "project_discovery", title: "Open questions", scope: "Local project", claims: [{ text: "An unsupported claim." }] });
  assert.equal(unresolved.reviewState, "review_required");
  assert.equal(unresolved.claims[0]?.verificationState, "unresolved");
  assert.throws(() => reports.review({ reportId: unresolved.reportId, decision: "approve", reason: "Attempted approval." }), /requires claim evidence/);
  const invalidSource = sourceRegistry.registerSource({ kind: "workspace_document", locator: "workspace://invalid", bytes: 10, sha256: "b".repeat(64), verificationState: "invalid" });
  const blocked = reports.create({ kind: "security", title: "Invalid evidence", scope: "Security review", evidence: [{ label: "Invalid source", sourceId: invalidSource.sourceId }], claims: [{ text: "Invalid evidence must block.", evidenceIds: ["evidence-1"] }] });
  assert.equal(blocked.reviewState, "blocked");
  assert.equal(blocked.claims[0]?.verificationState, "conflicted");
  assert.throws(() => reports.review({ reportId: blocked.reportId, decision: "approve", reason: "Should not approve." }), /not awaiting review/);
});

test("report document derives evidence from a content plan and redacts secret-shaped text", () => {
  const { sourceRegistry, contentPlans, reports } = createDependencies();
  const source = sourceRegistry.registerSource({ kind: "workspace_document", locator: "workspace://plan/source", bytes: 32, sha256: "c".repeat(64), verificationState: "metadata_validated" });
  const citation = sourceRegistry.addCitation({ sourceId: source.sourceId, label: "Plan citation", verificationState: "unverified" });
  const plan = contentPlans.createPlan({ brief: "A reviewable plan" });
  const section = contentPlans.addSection({ planId: plan.planId, title: "Evidence" });
  const withClaim = contentPlans.addClaim({ planId: plan.planId, sectionId: section.sections[0]!.sectionId, text: "The plan has a reviewable claim." });
  const cited = contentPlans.attachCitation({ planId: plan.planId, claimId: withClaim.claims[0]!.claimId, citationId: citation.citationId });
  const report = reports.create({ kind: "final_handover", title: "token=should-not-leak", scope: "Plan handover", contentPlanId: cited.planId, assumptions: ["password=hidden"] });
  assert.equal(report.inputs[0], cited.planId);
  assert.equal(report.claims.length, 1);
  assert.equal(report.claims[0]?.verificationState, "supported");
  assert.equal(report.evidence.length, 1);
  assert.equal(report.evidence[0]?.warnings.includes("citation_or_source_unverified"), true);
  assert.equal(report.redactionState, "redacted");
  assert.equal(report.title, "token=[REDACTED]");
  assert.equal(report.assumptions[0], "password=[REDACTED]");
});

test("report document enforces bounded list and review decision inputs", () => {
  const { reports } = createDependencies();
  assert.throws(() => reports.create({ kind: "architecture", title: "Too many assumptions", scope: "Bounded", assumptions: Array.from({ length: 33 }, (_, index) => `assumption-${index}`) }), /assumptions exceeds bounded limits/);
  assert.throws(() => reports.create({ kind: "unknown" as never, title: "Unknown kind", scope: "Bounded" }), /report kind is invalid/);
  assert.throws(() => reports.list(65), (error: unknown) => error instanceof ReportDocumentError);
});
