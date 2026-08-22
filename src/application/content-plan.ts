import type { CitationRecord, SourceRegistryPort, SourceVerificationState } from "./source-registry.js";

export type ClaimVerificationState = "unresolved" | "supported" | "conflicted";

export interface ContentSection {
  readonly sectionId: string;
  readonly title: string;
  readonly order: number;
  readonly summary?: string;
}

export interface ClaimRecord {
  readonly claimId: string;
  readonly sectionId: string;
  readonly text: string;
  readonly citationIds: readonly string[];
  readonly verificationState: ClaimVerificationState;
  readonly confidence?: number;
  readonly warnings: readonly string[];
}

export interface ContentPlanIntegrity {
  readonly totalClaims: number;
  readonly supportedClaims: number;
  readonly unresolvedClaims: number;
  readonly conflictedClaims: number;
  readonly warnings: readonly string[];
}

export interface ContentPlan {
  readonly planId: string;
  readonly brief: string;
  readonly sections: readonly ContentSection[];
  readonly claims: readonly ClaimRecord[];
  readonly integrity: ContentPlanIntegrity;
}

export interface CreateContentPlanRequest {
  readonly brief: string;
}

export interface AddContentSectionRequest {
  readonly planId: string;
  readonly title: string;
  readonly summary?: string;
}

export interface AddClaimRequest {
  readonly planId: string;
  readonly sectionId: string;
  readonly text: string;
  readonly confidence?: number;
}

export interface AttachClaimCitationRequest {
  readonly planId: string;
  readonly claimId: string;
  readonly citationId: string;
}

export interface ContentPlanPort {
  createPlan(request: CreateContentPlanRequest): ContentPlan;
  addSection(request: AddContentSectionRequest): ContentPlan;
  addClaim(request: AddClaimRequest): ContentPlan;
  attachCitation(request: AttachClaimCitationRequest): ContentPlan;
  getPlan(planId: string): ContentPlan | undefined;
}

export interface ContentPlanOptions {
  readonly nextId?: (prefix: string) => string;
  readonly maxPlans?: number;
  readonly maxSectionsPerPlan?: number;
  readonly maxClaimsPerPlan?: number;
  readonly maxCitationsPerClaim?: number;
}

export class ContentPlanError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ContentPlanError";
  }
}

const maxBriefLength = 4_000;
const maxTextLength = 2_000;
const maxWarningLength = 512;

const cleanText = (value: string, field: string, maxLength: number): string => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength || trimmed.includes("\0") || trimmed.includes("\r") || trimmed.includes("\n")) throw new ContentPlanError(`${field} is invalid.`);
  return trimmed;
};

const cleanId = (value: string, field: string): string => cleanText(value, field, 256);
const cleanConfidence = (value: number | undefined): number | undefined => {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new ContentPlanError("confidence is invalid.");
  return value;
};

const hasInvalidSourceState = (state: SourceVerificationState): boolean => state === "invalid";

const citationIsUsable = (citation: CitationRecord | undefined, sourceRegistry: SourceRegistryPort): { usable: boolean; warning?: string } => {
  if (!citation) return { usable: false, warning: "citation_not_found" };
  if (citation.verificationState === "invalid") return { usable: false, warning: "citation_invalid" };
  const source = sourceRegistry.getSource(citation.sourceId);
  if (!source) return { usable: false, warning: "citation_source_not_found" };
  if (hasInvalidSourceState(source.verificationState)) return { usable: false, warning: "source_invalid" };
  if (source.verificationState === "unverified" || citation.verificationState === "unverified") return { usable: true, warning: "citation_or_source_unverified" };
  return { usable: true };
};

export class InMemoryContentPlanService implements ContentPlanPort {
  private readonly plans = new Map<string, ContentPlan>();
  private readonly sourceRegistry: SourceRegistryPort;
  private readonly nextId: (prefix: string) => string;
  private readonly maxPlans: number;
  private readonly maxSectionsPerPlan: number;
  private readonly maxClaimsPerPlan: number;
  private readonly maxCitationsPerClaim: number;

  public constructor(sourceRegistry: SourceRegistryPort, options: ContentPlanOptions = {}) {
    this.sourceRegistry = sourceRegistry;
    let sequence = 0;
    this.nextId = options.nextId ?? ((prefix) => `${prefix}-${++sequence}`);
    this.maxPlans = options.maxPlans ?? 64;
    this.maxSectionsPerPlan = options.maxSectionsPerPlan ?? 32;
    this.maxClaimsPerPlan = options.maxClaimsPerPlan ?? 128;
    this.maxCitationsPerClaim = options.maxCitationsPerClaim ?? 8;
  }

  public createPlan(request: CreateContentPlanRequest): ContentPlan {
    if (this.plans.size >= this.maxPlans) throw new ContentPlanError("content plan limit reached.");
    const plan: ContentPlan = {
      planId: this.nextId("plan"),
      brief: cleanText(request.brief, "brief", maxBriefLength),
      sections: [],
      claims: [],
      integrity: { totalClaims: 0, supportedClaims: 0, unresolvedClaims: 0, conflictedClaims: 0, warnings: [] },
    };
    this.plans.set(plan.planId, plan);
    return plan;
  }

  public addSection(request: AddContentSectionRequest): ContentPlan {
    const plan = this.requirePlan(request.planId);
    if (plan.sections.length >= this.maxSectionsPerPlan) throw new ContentPlanError("section limit reached.");
    if (plan.sections.some((section) => section.title === cleanText(request.title, "section title", 512))) throw new ContentPlanError("duplicate section title.");
    return this.replacePlan(plan, {
      sections: [...plan.sections, { sectionId: this.nextId("section"), title: cleanText(request.title, "section title", 512), order: plan.sections.length, summary: request.summary === undefined ? undefined : cleanText(request.summary, "section summary", maxTextLength) }],
    });
  }

  public addClaim(request: AddClaimRequest): ContentPlan {
    const plan = this.requirePlan(request.planId);
    const sectionId = cleanId(request.sectionId, "sectionId");
    if (!plan.sections.some((section) => section.sectionId === sectionId)) throw new ContentPlanError("claim section was not found.");
    if (plan.claims.length >= this.maxClaimsPerPlan) throw new ContentPlanError("claim limit reached.");
    return this.replacePlan(plan, {
      claims: [...plan.claims, this.recomputeClaim({ claimId: this.nextId("claim"), sectionId, text: cleanText(request.text, "claim text", maxTextLength), citationIds: [], verificationState: "unresolved", confidence: cleanConfidence(request.confidence), warnings: ["claim_has_no_citation"] })],
    });
  }

  public attachCitation(request: AttachClaimCitationRequest): ContentPlan {
    const plan = this.requirePlan(request.planId);
    const claimId = cleanId(request.claimId, "claimId");
    const citationId = cleanId(request.citationId, "citationId");
    if (!this.sourceRegistry.getCitation(citationId)) throw new ContentPlanError("citation was not found in Source Registry.");
    const claim = plan.claims.find((candidate) => candidate.claimId === claimId);
    if (!claim) throw new ContentPlanError("claim was not found.");
    if (claim.citationIds.includes(citationId)) throw new ContentPlanError("citation is already attached.");
    if (claim.citationIds.length >= this.maxCitationsPerClaim) throw new ContentPlanError("citation limit reached for claim.");
    const claims = plan.claims.map((candidate) => candidate.claimId === claimId ? this.recomputeClaim({ ...candidate, citationIds: [...candidate.citationIds, citationId] }) : candidate);
    return this.replacePlan(plan, { claims });
  }

  public getPlan(planId: string): ContentPlan | undefined {
    return this.plans.get(cleanId(planId, "planId"));
  }

  private requirePlan(planId: string): ContentPlan {
    const plan = this.getPlan(planId);
    if (!plan) throw new ContentPlanError("content plan was not found.");
    return plan;
  }

  private replacePlan(plan: ContentPlan, changes: Partial<Pick<ContentPlan, "sections" | "claims">>): ContentPlan {
    const next: ContentPlan = { ...plan, sections: changes.sections ?? plan.sections, claims: changes.claims ?? plan.claims, integrity: this.computeIntegrity(changes.claims ?? plan.claims) };
    this.plans.set(plan.planId, next);
    return next;
  }

  private recomputeClaim(claim: ClaimRecord): ClaimRecord {
    const warnings = new Set(claim.warnings.filter((warning) => warning !== "claim_has_no_citation" && warning !== "citation_not_found" && warning !== "citation_invalid" && warning !== "citation_source_not_found" && warning !== "source_invalid" && warning !== "citation_or_source_unverified"));
    if (!claim.citationIds.length) {
      warnings.add("claim_has_no_citation");
      return { ...claim, verificationState: "unresolved", warnings: [...warnings] };
    }
    let unusable = false;
    let unverified = false;
    for (const citationId of claim.citationIds) {
      const result = citationIsUsable(this.sourceRegistry.getCitation(citationId), this.sourceRegistry);
      if (!result.usable) unusable = true;
      if (result.warning === "citation_or_source_unverified") unverified = true;
      if (result.warning) warnings.add(result.warning);
    }
    return { ...claim, verificationState: unusable ? "conflicted" : "supported", warnings: [...warnings, ...(unverified ? ["citation_or_source_unverified"] : [])] };
  }

  private computeIntegrity(claims: readonly ClaimRecord[]): ContentPlanIntegrity {
    const warnings = [...new Set(claims.flatMap((claim) => claim.warnings))].slice(0, 64).map((warning) => warning.slice(0, maxWarningLength));
    return {
      totalClaims: claims.length,
      supportedClaims: claims.filter((claim) => claim.verificationState === "supported").length,
      unresolvedClaims: claims.filter((claim) => claim.verificationState === "unresolved").length,
      conflictedClaims: claims.filter((claim) => claim.verificationState === "conflicted").length,
      warnings,
    };
  }
}
