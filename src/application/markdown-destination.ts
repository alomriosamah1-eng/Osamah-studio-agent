import type { AgentAuthorizationDecision, AgentAuthorizationPort } from "./agent-contracts.js";
import type { MarkdownExportPort, MarkdownExportPreview } from "./markdown-export.js";

export interface MarkdownDestinationWriteRequest {
  readonly reportId: string;
  readonly relativePath: string;
  readonly approvalId?: string;
}

export interface MarkdownDestinationWriteInput {
  readonly reportId: string;
  readonly relativePath: string;
  readonly content: string;
  readonly reviewState: MarkdownExportPreview["reviewState"];
  readonly redactionState: MarkdownExportPreview["redactionState"];
  readonly warnings: readonly string[];
  readonly createdAt: string;
}

export interface MarkdownDestinationManifest {
  readonly formatVersion: 1;
  readonly createdAt: string;
  readonly reportId: string;
  readonly relativePath: string;
  readonly manifestRelativePath: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly reviewState: MarkdownExportPreview["reviewState"];
  readonly redactionState: MarkdownExportPreview["redactionState"];
  readonly warnings: readonly string[];
  readonly overwritten: false;
}

export interface MarkdownDestinationPort {
  write(input: MarkdownDestinationWriteInput): Promise<MarkdownDestinationManifest>;
}

export type MarkdownDestinationWriteResult =
  | {
      readonly status: "written";
      readonly reportId: string;
      readonly relativePath: string;
      readonly manifest: MarkdownDestinationManifest;
      readonly warnings: readonly string[];
    }
  | {
      readonly status: "approval_required";
      readonly reportId: string;
      readonly relativePath: string;
      readonly approvalId: string;
      readonly reviewState: MarkdownExportPreview["reviewState"];
      readonly redactionState: MarkdownExportPreview["redactionState"];
      readonly warnings: readonly string[];
    }
  | {
      readonly status: "blocked" | "denied";
      readonly reportId: string;
      readonly relativePath: string;
      readonly reason: string;
      readonly warnings: readonly string[];
    };

export interface MarkdownDestinationServiceOptions {
  readonly markdownExport: Pick<MarkdownExportPort, "preview">;
  readonly destination: MarkdownDestinationPort;
  readonly authorization: Pick<AgentAuthorizationPort, "authorize">;
  readonly now: () => string;
}

const safeReportId = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,255}$/u;
const safeApprovalId = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,255}$/u;

const cleanReportId = (value: string): string => {
  if (typeof value !== "string" || !safeReportId.test(value) || value.length > 256) throw new Error("reportId is invalid.");
  return value;
};

const cleanRelativeMarkdownPath = (value: string): string => {
  if (typeof value !== "string" || value.length < 1 || value.length > 512 || value.includes("\u0000") || value.includes("\\") || value.startsWith("/") || value.startsWith("~") || value.includes(":")) {
    throw new Error("Markdown destination must be a safe relative path.");
  }
  const segments = value.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) throw new Error("Markdown destination must not contain traversal segments.");
  if (!/\.md$/iu.test(value)) throw new Error("Markdown destination must end with .md.");
  return value;
};

const cleanApprovalId = (value: string | undefined): string | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !safeApprovalId.test(value) || value.length > 256) throw new Error("approvalId is invalid.");
  return value;
};

const actionFor = (reportId: string, relativePath: string) => ({
  actionId: "production-markdown-destination-write",
  sessionId: "production-studio",
  kind: "filesystem.write" as const,
  risk: "medium" as const,
  scope: `reportId=${reportId};relativePath=${relativePath}`,
  idempotencyKey: `markdown-destination:${reportId}:${relativePath}`,
});

const decisionReason = (decision: AgentAuthorizationDecision): string => decision.reason || "Filesystem write was denied.";

export class MarkdownDestinationService {
  public constructor(private readonly options: MarkdownDestinationServiceOptions) {}

  public async write(request: MarkdownDestinationWriteRequest): Promise<MarkdownDestinationWriteResult> {
    const reportId = cleanReportId(request.reportId);
    const relativePath = cleanRelativeMarkdownPath(request.relativePath);
    const approvalId = cleanApprovalId(request.approvalId);
    const preview = this.options.markdownExport.preview(reportId);

    if (preview.reviewState !== "approved") {
      return {
        status: "blocked",
        reportId,
        relativePath,
        reason: "Report must have explicit local approval before Markdown destination writing.",
        warnings: [...new Set([...preview.warnings, "report_review_required_before_destination_write"])].slice(0, 64),
      };
    }

    const decision = this.options.authorization.authorize(actionFor(reportId, relativePath), approvalId);
    if (decision.decision === "approval_required") {
      return {
        status: "approval_required",
        reportId,
        relativePath,
        approvalId: decision.approvalId,
        reviewState: preview.reviewState,
        redactionState: preview.redactionState,
        warnings: [...new Set([...preview.warnings, "human_gate_required_before_destination_write"])].slice(0, 64),
      };
    }
    if (decision.decision !== "allowed") {
      return { status: "denied", reportId, relativePath, reason: decisionReason(decision), warnings: [...preview.warnings].slice(0, 64) };
    }

    const manifest = await this.options.destination.write({
      reportId,
      relativePath,
      content: preview.markdown,
      reviewState: preview.reviewState,
      redactionState: preview.redactionState,
      warnings: preview.warnings,
      createdAt: this.options.now(),
    });
    return { status: "written", reportId, relativePath, manifest, warnings: [...manifest.warnings].slice(0, 64) };
  }
}

export const markdownDestinationContract = {
  mutatesFilesystem: true,
  writesMarkdownOnly: true,
  writesManifest: true,
  usesProviders: false,
  executesCommands: false,
  overwritesExisting: false,
  guardsLiveProfile: true,
  requiresReportApproval: true,
  requiresHumanGate: true,
  supportsPdfHtmlPptx: false,
} as const;
