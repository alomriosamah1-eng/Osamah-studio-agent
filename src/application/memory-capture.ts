import { sanitizeAuditText } from "./agent-contracts.js";
import type { SourceRegistryPort } from "./source-registry.js";

export type MemoryEntryKind = "note" | "decision" | "task" | "research" | "learning" | "idea" | "summary";
export type MemoryEntryState = "review_required" | "confirmed" | "archived";
export type MemoryVisibility = "private" | "workspace" | "project";
export type MemoryProviderAccess = "never" | "explicit_only";
export type MemoryRetention = "session" | "project" | "until_deleted";
export type MemoryProvenanceKind = "source" | "artifact" | "task";

export interface MemoryProvenanceRef {
  readonly kind: MemoryProvenanceKind;
  readonly id: string;
  readonly relation: "derived_from" | "supports" | "related_to";
  readonly label?: string;
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
  readonly warnings: readonly string[];
  readonly createdAt: string;
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
}

export interface MemoryCapturePort {
  capture(request: CaptureMemoryRequest): MemoryEntry;
  get(entryId: string): MemoryEntry | undefined;
  list(limit?: number): readonly MemoryEntry[];
  searchLocal(query: string, limit?: number): readonly MemoryEntry[];
}

export interface MemoryCaptureOptions {
  readonly now?: () => string;
  readonly nextId?: (prefix: string) => string;
  readonly maxEntries?: number;
  readonly maxContentLength?: number;
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
const maxTitleLength = 512;
const maxTagLength = 128;
const maxIdLength = 256;
const maxTags = 128;
const maxProvenance = 16;
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

export class InMemoryMemoryCapture implements MemoryCapturePort {
  private readonly entries = new Map<string, MemoryEntry>();
  private readonly now: () => string;
  private readonly nextId: (prefix: string) => string;
  private readonly sourceRegistry: Pick<SourceRegistryPort, "getSource">;
  private readonly maxEntries: number;
  private readonly maxContentLength: number;

  public constructor(sourceRegistry: Pick<SourceRegistryPort, "getSource">, options: MemoryCaptureOptions = {}) {
    this.sourceRegistry = sourceRegistry;
    this.now = options.now ?? (() => new Date().toISOString());
    this.nextId = options.nextId ?? ((prefix) => `${prefix}-${this.entries.size + 1}`);
    this.maxEntries = options.maxEntries ?? maxEntriesDefault;
    this.maxContentLength = options.maxContentLength ?? maxContentDefault;
    if (!Number.isSafeInteger(this.maxEntries) || this.maxEntries < 1 || this.maxEntries > maxEntriesDefault) throw new MemoryCaptureError("maxEntries is invalid.");
    if (!Number.isSafeInteger(this.maxContentLength) || this.maxContentLength < 1 || this.maxContentLength > maxContentDefault) throw new MemoryCaptureError("maxContentLength is invalid.");
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
      warnings: [...warnings],
      createdAt: this.now(),
    };
    this.entries.set(entry.entryId, entry);
    return this.clone(entry);
  }

  public get(entryId: string): MemoryEntry | undefined {
    const entry = this.entries.get(cleanId(entryId, "entryId"));
    return entry === undefined ? undefined : this.clone(entry);
  }

  public list(limit = 64): readonly MemoryEntry[] {
    const safeLimit = this.limit(limit);
    return [...this.entries.values()].slice(-safeLimit).reverse().map((entry) => this.clone(entry));
  }

  public searchLocal(query: string, limit = 32): readonly MemoryEntry[] {
    const normalized = cleanText(query, "query", 512).toLocaleLowerCase();
    const safeLimit = this.limit(limit);
    return [...this.entries.values()].reverse().filter((entry) => `${entry.title}\n${entry.content}\n${entry.tags.join(" ")}`.toLocaleLowerCase().includes(normalized)).slice(0, safeLimit).map((entry) => this.clone(entry));
  }

  private limit(value: number): number {
    if (!Number.isSafeInteger(value) || value < 1 || value > 128) throw new MemoryCaptureError("limit is invalid.");
    return value;
  }

  private clone(entry: MemoryEntry): MemoryEntry {
    return { ...entry, tags: [...entry.tags], provenance: entry.provenance.map((ref) => ({ ...ref })), warnings: [...entry.warnings] };
  }
}
