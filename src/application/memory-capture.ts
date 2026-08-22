import { sanitizeAuditText } from "./agent-contracts.js";
import type { SourceRegistryPort } from "./source-registry.js";

export type MemoryEntryKind = "note" | "decision" | "task" | "research" | "learning" | "idea" | "summary";
export type MemoryEntryState = "review_required" | "confirmed" | "archived";
export type MemoryVisibility = "private" | "workspace" | "project";
export type MemoryProviderAccess = "never" | "explicit_only";
export type MemoryRetention = "session" | "project" | "until_deleted";
export type MemoryProvenanceKind = "source" | "artifact" | "task";
export type MemoryLinkRelation = "related_to" | "supports" | "derived_from";

export interface MemoryProvenanceRef {
  readonly kind: MemoryProvenanceKind;
  readonly id: string;
  readonly relation: "derived_from" | "supports" | "related_to";
  readonly label?: string;
}

export interface MemoryEntryLink {
  readonly entryId: string;
  readonly relation: MemoryLinkRelation;
}

export interface MemoryEntry {
  readonly entryId: string;
  readonly kind: MemoryEntryKind;
  readonly title: string;
  readonly content: string;
  readonly state: MemoryEntryState;
  readonly visibility: MemoryVisibility;
  readonly providerAccess: MemoryProviderAccess;
  readonly retention: MemoryRetention;
  readonly tags: readonly string[];
  readonly provenance: readonly MemoryProvenanceRef[];
  readonly links: readonly MemoryEntryLink[];
  readonly warnings: readonly string[];
  readonly createdAt: string;
  readonly reviewedAt?: string;
  readonly reviewReason?: string;
}

export interface CaptureMemoryRequest {
  readonly kind: MemoryEntryKind;
  readonly title: string;
  readonly content: string;
  readonly visibility?: MemoryVisibility;
  readonly providerAccess?: MemoryProviderAccess;
  readonly retention?: MemoryRetention;
  readonly tags?: readonly string[];
  readonly provenance?: readonly MemoryProvenanceRef[];
  readonly links?: readonly MemoryEntryLink[];
}

export interface MemoryReviewDecision {
  readonly entryId: string;
  readonly decision: "confirm" | "archive";
  readonly reason: string;
}

export interface MemorySearchOptions {
  readonly visibility?: MemoryVisibility;
}

export interface MemoryCapturePort {
  capture(request: CaptureMemoryRequest): MemoryEntry;
  get(entryId: string): MemoryEntry | undefined;
  list(limit?: number): readonly MemoryEntry[];
  searchLocal(query: string, limit?: number, options?: MemorySearchOptions): readonly MemoryEntry[];
}

export interface MemoryReviewPort {
  review(request: MemoryReviewDecision): MemoryEntry;
  listForReview(limit?: number): readonly MemoryEntry[];
}

export interface MemoryEntryPersistencePort {
  list(limit?: number): readonly MemoryEntry[];
  save(entry: MemoryEntry): void;
}

export interface MemoryCaptureOptions {
  readonly now?: () => string;
  readonly nextId?: (prefix: string) => string;
  readonly maxEntries?: number;
  readonly maxContentLength?: number;
  readonly persistence?: MemoryEntryPersistencePort;
}

export class MemoryCaptureError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "MemoryCaptureError";
  }
}

const kinds: readonly MemoryEntryKind[] = ["note", "decision", "task", "research", "learning", "idea", "summary"];
const visibilities: readonly MemoryVisibility[] = ["private", "workspace", "project"];
const providerAccessModes: readonly MemoryProviderAccess[] = ["never", "explicit_only"];
const retentions: readonly MemoryRetention[] = ["session", "project", "until_deleted"];
const provenanceKinds: readonly MemoryProvenanceKind[] = ["source", "artifact", "task"];
const provenanceRelations: readonly MemoryProvenanceRef["relation"][] = ["derived_from", "supports", "related_to"];
const linkRelations: readonly MemoryLinkRelation[] = ["derived_from", "supports", "related_to"];
const maxTitleLength = 512;
const maxTagLength = 128;
const maxIdLength = 256;
const maxTags = 128;
const maxProvenance = 16;
const maxLinks = 16;
const maxEntriesDefault = 256;
const maxContentDefault = 64 * 1024;

const cleanText = (value: string, field: string, maxLength: number, allowNewlines = false): string => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength || trimmed.includes("\0") || (!allowNewlines && (trimmed.includes("\r") || trimmed.includes("\n")))) {
    throw new MemoryCaptureError(`${field} is invalid.`);
  }
  return sanitizeAuditText(trimmed, maxLength);
};
const cleanId = (value: string, field: string): string => cleanText(value, field, maxIdLength);
const cleanReferenceId = (value: string): string => {
  const id = cleanId(value, "provenance id");
  if (id.startsWith("/") || id.startsWith("~") || id.includes("\\") || id.includes("..") || id.includes("/")) throw new MemoryCaptureError("provenance id is unsafe.");
  return id;
};
const cleanEnum = <T extends string>(value: T | undefined, allowed: readonly T[], fallback: T, field: string): T => {
  const selected = value ?? fallback;
  if (!allowed.includes(selected)) throw new MemoryCaptureError(`${field} is invalid.`);
  return selected;
};
const cleanList = (values: readonly string[] | undefined): readonly string[] => {
  if (values === undefined) return [];
  if (values.length > maxTags) throw new MemoryCaptureError("tags exceed bounded limits.");
  const cleaned = values.map((value) => cleanText(value, "tag", maxTagLength, false));
  if (new Set(cleaned).size !== cleaned.length) throw new MemoryCaptureError("tags must be unique.");
  return cleaned;
};
const normalizeSearchText = (value: string): string => value.normalize("NFKC").toLocaleLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g, "").replace(/[إأآٱ]/g, "ا").replace(/ى/g, "ي").replace(/[\s\u200c]+/g, " ").trim();
const cleanSearchVisibility = (value: MemorySearchOptions | undefined): MemoryVisibility | undefined => {
  if (value === undefined || value.visibility === undefined) return undefined;
  if (!visibilities.includes(value.visibility)) throw new MemoryCaptureError("visibility filter is invalid.");
  return value.visibility;
};

const searchScore = (entry: MemoryEntry, tokens: readonly string[]): number => {
  const title = normalizeSearchText(entry.title);
  const content = normalizeSearchText(entry.content);
  const tags = normalizeSearchText(entry.tags.join(" "));
  if (tokens.some((token) => !`${title}\n${content}\n${tags}`.includes(token))) return -1;
  return tokens.reduce((score, token) => score + (title.includes(token) ? 4 : 0) + (tags.includes(token) ? 2 : 0) + (content.includes(token) ? 1 : 0), 0);
};

const visibilityRank = (visibility: MemoryVisibility): number => ({ private: 0, workspace: 1, project: 2 })[visibility];

const cleanLinks = (values: readonly MemoryEntryLink[] | undefined, currentEntryId: string | undefined, sourceVisibility: MemoryVisibility, entries: ReadonlyMap<string, MemoryEntry>): readonly MemoryEntryLink[] => {
  if (values === undefined) return [];
  if (values.length > maxLinks) throw new MemoryCaptureError("links exceed bounded limits.");
  const seen = new Set<string>();
  return values.map((value) => {
    if (!linkRelations.includes(value.relation)) throw new MemoryCaptureError("link relation is invalid.");
    const entryId = cleanReferenceId(value.entryId);
    if (currentEntryId !== undefined && entryId === currentEntryId) throw new MemoryCaptureError("memory entry cannot link to itself.");
    const target = entries.get(entryId);
    if (!target) throw new MemoryCaptureError("linked memory entry is unknown.");
    if (visibilityRank(target.visibility) < visibilityRank(sourceVisibility)) throw new MemoryCaptureError("link visibility would widen access.");
    const key = `${entryId}:${value.relation}`;
    if (seen.has(key)) throw new MemoryCaptureError("links must be unique.");
    seen.add(key);
    return { entryId, relation: value.relation };
  });
};

const cleanProvenance = (values: readonly MemoryProvenanceRef[] | undefined, sourceRegistry: Pick<SourceRegistryPort, "getSource">): readonly MemoryProvenanceRef[] => {
  if (values === undefined) return [];
  if (values.length > maxProvenance) throw new MemoryCaptureError("provenance exceeds bounded limits.");
  const seen = new Set<string>();
  return values.map((value) => {
    if (!provenanceKinds.includes(value.kind) || !provenanceRelations.includes(value.relation)) throw new MemoryCaptureError("provenance is invalid.");
    const id = cleanReferenceId(value.id);
    const key = `${value.kind}:${id}:${value.relation}`;
    if (seen.has(key)) throw new MemoryCaptureError("provenance must be unique.");
    seen.add(key);
    if (value.kind === "source" && !sourceRegistry.getSource(id)) throw new MemoryCaptureError("provenance source is unknown.");
    const label = value.label === undefined ? undefined : cleanText(value.label, "provenance label", 256);
    return label === undefined ? { kind: value.kind, id, relation: value.relation } : { kind: value.kind, id, relation: value.relation, label };
  });
};

export class InMemoryMemoryCapture implements MemoryCapturePort, MemoryReviewPort {
  private readonly entries = new Map<string, MemoryEntry>();
  private readonly now: () => string;
  private readonly nextId: (prefix: string) => string;
  private readonly sourceRegistry: Pick<SourceRegistryPort, "getSource">;
  private readonly maxEntries: number;
  private readonly maxContentLength: number;
  private readonly persistence?: MemoryEntryPersistencePort;

  public constructor(sourceRegistry: Pick<SourceRegistryPort, "getSource">, options: MemoryCaptureOptions = {}) {
    this.sourceRegistry = sourceRegistry;
    this.now = options.now ?? (() => new Date().toISOString());
    this.nextId = options.nextId ?? ((prefix) => `${prefix}-${this.entries.size + 1}`);
    this.maxEntries = options.maxEntries ?? maxEntriesDefault;
    this.maxContentLength = options.maxContentLength ?? maxContentDefault;
    this.persistence = options.persistence;
    if (!Number.isSafeInteger(this.maxEntries) || this.maxEntries < 1 || this.maxEntries > maxEntriesDefault) throw new MemoryCaptureError("maxEntries is invalid.");
    if (!Number.isSafeInteger(this.maxContentLength) || this.maxContentLength < 1 || this.maxContentLength > maxContentDefault) throw new MemoryCaptureError("maxContentLength is invalid.");
    const persistedEntries = this.persistence?.list(this.maxEntries) ?? [];
    if (persistedEntries.length > this.maxEntries) throw new MemoryCaptureError("persisted memory exceeds bounded capacity.");
    for (const entry of persistedEntries) this.entries.set(entry.entryId, this.clone(entry));
  }

  public capture(request: CaptureMemoryRequest): MemoryEntry {
    if (!kinds.includes(request.kind)) throw new MemoryCaptureError("kind is invalid.");
    const title = cleanText(request.title, "title", maxTitleLength);
    const content = cleanText(request.content, "content", this.maxContentLength, true);
    const visibility = cleanEnum(request.visibility, visibilities, "private", "visibility");
    const providerAccess = cleanEnum(request.providerAccess, providerAccessModes, "never", "providerAccess");
    const retention = cleanEnum(request.retention, retentions, "session", "retention");
    const tags = cleanList(request.tags);
    const provenance = cleanProvenance(request.provenance, this.sourceRegistry);
    const links = cleanLinks(request.links, undefined, visibility, this.entries);
    const existing = [...this.entries.values()].find((entry) => entry.kind === request.kind && entry.title === title && entry.content === content && entry.visibility === visibility);
    if (existing) return this.clone(existing);
    if (this.entries.size >= this.maxEntries) throw new MemoryCaptureError("memory entry capacity reached.");
    const warnings = new Set<string>();
    if (content !== request.content.trim()) warnings.add("content_redacted_or_trimmed");
    if (provenance.length === 0) warnings.add("no_provenance");
    if (providerAccess === "never") warnings.add("provider_access_never");
    const entry: MemoryEntry = {
      entryId: cleanId(this.nextId("memory"), "entryId"),
      kind: request.kind,
      title,
      content,
      state: "review_required",
      visibility,
      providerAccess,
      retention,
      tags,
      provenance,
      links,
      warnings: [...warnings],
      createdAt: this.now(),
    };
    this.persistence?.save(entry);
    this.entries.set(entry.entryId, entry);
    return this.clone(entry);
  }

  public get(entryId: string): MemoryEntry | undefined {
    const entry = this.entries.get(cleanId(entryId, "entryId"));
    return entry === undefined ? undefined : this.clone(entry);
  }

  public review(request: MemoryReviewDecision): MemoryEntry {
    const entryId = cleanId(request.entryId, "entryId");
    const reason = cleanText(request.reason, "reviewReason", 512);
    if (request.decision !== "confirm" && request.decision !== "archive") throw new MemoryCaptureError("review decision is invalid.");
    const entry = this.entries.get(entryId);
    if (!entry) throw new MemoryCaptureError("memory entry is unknown.");
    if (entry.state === "archived") throw new MemoryCaptureError("archived entries cannot be reviewed.");
    const warnings = new Set(entry.warnings);
    if (request.decision === "confirm") warnings.add("user_confirmed_not_externally_verified");
    if (request.decision === "archive") warnings.add("user_archived_entry");
    const reviewed: MemoryEntry = { ...entry, state: request.decision === "confirm" ? "confirmed" : "archived", reviewedAt: this.now(), reviewReason: reason, warnings: [...warnings] };
    this.persistence?.save(reviewed);
    this.entries.set(entryId, reviewed);
    return this.clone(reviewed);
  }

  public listForReview(limit = 64): readonly MemoryEntry[] {
    const safeLimit = this.limit(limit);
    return [...this.entries.values()].filter((entry) => entry.state === "review_required").slice(-safeLimit).reverse().map((entry) => this.clone(entry));
  }

  public list(limit = 64): readonly MemoryEntry[] {
    const safeLimit = this.limit(limit);
    return [...this.entries.values()].slice(-safeLimit).reverse().map((entry) => this.clone(entry));
  }

  public searchLocal(query: string, limit = 32, options?: MemorySearchOptions): readonly MemoryEntry[] {
    const visibility = cleanSearchVisibility(options);
    const normalized = normalizeSearchText(cleanText(query, "query", 512));
    const tokens = normalized.split(" ").filter(Boolean);
    if (tokens.length === 0) throw new MemoryCaptureError("query is invalid.");
    const safeLimit = this.limit(limit);
    return [...this.entries.values()]
      .filter((entry) => visibility === undefined || entry.visibility === visibility)
      .map((entry) => ({ entry, score: searchScore(entry, tokens) }))
      .filter((result) => result.score >= 0)
      .sort((left, right) => right.score - left.score || right.entry.createdAt.localeCompare(left.entry.createdAt) || right.entry.entryId.localeCompare(left.entry.entryId))
      .slice(0, safeLimit)
      .map((result) => this.clone(result.entry));
  }

  private limit(value: number): number {
    if (!Number.isSafeInteger(value) || value < 1 || value > 128) throw new MemoryCaptureError("limit is invalid.");
    return value;
  }

  private clone(entry: MemoryEntry): MemoryEntry {
    return { ...entry, tags: [...entry.tags], provenance: entry.provenance.map((ref) => ({ ...ref })), links: entry.links.map((link) => ({ ...link })), warnings: [...entry.warnings] };
  }
}
