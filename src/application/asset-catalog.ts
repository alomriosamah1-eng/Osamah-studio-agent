import type { SourceRegistryPort, SourceVerificationState } from "./source-registry.js";

export type AssetKind = "image" | "video" | "audio" | "document" | "other";
export type LicenseState = "declared" | "unverified" | "verified" | "blocked";

export interface AssetLicense {
  readonly name: string;
  readonly attribution?: string;
  readonly sourceLocator?: string;
  readonly state: LicenseState;
  readonly warnings: readonly string[];
}

export interface AssetRecord {
  readonly assetId: string;
  readonly kind: AssetKind;
  readonly title: string;
  readonly locator: string;
  readonly mediaType?: string;
  readonly bytes?: number;
  readonly sha256?: string;
  readonly license: AssetLicense;
  readonly sourceIds: readonly string[];
  readonly warnings: readonly string[];
}

export interface RegisterAssetRequest {
  readonly kind: AssetKind;
  readonly title: string;
  readonly locator: string;
  readonly mediaType?: string;
  readonly bytes?: number;
  readonly sha256?: string;
  readonly license: AssetLicense;
  readonly sourceIds?: readonly string[];
}

export interface CreativeBrief {
  readonly briefId: string;
  readonly title: string;
  readonly intent: string;
  readonly visualDirection?: string;
  readonly constraints: readonly string[];
  readonly assetSlots: readonly string[];
  readonly assetIds: readonly string[];
  readonly warnings: readonly string[];
}

export interface CreateCreativeBriefRequest {
  readonly title: string;
  readonly intent: string;
  readonly visualDirection?: string;
  readonly constraints?: readonly string[];
  readonly assetSlots?: readonly string[];
}

export interface AttachAssetRequest {
  readonly briefId: string;
  readonly assetId: string;
}

export interface AssetCatalogPort {
  registerAsset(request: RegisterAssetRequest): AssetRecord;
  getAsset(assetId: string): AssetRecord | undefined;
  listAssets(limit?: number): readonly AssetRecord[];
}

export interface CreativeBriefPort {
  createBrief(request: CreateCreativeBriefRequest): CreativeBrief;
  getBrief(briefId: string): CreativeBrief | undefined;
  attachAsset(request: AttachAssetRequest): CreativeBrief;
}

export interface AssetCatalogOptions {
  readonly nextId?: (prefix: string) => string;
  readonly maxAssets?: number;
  readonly maxBriefs?: number;
  readonly maxSourcesPerAsset?: number;
  readonly maxWarnings?: number;
  readonly maxConstraints?: number;
  readonly maxAssetSlots?: number;
}

export class AssetCatalogError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AssetCatalogError";
  }
}

const maxTitleLength = 512;
const maxLocatorLength = 2_048;
const maxMediaTypeLength = 128;
const maxLicenseNameLength = 256;
const maxAttributionLength = 1_000;
const maxBytes = 128 * 1024 * 1024;
const maxWarningLength = 512;

const cleanText = (value: string, field: string, maxLength: number): string => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength || /[\u0000\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(trimmed)) throw new AssetCatalogError(`${field} is invalid.`);
  return trimmed;
};

const cleanId = (value: string, field: string): string => cleanText(value, field, 256);
const cleanList = (values: readonly string[] | undefined, field: string, maxItems: number, maxItemLength: number): readonly string[] => {
  if (values === undefined) return [];
  if (!Array.isArray(values) || values.length > maxItems) throw new AssetCatalogError(`${field} list is invalid.`);
  const cleaned = values.map((value) => cleanText(value, field, maxItemLength));
  if (new Set(cleaned).size !== cleaned.length) throw new AssetCatalogError(`${field} list contains duplicates.`);
  return cleaned;
};

const cleanLocator = (value: string): string => {
  const locator = cleanText(value, "locator", maxLocatorLength);
  if (locator.includes("\\") || locator.includes("..")) throw new AssetCatalogError("locator is unsafe.");
  return locator;
};

const cleanHash = (value: string | undefined): string | undefined => {
  if (value === undefined) return undefined;
  const hash = cleanText(value, "sha256", 64).toLowerCase();
  if (!/^[a-f0-9]{64}$/u.test(hash)) throw new AssetCatalogError("sha256 is invalid.");
  return hash;
};

const cleanBytes = (value: number | undefined): number | undefined => {
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value) || value < 0 || value > maxBytes) throw new AssetCatalogError("bytes is invalid.");
  return value;
};

const cleanKind = (value: AssetKind): AssetKind => {
  if (value !== "image" && value !== "video" && value !== "audio" && value !== "document" && value !== "other") throw new AssetCatalogError("asset kind is invalid.");
  return value;
};

const cleanLicense = (license: AssetLicense, maxWarnings: number): AssetLicense => {
  if (!license || typeof license !== "object") throw new AssetCatalogError("license is required.");
  const name = cleanText(license.name, "license name", maxLicenseNameLength);
  const attribution = license.attribution === undefined ? undefined : cleanText(license.attribution, "license attribution", maxAttributionLength);
  const sourceLocator = license.sourceLocator === undefined ? undefined : cleanLocator(license.sourceLocator);
  if (license.state !== "declared" && license.state !== "unverified" && license.state !== "verified" && license.state !== "blocked") throw new AssetCatalogError("license state is invalid.");
  const warnings = cleanList(license.warnings, "license warning", maxWarnings, maxWarningLength);
  return { name, attribution, sourceLocator, state: license.state, warnings };
};

const sourceIsWarning = (state: SourceVerificationState): boolean => state === "unverified" || state === "metadata_validated";

export class InMemoryAssetCatalog implements AssetCatalogPort, CreativeBriefPort {
  private readonly assets = new Map<string, AssetRecord>();
  private readonly briefs = new Map<string, CreativeBrief>();
  private readonly sourceRegistry: SourceRegistryPort;
  private readonly nextId: (prefix: string) => string;
  private readonly maxAssets: number;
  private readonly maxBriefs: number;
  private readonly maxSourcesPerAsset: number;
  private readonly maxWarnings: number;
  private readonly maxConstraints: number;
  private readonly maxAssetSlots: number;

  public constructor(sourceRegistry: SourceRegistryPort, options: AssetCatalogOptions = {}) {
    this.sourceRegistry = sourceRegistry;
    let sequence = 0;
    this.nextId = options.nextId ?? ((prefix) => `${prefix}-${++sequence}`);
    this.maxAssets = options.maxAssets ?? 256;
    this.maxBriefs = options.maxBriefs ?? 64;
    this.maxSourcesPerAsset = options.maxSourcesPerAsset ?? 8;
    this.maxWarnings = options.maxWarnings ?? 16;
    this.maxConstraints = options.maxConstraints ?? 16;
    this.maxAssetSlots = options.maxAssetSlots ?? 16;
  }

  public registerAsset(request: RegisterAssetRequest): AssetRecord {
    if (this.assets.size >= this.maxAssets) throw new AssetCatalogError("asset limit reached.");
    const kind = cleanKind(request.kind);
    const title = cleanText(request.title, "asset title", maxTitleLength);
    const locator = cleanLocator(request.locator);
    const mediaType = request.mediaType === undefined ? undefined : cleanText(request.mediaType, "mediaType", maxMediaTypeLength);
    const bytes = cleanBytes(request.bytes);
    const sha256 = cleanHash(request.sha256);
    const license = cleanLicense(request.license, this.maxWarnings);
    const sourceIds = cleanList(request.sourceIds, "source ID", this.maxSourcesPerAsset, 256);
    const sources = sourceIds.map((sourceId) => this.sourceRegistry.getSource(sourceId));
    if (sources.some((source) => !source)) throw new AssetCatalogError("asset source was not found in Source Registry.");
    const dedupeKey = `${kind}|${locator}|${sha256 ?? ""}`;
    const existing = [...this.assets.values()].find((asset) => `${asset.kind}|${asset.locator}|${asset.sha256 ?? ""}` === dedupeKey);
    if (existing) return existing;
    const warnings = new Set<string>(license.warnings);
    if (!sourceIds.length) warnings.add("asset_has_no_source");
    if (sources.some((source) => source !== undefined && sourceIsWarning(source.verificationState))) warnings.add("asset_source_unverified");
    const asset: AssetRecord = {
      assetId: this.nextId("asset"), kind, title, locator, mediaType, bytes, sha256, license, sourceIds,
      warnings: [...warnings].slice(0, this.maxWarnings).map((warning) => warning.slice(0, maxWarningLength)),
    };
    this.assets.set(asset.assetId, asset);
    return asset;
  }

  public getAsset(assetId: string): AssetRecord | undefined {
    return this.assets.get(cleanId(assetId, "assetId"));
  }

  public listAssets(limit = 64): readonly AssetRecord[] {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > this.maxAssets) throw new AssetCatalogError("asset list limit is invalid.");
    return [...this.assets.values()].slice(0, limit);
  }

  public createBrief(request: CreateCreativeBriefRequest): CreativeBrief {
    if (this.briefs.size >= this.maxBriefs) throw new AssetCatalogError("creative brief limit reached.");
    const constraints = cleanList(request.constraints, "constraint", this.maxConstraints, 512);
    const assetSlots = cleanList(request.assetSlots, "asset slot", this.maxAssetSlots, 256);
    const brief: CreativeBrief = {
      briefId: this.nextId("brief"),
      title: cleanText(request.title, "brief title", maxTitleLength),
      intent: cleanText(request.intent, "brief intent", 2_000),
      visualDirection: request.visualDirection === undefined ? undefined : cleanText(request.visualDirection, "visual direction", 2_000),
      constraints,
      assetSlots,
      assetIds: [],
      warnings: assetSlots.length ? ["asset_slots_unfilled"] : [],
    };
    this.briefs.set(brief.briefId, brief);
    return brief;
  }

  public getBrief(briefId: string): CreativeBrief | undefined {
    return this.briefs.get(cleanId(briefId, "briefId"));
  }

  public attachAsset(request: AttachAssetRequest): CreativeBrief {
    const briefId = cleanId(request.briefId, "briefId");
    const assetId = cleanId(request.assetId, "assetId");
    const brief = this.briefs.get(briefId);
    if (!brief) throw new AssetCatalogError("creative brief was not found.");
    const asset = this.assets.get(assetId);
    if (!asset) throw new AssetCatalogError("asset was not found.");
    if (asset.license.state === "blocked") throw new AssetCatalogError("blocked asset cannot be attached.");
    if (brief.assetIds.includes(assetId)) throw new AssetCatalogError("asset is already attached.");
    if (brief.assetIds.length >= this.maxAssetSlots) throw new AssetCatalogError("brief asset limit reached.");
    const warnings = new Set(brief.warnings.filter((warning) => warning !== "asset_slots_unfilled"));
    if (asset.license.state !== "verified") warnings.add("asset_license_unverified");
    if (asset.warnings.length) warnings.add("asset_has_provenance_warning");
    const next: CreativeBrief = { ...brief, assetIds: [...brief.assetIds, assetId], warnings: [...warnings].slice(0, this.maxWarnings) };
    this.briefs.set(brief.briefId, next);
    return next;
  }
}
