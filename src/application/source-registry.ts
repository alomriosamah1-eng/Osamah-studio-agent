import { sanitizeAuditText } from "./agent-contracts.js";

export type SourceKind = "local_file" | "user_url" | "generated_artifact" | "workspace_document";
export type SourceVerificationState = "unverified" | "metadata_validated" | "content_validated" | "invalid";
export type ProvenanceRelation = "derived_from" | "used" | "generated_by" | "attributed_to";

export interface SourceRecord {
  readonly sourceId: string;
  readonly kind: SourceKind;
  readonly locator: string;
  readonly title?: string;
  readonly contentType?: string;
  readonly bytes?: number;
  readonly sha256?: string;
  readonly capturedAt: string;
  readonly verificationState: SourceVerificationState;
  readonly warnings: readonly string[];
}

export interface CitationRecord {
  readonly citationId: string;
  readonly sourceId: string;
  readonly label: string;
  readonly span?: { readonly start: number; readonly end: number };
  readonly page?: number;
  readonly section?: string;
  readonly quotePreview?: string;
  readonly verificationState: SourceVerificationState;
}

export interface ProvenanceLink {
  readonly linkId: string;
  readonly fromId: string;
  readonly toId: string;
  readonly relation: ProvenanceRelation;
  readonly activityId?: string;
  readonly createdAt: string;
  readonly evidence: readonly string[];
}

export interface RegisterSourceRequest {
  readonly kind: SourceKind;
  readonly locator: string;
  readonly title?: string;
  readonly contentType?: string;
  readonly bytes?: number;
  readonly sha256?: string;
  readonly capturedAt?: string;
  readonly verificationState?: SourceVerificationState;
  readonly warnings?: readonly string[];
}

export interface AddCitationRequest {
  readonly sourceId: string;
  readonly label: string;
  readonly span?: { readonly start: number; readonly end: number };
  readonly page?: number;
  readonly section?: string;
  readonly quotePreview?: string;
  readonly verificationState?: SourceVerificationState;
}

export interface AddProvenanceLinkRequest {
  readonly fromId: string;
  readonly toId: string;
  readonly relation: ProvenanceRelation;
  readonly activityId?: string;
  readonly evidence?: readonly string[];
}

export interface SourceRegistryPort {
  registerSource(request: RegisterSourceRequest): SourceRecord;
  getSource(sourceId: string): SourceRecord | undefined;
  listSources(limit?: number): readonly SourceRecord[];
  addCitation(request: AddCitationRequest): CitationRecord;
  listCitations(sourceId: string, limit?: number): readonly CitationRecord[];
  addProvenanceLink(request: AddProvenanceLinkRequest): ProvenanceLink;
  listProvenanceLinks(entityId: string, limit?: number): readonly ProvenanceLink[];
}

export interface SourceRegistryOptions {
  readonly now?: () => string;
  readonly nextId?: (prefix: string) => string;
  readonly maxSources?: number;
  readonly maxCitationsPerSource?: number;
  readonly maxLinks?: number;
}

export class SourceRegistryError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "SourceRegistryError";
  }
}

const sourceKinds: readonly SourceKind[] = ["local_file", "user_url", "generated_artifact", "workspace_document"];
const verificationStates: readonly SourceVerificationState[] = ["unverified", "metadata_validated", "content_validated", "invalid"];
const relations: readonly ProvenanceRelation[] = ["derived_from", "used", "generated_by", "attributed_to"];

const cleanText = (value: string, field: string, maxLength: number, allowNewlines = false): string => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength || trimmed.includes("\0") || (!allowNewlines && (trimmed.includes("\r") || trimmed.includes("\n")))) {
    throw new SourceRegistryError(`${field} is invalid.`);
  }
  return sanitizeAuditText(trimmed, maxLength);
};

const cleanOptionalText = (value: string | undefined, field: string, maxLength: number, allowNewlines = false): string | undefined => value === undefined ? undefined : cleanText(value, field, maxLength, allowNewlines);

const cleanId = (value: string, field: string): string => cleanText(value, field, 256);

const cleanWarnings = (warnings: readonly string[] | undefined): readonly string[] => {
  if (warnings === undefined) return [];
  if (warnings.length > 16) throw new SourceRegistryError("warnings exceed bounded limits.");
  return warnings.map((warning) => cleanText(warning, "warning", 512));
};

const cleanVerificationState = (value: SourceVerificationState | undefined): SourceVerificationState => {
  const state = value ?? "unverified";
  if (!verificationStates.includes(state)) throw new SourceRegistryError("verificationState is invalid.");
  return state;
};

const cleanSourceRequest = (request: RegisterSourceRequest): RegisterSourceRequest => {
  if (!sourceKinds.includes(request.kind)) throw new SourceRegistryError("source kind is invalid.");
  const locator = cleanText(request.locator, "locator", 2_048);
  const sha256 = request.sha256 === undefined ? undefined : cleanText(request.sha256, "sha256", 64).toLowerCase();
  if (sha256 !== undefined && !/^[a-f0-9]{64}$/u.test(sha256)) throw new SourceRegistryError("sha256 is invalid.");
  if (request.bytes !== undefined && (!Number.isSafeInteger(request.bytes) || request.bytes < 0 || request.bytes > 128 * 1024 * 1024)) throw new SourceRegistryError("bytes are invalid.");
  const verificationState = cleanVerificationState(request.verificationState);
  if (verificationState === "content_validated" && (sha256 === undefined || request.bytes === undefined)) throw new SourceRegistryError("content_validated requires bounded bytes and sha256.");
  return {
    kind: request.kind,
    locator,
    title: cleanOptionalText(request.title, "title", 512),
    contentType: cleanOptionalText(request.contentType, "contentType", 128),
    bytes: request.bytes,
    sha256,
    capturedAt: request.capturedAt === undefined ? undefined : cleanText(request.capturedAt, "capturedAt", 128),
    verificationState,
    warnings: cleanWarnings(request.warnings),
  };
};

const cleanSpan = (span: { readonly start: number; readonly end: number } | undefined): { readonly start: number; readonly end: number } | undefined => {
  if (span === undefined) return undefined;
  if (!Number.isSafeInteger(span.start) || !Number.isSafeInteger(span.end) || span.start < 0 || span.end < span.start || span.end - span.start > 64 * 1024) throw new SourceRegistryError("citation span is invalid.");
  return { start: span.start, end: span.end };
};

export class InMemorySourceRegistry implements SourceRegistryPort {
  private readonly sources = new Map<string, SourceRecord>();
  private readonly citations = new Map<string, CitationRecord>();
  private readonly links = new Map<string, ProvenanceLink>();
  private readonly now: () => string;
  private readonly nextId: (prefix: string) => string;
  private readonly maxSources: number;
  private readonly maxCitationsPerSource: number;
  private readonly maxLinks: number;

  public constructor(options: SourceRegistryOptions = {}) {
    this.now = options.now ?? (() => new Date().toISOString());
    let sequence = 0;
    this.nextId = options.nextId ?? ((prefix) => `${prefix}-${++sequence}`);
    this.maxSources = options.maxSources ?? 256;
    this.maxCitationsPerSource = options.maxCitationsPerSource ?? 256;
    this.maxLinks = options.maxLinks ?? 256;
  }

  public registerSource(request: RegisterSourceRequest): SourceRecord {
    const clean = cleanSourceRequest(request);
    const duplicate = [...this.sources.values()].find((source) => source.kind === clean.kind && source.locator === clean.locator && source.sha256 === clean.sha256);
    if (duplicate) return duplicate;
    if (this.sources.size >= this.maxSources) throw new SourceRegistryError("source registry limit reached.");
    const source: SourceRecord = {
      sourceId: this.nextId("source"),
      kind: clean.kind,
      locator: clean.locator,
      title: clean.title,
      contentType: clean.contentType,
      bytes: clean.bytes,
      sha256: clean.sha256,
      capturedAt: clean.capturedAt ?? this.now(),
      verificationState: clean.verificationState ?? "unverified",
      warnings: clean.warnings ?? [],
    };
    this.sources.set(source.sourceId, source);
    return source;
  }

  public getSource(sourceId: string): SourceRecord | undefined {
    return this.sources.get(cleanId(sourceId, "sourceId"));
  }

  public listSources(limit = 64): readonly SourceRecord[] {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > this.maxSources) throw new SourceRegistryError("source list limit is invalid.");
    return [...this.sources.values()].slice(0, limit);
  }

  public addCitation(request: AddCitationRequest): CitationRecord {
    const sourceId = cleanId(request.sourceId, "sourceId");
    if (!this.sources.has(sourceId)) throw new SourceRegistryError("citation source was not found.");
    const existingCount = [...this.citations.values()].filter((citation) => citation.sourceId === sourceId).length;
    if (existingCount >= this.maxCitationsPerSource) throw new SourceRegistryError("citation limit reached for source.");
    const verificationState = cleanVerificationState(request.verificationState);
    const citation: CitationRecord = {
      citationId: this.nextId("citation"),
      sourceId,
      label: cleanText(request.label, "citation label", 256),
      span: cleanSpan(request.span),
      page: request.page === undefined ? undefined : (Number.isSafeInteger(request.page) && request.page > 0 && request.page <= 1_000_000 ? request.page : (() => { throw new SourceRegistryError("citation page is invalid."); })()),
      section: cleanOptionalText(request.section, "citation section", 512),
      quotePreview: cleanOptionalText(request.quotePreview, "quotePreview", 2_000, true),
      verificationState,
    };
    this.citations.set(citation.citationId, citation);
    return citation;
  }

  public listCitations(sourceId: string, limit = 64): readonly CitationRecord[] {
    const cleanSourceId = cleanId(sourceId, "sourceId");
    if (!this.sources.has(cleanSourceId)) throw new SourceRegistryError("citation source was not found.");
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > this.maxCitationsPerSource) throw new SourceRegistryError("citation list limit is invalid.");
    return [...this.citations.values()].filter((citation) => citation.sourceId === cleanSourceId).slice(0, limit);
  }

  public addProvenanceLink(request: AddProvenanceLinkRequest): ProvenanceLink {
    const fromId = cleanId(request.fromId, "fromId");
    const toId = cleanId(request.toId, "toId");
    if (fromId === toId) throw new SourceRegistryError("provenance link cannot point to itself.");
    if (!relations.includes(request.relation)) throw new SourceRegistryError("provenance relation is invalid.");
    if (!this.sources.has(fromId) && !this.citations.has(fromId)) throw new SourceRegistryError("provenance source entity was not found.");
    if (!this.sources.has(toId) && !this.citations.has(toId)) throw new SourceRegistryError("provenance target entity was not found.");
    if (this.links.size >= this.maxLinks) throw new SourceRegistryError("provenance link limit reached.");
    const link: ProvenanceLink = {
      linkId: this.nextId("provenance"),
      fromId,
      toId,
      relation: request.relation,
      activityId: cleanOptionalText(request.activityId, "activityId", 256),
      createdAt: this.now(),
      evidence: cleanWarnings(request.evidence),
    };
    this.links.set(link.linkId, link);
    return link;
  }

  public listProvenanceLinks(entityId: string, limit = 64): readonly ProvenanceLink[] {
    const cleanEntityId = cleanId(entityId, "entityId");
    if (!this.sources.has(cleanEntityId) && !this.citations.has(cleanEntityId)) throw new SourceRegistryError("provenance entity was not found.");
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > this.maxLinks) throw new SourceRegistryError("provenance list limit is invalid.");
    return [...this.links.values()].filter((link) => link.fromId === cleanEntityId || link.toId === cleanEntityId).slice(0, limit);
  }
}
