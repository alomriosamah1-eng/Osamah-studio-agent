import type { ArtifactAssemblyPort } from "./artifact-assembly.js";
import type { ContentPlanPort } from "./content-plan.js";
import type { SourceRegistryPort, SourceVerificationState } from "./source-registry.js";
import { sanitizeAuditText } from "./agent-contracts.js";

export type ReportKind = "project_discovery" | "market_research" | "feasibility" | "business_model" | "product_strategy" | "technical_analysis" | "architecture" | "agent_system" | "security" | "dependency" | "testing" | "performance" | "release" | "maintenance" | "final_handover";
export type ReportClaimState = "unresolved" | "supported" | "conflicted";
export type ReportReviewState = "review_required" | "approved" | "blocked";
export type ReportRedactionState = "clean" | "redacted";

export interface ReportEvidence {
  readonly evidenceId: string;
  readonly label: string;
  readonly sourceId?: string;
  readonly citationId?: string;
  readonly artifactId?: string;
  readonly verificationState: ReportClaimState;
  readonly warnings: readonly string[];
}

export interface ReportClaim {
  readonly claimId: string;
  readonly text: string;
  readonly evidenceIds: readonly string[];
  readonly verificationState: ReportClaimState;
  readonly warnings: readonly string[];
}

export interface ReportDocument {
  readonly reportId: string;
  readonly kind: ReportKind;
  readonly title: string;
  readonly scope: string;
  readonly generatedAt: string;
  readonly author: string;
  readonly inputs: readonly string[];
  readonly evidence: readonly ReportEvidence[];
  readonly claims: readonly ReportClaim[];
  readonly assumptions: readonly string[];
  readonly decisions: readonly string[];
  readonly risks: readonly string[];
  readonly unresolvedQuestions: readonly string[];
  readonly reviewState: ReportReviewState;
  readonly reviewReason?: string;
  readonly reviewedAt?: string;
  readonly sourceRefs: readonly string[];
  readonly artifactRefs: readonly string[];
  readonly redactionState: ReportRedactionState;
  readonly warnings: readonly string[];
}

export interface ReportEvidenceInput {
  readonly label: string;
  readonly sourceId?: string;
  readonly citationId?: string;
  readonly artifactId?: string;
}

export interface ReportClaimInput {
  readonly text: string;
  readonly evidenceIds?: readonly string[];
}

export interface CreateReportDocumentRequest {
  readonly kind: ReportKind;
  readonly title: string;
  readonly scope: string;
  readonly author?: string;
  readonly inputs?: readonly string[];
  readonly evidence?: readonly ReportEvidenceInput[];
  readonly claims?: readonly ReportClaimInput[];
  readonly assumptions?: readonly string[];
  readonly decisions?: readonly string[];
  readonly risks?: readonly string[];
  readonly unresolvedQuestions?: readonly string[];
  readonly contentPlanId?: string;
  readonly artifactId?: string;
}

export interface ReportReviewDecision {
  readonly reportId: string;
  readonly decision: "approve" | "block";
  readonly reason: string;
}

export interface ReportDocumentPort {
  create(request: CreateReportDocumentRequest): ReportDocument;
  get(reportId: string): ReportDocument | undefined;
  list(limit?: number): readonly ReportDocument[];
  review(decision: ReportReviewDecision): ReportDocument;
}

export interface ReportDocumentOptions {
  readonly nextId?: (prefix: string) => string;
  readonly now?: () => string;
  readonly maxReports?: number;
}

export class ReportDocumentError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ReportDocumentError";
  }
}

const reportKinds: readonly ReportKind[] = ["project_discovery", "market_research", "feasibility", "business_model", "product_strategy", "technical_analysis", "architecture", "agent_system", "security", "dependency", "testing", "performance", "release", "maintenance", "final_handover"];
const verificationStates: readonly SourceVerificationState[] = ["unverified", "metadata_validated", "content_validated", "invalid"];
const safeId = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,255}$/u;

const cleanText = (value: string, field: string, maxLength: number, allowNewlines = false): { value: string; redacted: boolean } => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength || trimmed.includes("\0") || (!allowNewlines && (trimmed.includes("\r") || trimmed.includes("\n")))) throw new ReportDocumentError(`${field} is invalid.`);
  const sanitized = sanitizeAuditText(trimmed, maxLength);
  return { value: sanitized, redacted: sanitized !== trimmed };
};

const cleanId = (value: string, field: string): string => {
  const result = cleanText(value, field, 256).value;
  if (!safeId.test(result)) throw new ReportDocumentError(`${field} is invalid.`);
  return result;
};

const cleanList = (values: readonly string[] | undefined, field: string, maxItems: number, maxLength: number): { values: readonly string[]; redacted: boolean } => {
  if (values === undefined) return { values: [], redacted: false };
  if (!Array.isArray(values) || values.length > maxItems) throw new ReportDocumentError(`${field} exceeds bounded limits.`);
  let redacted = false;
  const cleaned = values.map((value) => {
    const result = cleanText(value, field, maxLength);
    redacted ||= result.redacted;
    return result.value;
  });
  if (new Set(cleaned).size !== cleaned.length) throw new ReportDocumentError(`${field} contains duplicates.`);
  return { values: cleaned, redacted };
};

const isValidKind = (kind: ReportKind): boolean => reportKinds.includes(kind);

const sourceState = (state: SourceVerificationState): ReportClaimState => state === "invalid" ? "conflicted" : "supported";

export class InMemoryReportDocumentService implements ReportDocumentPort {
  private readonly reports = new Map<string, ReportDocument>();
  private readonly nextId: (prefix: string) => string;
  private readonly now: () => string;
  private readonly maxReports: number;

  public constructor(
    private readonly sources: Pick<SourceRegistryPort, "getSource" | "getCitation">,
    private readonly contentPlans: Pick<ContentPlanPort, "getPlan">,
    private readonly artifacts: Pick<ArtifactAssemblyPort, "getDraft">,
    options: ReportDocumentOptions = {},
  ) {
    let sequence = 0;
    this.nextId = options.nextId ?? ((prefix) => `${prefix}-${++sequence}`);
    this.now = options.now ?? (() => new Date().toISOString());
    this.maxReports = options.maxReports ?? 64;
  }

  public create(request: CreateReportDocumentRequest): ReportDocument {
    if (this.reports.size >= this.maxReports) throw new ReportDocumentError("report document limit reached.");
    if (!isValidKind(request.kind)) throw new ReportDocumentError("report kind is invalid.");
    let redacted = false;
    const title = cleanText(request.title, "report title", 512);
    const scope = cleanText(request.scope, "report scope", 2_000);
    const author = cleanText(request.author ?? "Osamah Studio Agent", "report author", 256);
    redacted ||= title.redacted || scope.redacted || author.redacted;
    const inputs = cleanList(request.inputs, "inputs", 32, 512);
    const inputValues = [...inputs.values];
    const assumptions = cleanList(request.assumptions, "assumptions", 32, 1_000);
    const decisions = cleanList(request.decisions, "decisions", 32, 1_000);
    const risks = cleanList(request.risks, "risks", 32, 1_000);
    const unresolvedQuestions = cleanList(request.unresolvedQuestions, "unresolvedQuestions", 32, 1_000);
    redacted ||= inputs.redacted || assumptions.redacted || decisions.redacted || risks.redacted || unresolvedQuestions.redacted;

    const sourceRefs = new Set<string>();
    const artifactRefs = new Set<string>();
    const evidence: ReportEvidence[] = [];
    const evidenceByKey = new Map<string, string>();
    const warnings = new Set<string>();
    const addEvidence = (input: ReportEvidenceInput, evidenceId: string): string => {
      const label = cleanText(input.label, "evidence label", 512);
      redacted ||= label.redacted;
      const sourceId = input.sourceId === undefined ? undefined : cleanId(input.sourceId, "sourceId");
      const citationId = input.citationId === undefined ? undefined : cleanId(input.citationId, "citationId");
      const artifactId = input.artifactId === undefined ? undefined : cleanId(input.artifactId, "artifactId");
      if (!sourceId && !citationId && !artifactId) throw new ReportDocumentError("evidence needs a source, citation, or artifact reference.");
      let verificationState: ReportClaimState = "supported";
      const evidenceWarnings = new Set<string>();
      if (sourceId) {
        const source = this.sources.getSource(sourceId);
        if (!source) throw new ReportDocumentError("evidence source was not found.");
        sourceRefs.add(sourceId);
        verificationState = sourceState(source.verificationState);
        if (source.verificationState === "unverified") evidenceWarnings.add("source_unverified");
      }
      if (citationId) {
        const citation = this.sources.getCitation(citationId);
        if (!citation) throw new ReportDocumentError("evidence citation was not found.");
        const citationSource = this.sources.getSource(citation.sourceId);
        if (!citationSource) throw new ReportDocumentError("evidence citation source was not found.");
        if (sourceId && citation.sourceId !== sourceId) throw new ReportDocumentError("evidence citation does not match source.");
        sourceRefs.add(citation.sourceId);
        verificationState = verificationState === "conflicted" || citation.verificationState === "invalid" || citationSource.verificationState === "invalid" ? "conflicted" : "supported";
        if (citation.verificationState === "unverified" || citationSource.verificationState === "unverified") evidenceWarnings.add("citation_or_source_unverified");
      }
      if (artifactId) {
        const artifact = this.artifacts.getDraft(artifactId);
        if (!artifact) throw new ReportDocumentError("evidence artifact was not found.");
        artifactRefs.add(artifactId);
        if (artifact.reviewState === "blocked") {
          verificationState = "conflicted";
          evidenceWarnings.add("artifact_review_blocked");
        } else if (artifact.reviewState === "needs_review") {
          evidenceWarnings.add("artifact_review_required");
        }
      }
      if (verificationState === "conflicted") warnings.add("report_has_conflicted_evidence");
      const record: ReportEvidence = { evidenceId, label: label.value, sourceId, citationId, artifactId, verificationState, warnings: [...evidenceWarnings].slice(0, 8) };
      evidence.push(record);
      return evidenceId;
    };

    if (request.contentPlanId !== undefined) {
      const planId = cleanId(request.contentPlanId, "contentPlanId");
      const plan = this.contentPlans.getPlan(planId);
      if (!plan) throw new ReportDocumentError("content plan was not found.");
      inputValues.push(planId);
      plan.claims.forEach((claim) => claim.citationIds.forEach((citationId) => {
        const key = `citation:${citationId}`;
        if (!evidenceByKey.has(key)) evidenceByKey.set(key, addEvidence({ label: `Content Plan citation ${citationId}`, citationId }, this.nextId("evidence")));
      }));
      if (plan.integrity.unresolvedClaims > 0) warnings.add("content_plan_has_unresolved_claims");
      if (plan.integrity.conflictedClaims > 0) warnings.add("content_plan_has_conflicted_claims");
    }
    if (request.artifactId !== undefined) {
      const artifactId = cleanId(request.artifactId, "artifactId");
      const artifact = this.artifacts.getDraft(artifactId);
      if (!artifact) throw new ReportDocumentError("artifact was not found.");
      inputValues.push(artifactId);
      artifactRefs.add(artifactId);
      artifact.manifest.sources.forEach((sourceId) => {
        const key = `source:${sourceId}`;
        if (!evidenceByKey.has(key)) evidenceByKey.set(key, addEvidence({ label: `Artifact source ${sourceId}`, sourceId, artifactId }, this.nextId("evidence")));
      });
      if (artifact.reviewState !== "ready_for_render") warnings.add(`artifact_review_${artifact.reviewState}`);
    }
    (request.evidence ?? []).forEach((input) => addEvidence(input, this.nextId("evidence")));

    const claimInputs: ReportClaimInput[] = [...(request.claims ?? [])];
    if (request.contentPlanId !== undefined) {
      const plan = this.contentPlans.getPlan(cleanId(request.contentPlanId, "contentPlanId"));
      if (plan) plan.claims.forEach((claim) => claimInputs.push({ text: claim.text, evidenceIds: claim.citationIds.map((citationId) => evidenceByKey.get(`citation:${citationId}`)).filter((value): value is string => value !== undefined) }));
    }
    if (claimInputs.length > 128) throw new ReportDocumentError("report claim limit reached.");
    const claims: ReportClaim[] = claimInputs.map((input, index) => {
      const text = cleanText(input.text, "claim text", 2_000);
      redacted ||= text.redacted;
      const evidenceIds = [...new Set(input.evidenceIds ?? [])].map((evidenceId) => {
        const cleaned = cleanId(evidenceId, "evidenceId");
        if (!evidence.some((candidate) => candidate.evidenceId === cleaned)) throw new ReportDocumentError("claim evidence was not found.");
        return cleaned;
      });
      const claimWarnings = new Set<string>();
      if (!evidenceIds.length) claimWarnings.add("claim_has_no_evidence");
      const linked = evidenceIds.map((evidenceId) => evidence.find((candidate) => candidate.evidenceId === evidenceId)!);
      if (linked.some((item) => item.verificationState === "conflicted")) claimWarnings.add("claim_evidence_conflicted");
      if (linked.some((item) => item.warnings.length > 0)) claimWarnings.add("claim_evidence_unverified");
      const verificationState: ReportClaimState = !evidenceIds.length ? "unresolved" : linked.some((item) => item.verificationState === "conflicted") ? "conflicted" : "supported";
      if (verificationState !== "supported") warnings.add(`claim_${verificationState}`);
      return { claimId: this.nextId(`claim-${index + 1}`), text: text.value, evidenceIds, verificationState, warnings: [...claimWarnings].slice(0, 8) };
    });
    if (!claims.length) warnings.add("report_has_no_claims");
    const reviewState: ReportReviewState = claims.some((claim) => claim.verificationState === "conflicted") ? "blocked" : "review_required";
    const report: ReportDocument = {
      reportId: this.nextId("report"), kind: request.kind, title: title.value, scope: scope.value, generatedAt: this.now(), author: author.value,
      inputs: [...new Set(inputValues)].slice(0, 32), evidence: evidence.slice(0, 256), claims, assumptions: assumptions.values, decisions: decisions.values, risks: risks.values, unresolvedQuestions: unresolvedQuestions.values,
      reviewState, sourceRefs: [...sourceRefs].sort().slice(0, 256), artifactRefs: [...artifactRefs].sort().slice(0, 64), redactionState: redacted ? "redacted" : "clean", warnings: [...warnings].slice(0, 64),
    };
    this.reports.set(report.reportId, report);
    return report;
  }

  public get(reportId: string): ReportDocument | undefined {
    return this.reports.get(cleanId(reportId, "reportId"));
  }

  public list(limit = 64): readonly ReportDocument[] {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 64) throw new ReportDocumentError("report list limit is invalid.");
    return [...this.reports.values()].slice(0, limit);
  }

  public review(decision: ReportReviewDecision): ReportDocument {
    const reportId = cleanId(decision.reportId, "reportId");
    const report = this.reports.get(reportId);
    if (!report) throw new ReportDocumentError("report document was not found.");
    if (report.reviewState !== "review_required") throw new ReportDocumentError("report document is not awaiting review.");
    const reason = cleanText(decision.reason, "review reason", 512).value;
    if (decision.decision === "approve") {
      if (report.claims.some((claim) => claim.verificationState !== "supported")) throw new ReportDocumentError("report requires claim evidence review before approval.");
      const approved: ReportDocument = { ...report, reviewState: "approved", reviewedAt: this.now(), reviewReason: reason, warnings: [...new Set([...report.warnings, "user_approved_not_externally_verified"])] };
      this.reports.set(reportId, approved);
      return approved;
    }
    if (decision.decision !== "block") throw new ReportDocumentError("report review decision is invalid.");
    const blocked: ReportDocument = { ...report, reviewState: "blocked", reviewedAt: this.now(), reviewReason: reason };
    this.reports.set(reportId, blocked);
    return blocked;
  }
}

export const reportDocumentContract = {
  mutatesFilesystem: false,
  executesCommands: false,
  invokesProviders: false,
  rendersOrExports: false,
  requiresHumanGateForMutation: true,
  factualVerificationIsNotImplied: true,
} as const;
