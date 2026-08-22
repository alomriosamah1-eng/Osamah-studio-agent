import { sanitizeAuditText } from "./agent-contracts.js";

export type SelfDevelopmentKind = "instruction" | "strategy" | "plan" | "skill";
export type SelfDevelopmentStatus = "review_required" | "active" | "archived";
export type SelfDevelopmentProvenance = "user_submitted" | "local_parse" | "agent_suggestion";
export type SelfDevelopmentReviewDecision = "activate" | "archive" | "rollback";

export interface SelfDevelopmentDetails {
  readonly inputs?: readonly string[];
  readonly outputs?: readonly string[];
  readonly tools?: readonly string[];
  readonly permissions?: readonly string[];
  readonly applicability?: string;
  readonly tradeoffs?: string;
  readonly examples?: readonly string[];
  readonly dependencies?: readonly string[];
  readonly acceptanceCriteria?: readonly string[];
}

export interface CreateSelfDevelopmentCandidateRequest {
  readonly kind: SelfDevelopmentKind;
  readonly title: string;
  readonly content: string;
  readonly scope?: string;
  readonly source?: string;
  readonly provenance?: SelfDevelopmentProvenance;
  readonly details?: SelfDevelopmentDetails;
}

export interface SelfDevelopmentCandidate {
  readonly candidateId: string;
  readonly version: 1;
  readonly kind: SelfDevelopmentKind;
  readonly title: string;
  readonly content: string;
  readonly scope: string;
  readonly source: string;
  readonly provenance: SelfDevelopmentProvenance;
  readonly status: SelfDevelopmentStatus;
  readonly visibility: "private";
  readonly providerAccess: "never";
  readonly retention: "until_deleted";
  readonly details: SelfDevelopmentDetails;
  readonly conflicts: readonly string[];
  readonly createdAt: string;
  readonly reviewedAt?: string;
  readonly reviewReason?: string;
}

export interface SelfDevelopmentReviewRequest {
  readonly candidateId: string;
  readonly decision: SelfDevelopmentReviewDecision;
  readonly reason: string;
}

export interface SelfDevelopmentImpactPreview {
  readonly candidate: SelfDevelopmentCandidate;
  readonly canActivate: boolean;
  readonly affectedAreas: readonly string[];
  readonly capabilityChanges: readonly string[];
  readonly executionChanges: false;
  readonly providerAccessChange: "none";
  readonly humanGateChange: "none";
}

export interface SelfDevelopmentCandidatePort {
  create(request: CreateSelfDevelopmentCandidateRequest): SelfDevelopmentCandidate;
  get(candidateId: string): SelfDevelopmentCandidate | undefined;
  list(limit?: number): readonly SelfDevelopmentCandidate[];
  listActive(limit?: number): readonly SelfDevelopmentCandidate[];
  preview(candidateId: string): SelfDevelopmentImpactPreview | undefined;
  review(request: SelfDevelopmentReviewRequest): SelfDevelopmentCandidate;
}

export interface SelfDevelopmentIdFactory {
  next(prefix: string): string;
}

export interface SelfDevelopmentClock {
  now(): string;
}

export class SelfDevelopmentError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "SelfDevelopmentError";
  }
}

const boundedString = (value: string | undefined, fallback: string, maxLength: number): string => {
  const normalized = sanitizeAuditText((value ?? fallback).trim(), maxLength).replace(/\0/g, "").trim();
  if (!normalized) throw new SelfDevelopmentError("Self-development text must not be empty.");
  return normalized;
};

const boundedList = (values: readonly string[] | undefined, maxItems = 16): readonly string[] => {
  if (!values) return [];
  if (values.length > maxItems) throw new SelfDevelopmentError("Self-development detail list is too large.");
  return Object.freeze(values.map((value) => boundedString(value, "", 256)));
};

const normalizeDetails = (details: SelfDevelopmentDetails | undefined): SelfDevelopmentDetails => Object.freeze({
  ...(details?.inputs ? { inputs: boundedList(details.inputs) } : {}),
  ...(details?.outputs ? { outputs: boundedList(details.outputs) } : {}),
  ...(details?.tools ? { tools: boundedList(details.tools) } : {}),
  ...(details?.permissions ? { permissions: boundedList(details.permissions) } : {}),
  ...(details?.applicability ? { applicability: boundedString(details.applicability, "", 512) } : {}),
  ...(details?.tradeoffs ? { tradeoffs: boundedString(details.tradeoffs, "", 1_024) } : {}),
  ...(details?.examples ? { examples: boundedList(details.examples) } : {}),
  ...(details?.dependencies ? { dependencies: boundedList(details.dependencies) } : {}),
  ...(details?.acceptanceCriteria ? { acceptanceCriteria: boundedList(details.acceptanceCriteria) } : {}),
});

const conflictRules: readonly [RegExp, string][] = [
  [/\b(?:disable|bypass|skip|ignore)\b[^.\n]{0,80}\b(?:approval|human gate|security|policy|permission)\b/i, "safety_boundary_override"],
  [/\b(?:grant|elevate)\b[^.\n]{0,80}\b(?:all|unrestricted|admin|root)\b[^.\n]{0,40}\b(?:access|permission|privilege)\b/i, "privilege_escalation_request"],
  [/\b(?:execute|run)\b[^.\n]{0,50}\b(?:shell|terminal|command|script|tool)\b/i, "tool_execution_request"],
  [/\b(?:token|secret|password|api[-_]?key|private[-_]?key)\b\s*[:=]/i, "secret_shaped_content"],
];

const detectConflicts = (value: string): readonly string[] => Object.freeze([...new Set(conflictRules.filter(([rule]) => rule.test(value)).map(([, conflict]) => conflict))]);

const cloneCandidate = (candidate: SelfDevelopmentCandidate): SelfDevelopmentCandidate => Object.freeze({
  ...candidate,
  conflicts: Object.freeze([...candidate.conflicts]),
  details: normalizeDetails(candidate.details),
  ...(candidate.reviewedAt === undefined ? {} : { reviewedAt: candidate.reviewedAt }),
  ...(candidate.reviewReason === undefined ? {} : { reviewReason: candidate.reviewReason }),
});

const validateKind = (kind: SelfDevelopmentKind): void => {
  if (kind !== "instruction" && kind !== "strategy" && kind !== "plan" && kind !== "skill") throw new SelfDevelopmentError("Self-development kind is invalid.");
};

export class InMemorySelfDevelopmentCandidateService implements SelfDevelopmentCandidatePort {
  private readonly candidates = new Map<string, SelfDevelopmentCandidate>();

  public constructor(private readonly dependencies: { readonly ids: SelfDevelopmentIdFactory; readonly clock: SelfDevelopmentClock }) {}

  public create(request: CreateSelfDevelopmentCandidateRequest): SelfDevelopmentCandidate {
    validateKind(request.kind);
    const title = boundedString(request.title, "", 256);
    const content = boundedString(request.content, "", 8_000);
    const scope = boundedString(request.scope, "second-brain", 512);
    const source = boundedString(request.source, "user_input", 512);
    const provenance = request.provenance ?? "user_submitted";
    if (provenance !== "user_submitted" && provenance !== "local_parse" && provenance !== "agent_suggestion") throw new SelfDevelopmentError("Self-development provenance is invalid.");
    const details = normalizeDetails(request.details);
    const conflicts = detectConflicts([title, content, scope, source, JSON.stringify(details)].join("\n"));
    const candidate: SelfDevelopmentCandidate = Object.freeze({
      candidateId: this.dependencies.ids.next("selfdev"),
      version: 1,
      kind: request.kind,
      title,
      content,
      scope,
      source,
      provenance,
      status: "review_required",
      visibility: "private",
      providerAccess: "never",
      retention: "until_deleted",
      details,
      conflicts,
      createdAt: this.dependencies.clock.now(),
    });
    this.candidates.set(candidate.candidateId, candidate);
    return cloneCandidate(candidate);
  }

  public get(candidateId: string): SelfDevelopmentCandidate | undefined {
    const candidate = this.candidates.get(candidateId);
    return candidate ? cloneCandidate(candidate) : undefined;
  }

  public list(limit = 64): readonly SelfDevelopmentCandidate[] {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 128) throw new SelfDevelopmentError("Self-development list limit is invalid.");
    return Object.freeze([...this.candidates.values()].slice(-limit).reverse().map(cloneCandidate));
  }

  public listActive(limit = 64): readonly SelfDevelopmentCandidate[] {
    return Object.freeze(this.list(limit).filter((candidate) => candidate.status === "active"));
  }

  public preview(candidateId: string): SelfDevelopmentImpactPreview | undefined {
    const candidate = this.get(candidateId);
    if (!candidate) return undefined;
    return Object.freeze({
      candidate,
      canActivate: candidate.conflicts.length === 0 && candidate.status !== "archived",
      affectedAreas: ["second_brain", "agent_context"],
      capabilityChanges: ["none"],
      executionChanges: false,
      providerAccessChange: "none",
      humanGateChange: "none",
    });
  }

  public review(request: SelfDevelopmentReviewRequest): SelfDevelopmentCandidate {
    const current = this.candidates.get(request.candidateId);
    if (!current) throw new SelfDevelopmentError("Self-development candidate was not found.");
    const reason = boundedString(request.reason, "", 512);
    if (request.decision === "activate") {
      if (current.status === "active") throw new SelfDevelopmentError("Self-development candidate is already active.");
      if (current.status === "archived") throw new SelfDevelopmentError("Archived self-development candidates cannot be activated.");
      if (current.conflicts.length > 0) throw new SelfDevelopmentError("Self-development candidate has unresolved conflicts.");
    }
    if (request.decision !== "activate" && request.decision !== "archive" && request.decision !== "rollback") throw new SelfDevelopmentError("Self-development review decision is invalid.");
    const nextStatus: SelfDevelopmentStatus = request.decision === "activate" ? "active" : "archived";
    const updated: SelfDevelopmentCandidate = Object.freeze({ ...current, status: nextStatus, reviewedAt: this.dependencies.clock.now(), reviewReason: reason });
    this.candidates.set(updated.candidateId, updated);
    return cloneCandidate(updated);
  }
}

export const selfDevelopmentContract = {
  executesCandidateContent: false,
  mutatesCorePolicy: false,
  grantsPermissions: false,
  createsToolManifest: false,
  raisesProviderAccess: false,
  bypassesHumanGate: false,
  persistsToDisk: false,
} as const;
