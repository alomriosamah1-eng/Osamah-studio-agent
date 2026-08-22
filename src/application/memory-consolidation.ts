import { sanitizeAuditText } from "./agent-contracts.js";
import type { MemoryCapturePort, MemoryEntry } from "./memory-capture.js";

export type MemoryCandidateKind = "summary" | "fact" | "decision" | "procedure" | "episode";
export type MemoryCandidateState = "review_required" | "consolidated" | "archived";
export type MemorySensitivity = "routine" | "personal" | "sensitive" | "secret_shaped";
export type MemoryCandidateReviewDecision = "consolidate" | "archive" | "rollback";

export interface MemoryCandidateSource {
  readonly entryId: string;
  readonly state: MemoryEntry["state"];
  readonly kind: MemoryEntry["kind"];
}

export interface CreateMemoryCandidateRequest {
  readonly kind: MemoryCandidateKind;
  readonly title: string;
  readonly content: string;
  readonly sourceEntryIds: readonly string[];
  readonly scope?: string;
  readonly importance?: number;
  readonly expiresAt?: string;
}

export interface MemoryCandidate {
  readonly candidateId: string;
  readonly version: 1;
  readonly kind: MemoryCandidateKind;
  readonly title: string;
  readonly content: string;
  readonly sourceEntryIds: readonly string[];
  readonly sources: readonly MemoryCandidateSource[];
  readonly scope: string;
  readonly importance: number;
  readonly expiresAt?: string;
  readonly sensitivity: MemorySensitivity;
  readonly state: MemoryCandidateState;
  readonly visibility: "private";
  readonly providerAccess: "never";
  readonly createdAt: string;
  readonly reviewedAt?: string;
  readonly reviewReason?: string;
  readonly blockedReasons: readonly string[];
}

export interface MemoryCandidateReviewRequest {
  readonly candidateId: string;
  readonly decision: MemoryCandidateReviewDecision;
  readonly reason: string;
}

export interface MemoryConsolidationPreview {
  readonly candidate: MemoryCandidate;
  readonly canConsolidate: boolean;
  readonly sourceStates: readonly MemoryEntry["state"][];
  readonly retrievalEffects: readonly string[];
  readonly providerAccessChange: "none";
  readonly sourceMutation: false;
  readonly embeddingIndex: "not_configured";
}

export interface MemoryConsolidationPort {
  create(request: CreateMemoryCandidateRequest): MemoryCandidate;
  get(candidateId: string): MemoryCandidate | undefined;
  list(limit?: number): readonly MemoryCandidate[];
  listConsolidated(limit?: number): readonly MemoryCandidate[];
  preview(candidateId: string): MemoryConsolidationPreview | undefined;
  review(request: MemoryCandidateReviewRequest): MemoryCandidate;
}

export interface MemoryConsolidationIdFactory {
  next(prefix: string): string;
}

export interface MemoryConsolidationClock {
  now(): string;
}

export class MemoryConsolidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "MemoryConsolidationError";
  }
}

const candidateKinds: readonly MemoryCandidateKind[] = ["summary", "fact", "decision", "procedure", "episode"];
const maxSourceEntries = 8;

const cleanText = (value: string | undefined, fallback: string, maxLength: number, allowNewlines = false): string => {
  const normalized = sanitizeAuditText((value ?? fallback).trim(), maxLength).replace(/\0/g, "").trim();
  if (!normalized || (!allowNewlines && (normalized.includes("\n") || normalized.includes("\r")))) throw new MemoryConsolidationError("Memory candidate text is invalid.");
  return normalized;
};

const cleanSourceIds = (values: readonly string[]): readonly string[] => {
  if (values.length < 1 || values.length > maxSourceEntries) throw new MemoryConsolidationError("Memory candidate source count is invalid.");
  const cleaned = values.map((value) => cleanText(value, "", 256));
  if (new Set(cleaned).size !== cleaned.length) throw new MemoryConsolidationError("Memory candidate sources must be unique.");
  return Object.freeze(cleaned);
};

const classifySensitivity = (value: string): MemorySensitivity => {
  if (/\b(?:token|secret|password|api[-_]?key|private[-_]?key)\b\s*[:=]/i.test(value)) return "secret_shaped";
  if (/\b(?:medical|health|financial|identity|confidential|private)\b/i.test(value)) return "sensitive";
  if (/\b(?:my|أنا|خاصة|personal|family|home)\b/i.test(value)) return "personal";
  return "routine";
};

const detectBlockedReasons = (scope: string, sensitivity: MemorySensitivity, sources: readonly MemoryCandidateSource[]): readonly string[] => {
  const reasons = new Set<string>();
  if (sensitivity === "secret_shaped") reasons.add("secret_shaped_content");
  if (sensitivity === "sensitive") reasons.add("sensitive_content_requires_separate_policy");
  if (scope.toLocaleLowerCase().includes("provider") || scope.toLocaleLowerCase().includes("external")) reasons.add("scope_escape");
  if (sources.some((source) => source.state !== "confirmed")) reasons.add("source_not_confirmed");
  return Object.freeze([...reasons]);
};

const cloneCandidate = (candidate: MemoryCandidate): MemoryCandidate => Object.freeze({
  ...candidate,
  sourceEntryIds: Object.freeze([...candidate.sourceEntryIds]),
  sources: Object.freeze(candidate.sources.map((source) => Object.freeze({ ...source }))),
  blockedReasons: Object.freeze([...candidate.blockedReasons]),
  ...(candidate.expiresAt === undefined ? {} : { expiresAt: candidate.expiresAt }),
  ...(candidate.reviewedAt === undefined ? {} : { reviewedAt: candidate.reviewedAt }),
  ...(candidate.reviewReason === undefined ? {} : { reviewReason: candidate.reviewReason }),
});

export class InMemoryMemoryConsolidationService implements MemoryConsolidationPort {
  private readonly candidates = new Map<string, MemoryCandidate>();

  public constructor(private readonly dependencies: { readonly memory: Pick<MemoryCapturePort, "get">; readonly ids: MemoryConsolidationIdFactory; readonly clock: MemoryConsolidationClock }) {}

  public create(request: CreateMemoryCandidateRequest): MemoryCandidate {
    if (!candidateKinds.includes(request.kind)) throw new MemoryConsolidationError("Memory candidate kind is invalid.");
    const title = cleanText(request.title, "", 512);
    const content = cleanText(request.content, "", 16_000, true);
    const sourceEntryIds = cleanSourceIds(request.sourceEntryIds);
    const scope = cleanText(request.scope, "second-brain", 512);
    const importance = request.importance ?? 3;
    if (!Number.isSafeInteger(importance) || importance < 1 || importance > 5) throw new MemoryConsolidationError("Memory candidate importance is invalid.");
    if (request.expiresAt !== undefined && (!cleanText(request.expiresAt, "", 128) || !Number.isFinite(Date.parse(request.expiresAt)))) throw new MemoryConsolidationError("Memory candidate expiry is invalid.");
    const sourceEntries = sourceEntryIds.map((entryId) => {
      const entry = this.dependencies.memory.get(entryId);
      if (!entry) throw new MemoryConsolidationError("Memory candidate source is unknown.");
      return Object.freeze({ entryId: entry.entryId, state: entry.state, kind: entry.kind });
    });
    const sensitivity = classifySensitivity(`${title}\n${content}`);
    const blockedReasons = detectBlockedReasons(scope, sensitivity, sourceEntries);
    const candidate: MemoryCandidate = Object.freeze({
      candidateId: this.dependencies.ids.next("memory-candidate"),
      version: 1,
      kind: request.kind,
      title,
      content,
      sourceEntryIds,
      sources: Object.freeze(sourceEntries),
      scope,
      importance,
      ...(request.expiresAt === undefined ? {} : { expiresAt: request.expiresAt }),
      sensitivity,
      state: "review_required",
      visibility: "private",
      providerAccess: "never",
      createdAt: this.dependencies.clock.now(),
      blockedReasons,
    });
    this.candidates.set(candidate.candidateId, candidate);
    return cloneCandidate(candidate);
  }

  public get(candidateId: string): MemoryCandidate | undefined {
    const candidate = this.candidates.get(cleanText(candidateId, "", 256));
    return candidate ? cloneCandidate(candidate) : undefined;
  }

  public list(limit = 64): readonly MemoryCandidate[] {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 128) throw new MemoryConsolidationError("Memory candidate list limit is invalid.");
    return Object.freeze([...this.candidates.values()].slice(-limit).reverse().map(cloneCandidate));
  }

  public listConsolidated(limit = 64): readonly MemoryCandidate[] {
    return Object.freeze(this.list(limit).filter((candidate) => candidate.state === "consolidated"));
  }

  public preview(candidateId: string): MemoryConsolidationPreview | undefined {
    const candidate = this.get(candidateId);
    if (!candidate) return undefined;
    return Object.freeze({
      candidate,
      canConsolidate: candidate.blockedReasons.length === 0 && candidate.state !== "archived",
      sourceStates: Object.freeze(candidate.sources.map((source) => source.state)),
      retrievalEffects: ["none"],
      providerAccessChange: "none",
      sourceMutation: false,
      embeddingIndex: "not_configured",
    });
  }

  public review(request: MemoryCandidateReviewRequest): MemoryCandidate {
    const current = this.candidates.get(cleanText(request.candidateId, "", 256));
    if (!current) throw new MemoryConsolidationError("Memory candidate was not found.");
    const reason = cleanText(request.reason, "", 512);
    if (request.decision !== "consolidate" && request.decision !== "archive" && request.decision !== "rollback") throw new MemoryConsolidationError("Memory candidate review decision is invalid.");
    if (request.decision === "consolidate") {
      if (current.state === "consolidated") throw new MemoryConsolidationError("Memory candidate is already consolidated.");
      if (current.state === "archived") throw new MemoryConsolidationError("Archived memory candidates cannot be consolidated.");
      if (current.blockedReasons.length > 0) throw new MemoryConsolidationError("Memory candidate has blocked reasons.");
    }
    const updated: MemoryCandidate = Object.freeze({ ...current, state: request.decision === "consolidate" ? "consolidated" : "archived", reviewedAt: this.dependencies.clock.now(), reviewReason: reason });
    this.candidates.set(updated.candidateId, updated);
    return cloneCandidate(updated);
  }
}

export const memoryConsolidationContract = {
  persistsToDisk: false,
  startsEmbeddingIndex: false,
  sharesWithProvider: false,
  mutatesSourceEntries: false,
  executesCandidateContent: false,
  requiresExplicitReview: true,
  preservesSourceProvenance: true,
} as const;
