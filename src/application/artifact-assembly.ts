import type { ContentPlanPort, ClaimRecord } from "./content-plan.js";
import type { AssetCatalogPort, AssetRecord, CreativeBrief, CreativeBriefPort } from "./asset-catalog.js";
import type { SourceRegistryPort } from "./source-registry.js";

export type ArtifactKind = "document" | "presentation" | "media_bundle" | "markdown";
export type ArtifactReviewState = "needs_review" | "ready_for_render" | "blocked";

export interface ArtifactManifest {
  readonly sources: readonly string[];
  readonly assets: readonly string[];
  readonly tools: readonly string[];
  readonly claims: readonly string[];
  readonly warnings: readonly string[];
}

export interface ArtifactDraft {
  readonly artifactId: string;
  readonly kind: ArtifactKind;
  readonly title: string;
  readonly contentPlanId: string;
  readonly briefId?: string;
  readonly claimIds: readonly string[];
  readonly assetIds: readonly string[];
  readonly reviewState: ArtifactReviewState;
  readonly manifest: ArtifactManifest;
  readonly warnings: readonly string[];
}

export interface CreateArtifactDraftRequest {
  readonly kind: ArtifactKind;
  readonly title: string;
  readonly contentPlanId: string;
  readonly briefId?: string;
  readonly claimIds?: readonly string[];
  readonly assetIds?: readonly string[];
}

export interface ArtifactAssemblyPort {
  createDraft(request: CreateArtifactDraftRequest): ArtifactDraft;
  getDraft(artifactId: string): ArtifactDraft | undefined;
}

export interface ArtifactAssemblyOptions {
  readonly nextId?: (prefix: string) => string;
  readonly maxDrafts?: number;
  readonly maxClaims?: number;
  readonly maxAssets?: number;
  readonly maxSources?: number;
  readonly maxWarnings?: number;
}

export class ArtifactAssemblyError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ArtifactAssemblyError";
  }
}

const maxTitleLength = 512;
const maxIdLength = 256;
const maxWarnings = 64;

const cleanText = (value: string, field: string, maxLength: number): string => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength || /[\u0000\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(trimmed)) throw new ArtifactAssemblyError(`${field} is invalid.`);
  return trimmed;
};
const cleanId = (value: string, field: string): string => cleanText(value, field, maxIdLength);
const uniqueIds = (values: readonly string[] | undefined, field: string, maxItems: number): readonly string[] | undefined => {
  if (values === undefined) return undefined;
  if (!Array.isArray(values) || values.length > maxItems) throw new ArtifactAssemblyError(`${field} list is invalid.`);
  const ids = values.map((value) => cleanId(value, field));
  if (new Set(ids).size !== ids.length) throw new ArtifactAssemblyError(`${field} list contains duplicates.`);
  return ids;
};
const cleanKind = (value: ArtifactKind): ArtifactKind => {
  if (value !== "document" && value !== "presentation" && value !== "media_bundle" && value !== "markdown") throw new ArtifactAssemblyError("artifact kind is invalid.");
  return value;
};

export class InMemoryArtifactAssembly implements ArtifactAssemblyPort {
  private readonly drafts = new Map<string, ArtifactDraft>();
  private readonly contentPlans: Pick<ContentPlanPort, "getPlan">;
  private readonly briefs: Pick<CreativeBriefPort, "getBrief">;
  private readonly assets: Pick<AssetCatalogPort, "getAsset">;
  private readonly sources: Pick<SourceRegistryPort, "getCitation">;
  private readonly nextId: (prefix: string) => string;
  private readonly maxDrafts: number;
  private readonly maxClaims: number;
  private readonly maxAssets: number;
  private readonly maxSources: number;
  private readonly maxWarningsPerDraft: number;

  public constructor(
    contentPlans: Pick<ContentPlanPort, "getPlan">,
    briefs: Pick<CreativeBriefPort, "getBrief">,
    assets: Pick<AssetCatalogPort, "getAsset">,
    sources: Pick<SourceRegistryPort, "getCitation">,
    options: ArtifactAssemblyOptions = {},
  ) {
    this.contentPlans = contentPlans;
    this.briefs = briefs;
    this.assets = assets;
    this.sources = sources;
    let sequence = 0;
    this.nextId = options.nextId ?? ((prefix) => `${prefix}-${++sequence}`);
    this.maxDrafts = options.maxDrafts ?? 64;
    this.maxClaims = options.maxClaims ?? 128;
    this.maxAssets = options.maxAssets ?? 64;
    this.maxSources = options.maxSources ?? 256;
    this.maxWarningsPerDraft = options.maxWarnings ?? maxWarnings;
  }

  public createDraft(request: CreateArtifactDraftRequest): ArtifactDraft {
    if (this.drafts.size >= this.maxDrafts) throw new ArtifactAssemblyError("artifact draft limit reached.");
    const kind = cleanKind(request.kind);
    const title = cleanText(request.title, "artifact title", maxTitleLength);
    const planId = cleanId(request.contentPlanId, "contentPlanId");
    const plan = this.contentPlans.getPlan(planId);
    if (!plan) throw new ArtifactAssemblyError("content plan was not found.");
    const briefId = request.briefId === undefined ? undefined : cleanId(request.briefId, "briefId");
    const brief = briefId === undefined ? undefined : this.requireBrief(briefId);
    const claimIds = uniqueIds(request.claimIds, "claimId", this.maxClaims) ?? plan.claims.map((claim) => claim.claimId);
    const assetIds = uniqueIds(request.assetIds, "assetId", this.maxAssets) ?? brief?.assetIds ?? [];
    if (claimIds.length > this.maxClaims || assetIds.length > this.maxAssets) throw new ArtifactAssemblyError("artifact reference limit reached.");
    const claims = claimIds.map((claimId) => {
      const claim = plan.claims.find((candidate) => candidate.claimId === claimId);
      if (!claim) throw new ArtifactAssemblyError("artifact claim was not found in content plan.");
      return claim;
    });
    if (brief && assetIds.some((assetId) => !brief.assetIds.includes(assetId))) throw new ArtifactAssemblyError("artifact asset is not attached to creative brief.");
    const assetRecords = assetIds.map((assetId) => {
      const asset = this.assets.getAsset(assetId);
      if (!asset) throw new ArtifactAssemblyError("artifact asset was not found.");
      return asset;
    });
    const warnings = new Set<string>();
    const blocking = new Set<string>();
    const sourceIds = new Set<string>();
    claims.forEach((claim) => this.collectClaim(claim, sourceIds, warnings, blocking));
    assetRecords.forEach((asset) => this.collectAsset(asset, sourceIds, warnings, blocking));
    if (brief?.warnings.length) brief.warnings.forEach((warning) => warnings.add(`brief:${warning}`));
    if (brief?.assetSlots.length && brief.assetIds.length < brief.assetSlots.length) warnings.add("brief_asset_slots_unfilled");
    if (sourceIds.size > this.maxSources) throw new ArtifactAssemblyError("artifact source limit reached.");
    const boundedWarnings = [...new Set([...blocking, ...warnings])].slice(0, this.maxWarningsPerDraft).map((warning) => warning.slice(0, 512));
    const reviewState: ArtifactReviewState = blocking.size ? "blocked" : warnings.size ? "needs_review" : "ready_for_render";
    const manifest: ArtifactManifest = {
      sources: [...sourceIds].sort().slice(0, this.maxSources),
      assets: assetRecords.map((asset) => asset.assetId).sort(),
      tools: [],
      claims: claims.map((claim) => claim.claimId).sort(),
      warnings: boundedWarnings,
    };
    const draft: ArtifactDraft = {
      artifactId: this.nextId("artifact"), kind, title, contentPlanId: planId, briefId,
      claimIds: [...claimIds], assetIds: [...assetIds], reviewState, manifest, warnings: boundedWarnings,
    };
    this.drafts.set(draft.artifactId, draft);
    return draft;
  }

  public getDraft(artifactId: string): ArtifactDraft | undefined {
    return this.drafts.get(cleanId(artifactId, "artifactId"));
  }

  private requireBrief(briefId: string): CreativeBrief {
    const brief = this.briefs.getBrief(briefId);
    if (!brief) throw new ArtifactAssemblyError("creative brief was not found.");
    return brief;
  }

  private collectClaim(claim: ClaimRecord, sourceIds: Set<string>, warnings: Set<string>, blocking: Set<string>): void {
    if (claim.verificationState !== "supported") blocking.add(`claim:${claim.claimId}:${claim.verificationState}`);
    claim.warnings.forEach((warning) => warnings.add(`claim:${claim.claimId}:${warning}`));
    if (!claim.citationIds.length) blocking.add(`claim:${claim.claimId}:no_citation`);
    claim.citationIds.forEach((citationId) => {
      const citation = this.sources.getCitation(citationId);
      if (!citation) {
        blocking.add(`citation:${citationId}:missing`);
        return;
      }
      sourceIds.add(citation.sourceId);
      if (citation.verificationState === "invalid") blocking.add(`citation:${citationId}:invalid`);
      if (citation.verificationState === "unverified") warnings.add(`citation:${citationId}:unverified`);
    });
  }

  private collectAsset(asset: AssetRecord, sourceIds: Set<string>, warnings: Set<string>, blocking: Set<string>): void {
    if (asset.license.state === "blocked") blocking.add(`asset:${asset.assetId}:license_blocked`);
    if (asset.license.state !== "verified") warnings.add(`asset:${asset.assetId}:license_unverified`);
    asset.warnings.forEach((warning) => warnings.add(`asset:${asset.assetId}:${warning}`));
    asset.sourceIds.forEach((sourceId) => sourceIds.add(sourceId));
  }
}
