import type { ReportDocument, ReportDocumentPort, ReportEvidence, ReportClaim } from "./report-document.js";
import { ReportDocumentError } from "./report-document.js";

export interface MarkdownExportPreview {
  readonly reportId: string;
  readonly filename: string;
  readonly markdown: string;
  readonly characterCount: number;
  readonly redactionState: ReportDocument["redactionState"];
  readonly reviewState: ReportDocument["reviewState"];
  readonly warnings: readonly string[];
}

export interface MarkdownExportPort {
  preview(reportId: string): MarkdownExportPreview;
}

export interface MarkdownExportOptions {
  readonly maxCharacters?: number;
}

const maxCharactersDefault = 256 * 1024;
const safeReportId = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,255}$/u;

const cleanReportId = (reportId: string): string => {
  if (typeof reportId !== "string" || !safeReportId.test(reportId) || reportId.length > 256) throw new ReportDocumentError("reportId is invalid.");
  return reportId;
};

const escapeHeading = (value: string): string => value.replace(/[\r\n]+/g, " ").trim();
const bulletList = (values: readonly string[]): string => values.length ? values.map((value) => `- ${value}`).join("\n") : "- لا توجد بيانات مسجلة.";
const evidenceRefs = (evidence: ReportEvidence): string => [evidence.sourceId && `source:${evidence.sourceId}`, evidence.citationId && `citation:${evidence.citationId}`, evidence.artifactId && `artifact:${evidence.artifactId}`].filter((value): value is string => Boolean(value)).join(", ");

const claimBlock = (claim: ReportClaim, evidenceById: ReadonlyMap<string, ReportEvidence>): string => {
  const evidence = claim.evidenceIds.map((id) => evidenceById.get(id)).filter((item): item is ReportEvidence => item !== undefined);
  const refs = evidence.map((item) => `${item.evidenceId} — ${item.label}${evidenceRefs(item) ? ` (${evidenceRefs(item)})` : ""}`).join("; ") || "لا يوجد دليل مرتبط.";
  const warnings = claim.warnings.length ? `\nتحذيرات: ${claim.warnings.join(", ")}` : "";
  return `### [${claim.verificationState}] ${escapeHeading(claim.text)}\n\nالأدلة: ${refs}${warnings}`;
};

const renderMarkdown = (report: ReportDocument): string => {
  const evidenceById = new Map(report.evidence.map((item) => [item.evidenceId, item]));
  const evidenceRows = report.evidence.map((item) => `- **${item.evidenceId}** — ${item.label} — الحالة: ${item.verificationState}${evidenceRefs(item) ? ` — ${evidenceRefs(item)}` : ""}${item.warnings.length ? ` — تحذيرات: ${item.warnings.join(", ")}` : ""}`).join("\n") || "- لا توجد أدلة مسجلة.";
  const claims = report.claims.map((claim) => claimBlock(claim, evidenceById)).join("\n\n") || "لا توجد claims مسجلة.";
  const warnings = [...new Set(["markdown_preview_is_metadata_only", "factual_verification_is_not_implied", ...(report.reviewState !== "approved" ? ["report_review_required_before_publish"] : []), ...report.warnings])];
  return [
    `# ${escapeHeading(report.title)}`,
    "",
    `> Report ID: ${report.reportId}`,
    `> Kind: ${report.kind}`,
    `> Review state: ${report.reviewState}`,
    `> Redaction state: ${report.redactionState}`,
    `> Generated at: ${report.generatedAt}`,
    `> Author: ${escapeHeading(report.author)}`,
    "",
    "## النطاق",
    "",
    report.scope,
    "",
    "## المدخلات",
    "",
    bulletList(report.inputs),
    "",
    "## الأدلة",
    "",
    evidenceRows,
    "",
    "## الادعاءات",
    "",
    claims,
    "",
    "## الافتراضات",
    "",
    bulletList(report.assumptions),
    "",
    "## القرارات",
    "",
    bulletList(report.decisions),
    "",
    "## المخاطر",
    "",
    bulletList(report.risks),
    "",
    "## الأسئلة غير المحسومة",
    "",
    bulletList(report.unresolvedQuestions),
    "",
    "## المراجع المرتبطة",
    "",
    bulletList([...report.sourceRefs.map((id) => `source:${id}`), ...report.artifactRefs.map((id) => `artifact:${id}`)]),
    "",
    "## التحذيرات والحدود",
    "",
    bulletList(warnings),
    "",
  ].join("\n");
};

export class InMemoryMarkdownExportService implements MarkdownExportPort {
  private readonly maxCharacters: number;

  public constructor(private readonly reports: Pick<ReportDocumentPort, "get">, options: MarkdownExportOptions = {}) {
    this.maxCharacters = options.maxCharacters ?? maxCharactersDefault;
    if (!Number.isSafeInteger(this.maxCharacters) || this.maxCharacters < 1_024 || this.maxCharacters > maxCharactersDefault) throw new ReportDocumentError("markdown export character limit is invalid.");
  }

  public preview(reportId: string): MarkdownExportPreview {
    const cleanId = cleanReportId(reportId);
    const report = this.reports.get(cleanId);
    if (!report) throw new ReportDocumentError("report document was not found.");
    const markdown = renderMarkdown(report);
    if (markdown.length > this.maxCharacters) throw new ReportDocumentError("markdown export exceeds bounded limits.");
    return {
      reportId: report.reportId,
      filename: `report-${report.reportId.replace(/[^a-zA-Z0-9._-]/gu, "-")}.md`,
      markdown,
      characterCount: markdown.length,
      redactionState: report.redactionState,
      reviewState: report.reviewState,
      warnings: [...new Set(["markdown_preview_is_metadata_only", "factual_verification_is_not_implied", ...(report.reviewState !== "approved" ? ["report_review_required_before_publish"] : []), ...report.warnings])].slice(0, 64),
    };
  }
}

export const markdownExportContract = {
  mutatesFilesystem: false,
  executesCommands: false,
  invokesProviders: false,
  writesArtifact: false,
  requiresHumanGateForMutation: true,
  factualVerificationIsNotImplied: true,
} as const;
