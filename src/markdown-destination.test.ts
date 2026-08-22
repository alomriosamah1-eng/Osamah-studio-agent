import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { InMemoryContentPlanService } from "./application/content-plan.js";
import { MarkdownDestinationService, markdownDestinationContract, type MarkdownDestinationWriteInput } from "./application/markdown-destination.js";
import { InMemoryMarkdownExportService } from "./application/markdown-export.js";
import { InMemoryReportDocumentService } from "./application/report-document.js";
import { InMemorySourceRegistry } from "./application/source-registry.js";
import { LocalMarkdownDestinationWriter } from "./infrastructure/markdown-destination.js";

const createReportDependencies = () => {
  let sequence = 0;
  const sourceRegistry = new InMemorySourceRegistry({ nextId: (prefix) => `${prefix}-${++sequence}`, now: () => "2026-08-23T00:00:00.000Z" });
  const contentPlans = new InMemoryContentPlanService(sourceRegistry, { nextId: (prefix) => `${prefix}-${++sequence}` });
  const reports = new InMemoryReportDocumentService(sourceRegistry, contentPlans, { getDraft: () => undefined }, { nextId: (prefix) => `${prefix}-${++sequence}`, now: () => "2026-08-23T00:00:00.000Z" });
  const source = sourceRegistry.registerSource({ kind: "workspace_document", locator: "workspace://destination/source.md", bytes: 12, sha256: "a".repeat(64), verificationState: "content_validated" });
  const citation = sourceRegistry.addCitation({ sourceId: source.sourceId, label: "Destination source", verificationState: "content_validated" });
  const report = reports.create({ kind: "technical_analysis", title: "Destination report", scope: "Local export", evidence: [{ label: "Source evidence", citationId: citation.citationId }], claims: [{ text: "The destination is local.", evidenceIds: ["evidence-3"] }] });
  return { reports, report, exporter: new InMemoryMarkdownExportService(reports) };
};

test("Markdown destination service blocks unapproved reports before Human Gate or write", async () => {
  const { reports, report, exporter } = createReportDependencies();
  let authorizeCalls = 0;
  let writeCalls = 0;
  const service = new MarkdownDestinationService({
    markdownExport: exporter,
    authorization: { authorize: () => { authorizeCalls += 1; return { decision: "approval_required", approvalId: "approval-1", correlationId: "correlation-1", reason: "approval required" }; } },
    destination: { write: async () => { writeCalls += 1; throw new Error("write must not be called"); } },
    now: () => "2026-08-23T00:00:00.000Z",
  });

  const result = await service.write({ reportId: report.reportId, relativePath: "reports/destination.md" });
  assert.equal(result.status, "blocked");
  assert.equal(authorizeCalls, 0);
  assert.equal(writeCalls, 0);
  assert.equal(result.warnings.includes("report_review_required_before_destination_write"), true);

  reports.review({ reportId: report.reportId, decision: "approve", reason: "Reviewed locally." });
  const approvalRequired = await service.write({ reportId: report.reportId, relativePath: "reports/destination.md" });
  assert.equal(approvalRequired.status, "approval_required");
  assert.equal(approvalRequired.approvalId, "approval-1");
  assert.equal(authorizeCalls, 1);
  assert.equal(writeCalls, 0);
});

test("Markdown destination service writes only after matching Human Gate approval", async () => {
  const { reports, report, exporter } = createReportDependencies();
  reports.review({ reportId: report.reportId, decision: "approve", reason: "Reviewed locally." });
  const approved = { reportId: report.reportId, relativePath: "reports/destination.md", content: exporter.preview(report.reportId).markdown, reviewState: "approved" as const, redactionState: "clean" as const, warnings: ["factual_verification_is_not_implied"], createdAt: "2026-08-23T00:00:00.000Z" };
  let received: MarkdownDestinationWriteInput | undefined;
  const service = new MarkdownDestinationService({
    markdownExport: exporter,
    authorization: { authorize: (_action, approvalId) => approvalId === "approval-1" ? { decision: "allowed", correlationId: "correlation-2", reason: "approved" } : { decision: "approval_required", approvalId: "approval-1", correlationId: "correlation-1", reason: "approval required" } },
    destination: { write: async (input) => { received = input; return { formatVersion: 1, createdAt: input.createdAt, reportId: input.reportId, relativePath: input.relativePath, manifestRelativePath: `${input.relativePath}.manifest.json`, bytes: Buffer.byteLength(input.content), sha256: createHash("sha256").update(input.content).digest("hex"), reviewState: input.reviewState, redactionState: input.redactionState, warnings: input.warnings, overwritten: false }; } },
    now: () => "2026-08-23T00:00:00.000Z",
  });
  const result = await service.write({ reportId: report.reportId, relativePath: "reports/destination.md", approvalId: "approval-1" });
  assert.equal(result.status, "written");
  assert.equal(received?.relativePath, approved.relativePath);
  assert.equal(received?.content, approved.content);
  assert.equal(markdownDestinationContract.requiresHumanGate, true);
  assert.equal(markdownDestinationContract.supportsPdfHtmlPptx, false);
});

test("Local Markdown destination writer uses safe atomic no-overwrite output and manifest hash", async () => {
  const root = await mkdtemp(join(tmpdir(), "osamah-markdown-destination-"));
  const liveProfile = await mkdtemp(join(tmpdir(), "osamah-live-profile-"));
  try {
    const writer = new LocalMarkdownDestinationWriter({ destinationRoot: root, sourceProfileDirectory: liveProfile });
    const input: MarkdownDestinationWriteInput = { reportId: "report-1", relativePath: "reports/destination.md", content: "# Local report\n", reviewState: "approved", redactionState: "clean", warnings: ["factual_verification_is_not_implied"], createdAt: "2026-08-23T00:00:00.000Z" };
    const manifest = await writer.write(input);
    assert.equal(manifest.overwritten, false);
    assert.equal(manifest.bytes, Buffer.byteLength(input.content));
    assert.equal(manifest.sha256, createHash("sha256").update(input.content).digest("hex"));
    assert.equal(await readFile(join(root, input.relativePath), "utf8"), input.content);
    const persistedManifest = JSON.parse(await readFile(join(root, `${input.relativePath}.manifest.json`), "utf8")) as typeof manifest;
    assert.deepEqual(persistedManifest, manifest);
    await assert.rejects(() => writer.write(input), /already exists/);
    await assert.rejects(() => writer.write({ ...input, relativePath: "../escape.md" }), /safe relative|traversal/);
    await assert.rejects(() => writer.write({ ...input, relativePath: "/tmp/escape.md" }), /safe relative/);
    assert.throws(() => new LocalMarkdownDestinationWriter({ destinationRoot: join(liveProfile, "exports"), sourceProfileDirectory: liveProfile }), /separate from the live profile/);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(liveProfile, { recursive: true, force: true });
  }
});
