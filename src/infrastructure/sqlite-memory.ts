import { sanitizeAuditText } from "../application/agent-contracts.js";
import type { SqlExecutor } from "../application/ports.js";
import type { MemoryEntry, MemoryEntryPersistencePort, MemoryEntryKind, MemoryEntryState, MemoryProvenanceKind, MemoryVisibility, MemoryProviderAccess, MemoryRetention } from "../application/memory-capture.js";
import type { MemoryCandidate, MemoryCandidatePersistencePort, MemoryCandidateKind, MemoryCandidateState, MemorySensitivity } from "../application/memory-consolidation.js";

interface SqlRow extends Record<string, unknown> {}

const entryKinds: readonly MemoryEntryKind[] = ["note", "decision", "task", "research", "learning", "idea", "summary"];
const entryStates: readonly MemoryEntryState[] = ["review_required", "confirmed", "archived"];
const visibilities: readonly MemoryVisibility[] = ["private", "workspace", "project"];
const providerAccessModes: readonly MemoryProviderAccess[] = ["never", "explicit_only"];
const retentions: readonly MemoryRetention[] = ["session", "project", "until_deleted"];
const provenanceKinds: readonly MemoryProvenanceKind[] = ["source", "artifact", "task"];
const provenanceRelations: readonly MemoryEntry["provenance"][number]["relation"][] = ["derived_from", "supports", "related_to"];
const candidateKinds: readonly MemoryCandidateKind[] = ["summary", "fact", "decision", "procedure", "episode"];
const candidateStates: readonly MemoryCandidateState[] = ["review_required", "consolidated", "archived"];
const sensitivities: readonly MemorySensitivity[] = ["routine", "personal", "sensitive", "secret_shaped"];

const text = (value: unknown, field: string, maxLength: number, allowNewlines = false): string => {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength || value.includes("\0") || value.trim() !== value || (!allowNewlines && (value.includes("\r") || value.includes("\n")))) {
    throw new Error(`SQLite memory row field ${field} is invalid.`);
  }
  return value;
};

const optionalText = (value: unknown, field: string, maxLength: number, allowNewlines = false): string | undefined => value === null || value === undefined ? undefined : text(value, field, maxLength, allowNewlines);

const timestamp = (value: unknown, field: string): string => {
  const valueText = text(value, field, 128);
  if (!Number.isFinite(Date.parse(valueText))) throw new Error(`SQLite memory row field ${field} is invalid.`);
  return valueText;
};

const enumValue = <T extends string>(value: unknown, field: string, allowed: readonly T[]): T => {
  const selected = text(value, field, 64);
  if (!allowed.includes(selected as T)) throw new Error(`SQLite memory row field ${field} is invalid.`);
  return selected as T;
};

const numberValue = (value: unknown, field: string, min?: number, max?: number): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || (min !== undefined && value < min) || (max !== undefined && value > max)) throw new Error(`SQLite memory row field ${field} is invalid.`);
  return value;
};

const jsonArray = (value: unknown, field: string, maxItems: number): readonly unknown[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text(value, field, 256 * 1024));
  } catch {
    throw new Error(`SQLite memory row field ${field} is invalid JSON.`);
  }
  if (!Array.isArray(parsed) || parsed.length > maxItems) throw new Error(`SQLite memory row field ${field} is not a bounded array.`);
  return parsed;
};

const stringArray = (value: unknown, field: string, maxItems: number, maxItemLength: number): readonly string[] => {
  const values = jsonArray(value, field, maxItems).map((item) => text(item, `${field}[]`, maxItemLength));
  if (new Set(values).size !== values.length) throw new Error(`SQLite memory row field ${field} contains duplicates.`);
  return values;
};

const saveJson = (value: readonly unknown[], field: string, maxBytes = 256 * 1024): string => {
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new Error(`SQLite memory field ${field} cannot be serialized.`);
  }
  if (typeof serialized !== "string" || serialized.length > maxBytes) throw new Error(`SQLite memory field ${field} exceeds bounded limits.`);
  return serialized;
};

const asProvenance = (value: unknown): MemoryEntry["provenance"][number] => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("SQLite memory provenance row is invalid.");
  const row = value as Record<string, unknown>;
  const kind = enumValue(row.kind, "provenance.kind", provenanceKinds);
  const relation = enumValue(row.relation, "provenance.relation", provenanceRelations);
  const id = text(row.id, "provenance.id", 256);
  if (id.startsWith("/") || id.startsWith("~") || id.includes("\\") || id.includes("..") || id.includes("/")) throw new Error("SQLite memory provenance id is unsafe.");
  const label = optionalText(row.label, "provenance.label", 256);
  return label === undefined ? { kind, id, relation } : { kind, id, relation, label };
};

const provenanceArray = (value: unknown): MemoryEntry["provenance"] => jsonArray(value, "provenance_json", 16).map(asProvenance);

const asMemoryEntry = (row: SqlRow): MemoryEntry => {
  const reviewedAt = optionalText(row.reviewed_at, "reviewed_at", 128);
  const reviewReason = optionalText(row.review_reason, "review_reason", 512);
  if ((reviewedAt === undefined) !== (reviewReason === undefined)) throw new Error("SQLite memory review fields are inconsistent.");
  return {
    entryId: text(row.entry_id, "entry_id", 256),
    kind: enumValue(row.kind, "kind", entryKinds),
    title: text(row.title, "title", 512),
    content: text(row.content, "content", 64 * 1024, true),
    state: enumValue(row.state, "state", entryStates),
    visibility: enumValue(row.visibility, "visibility", visibilities),
    providerAccess: enumValue(row.provider_access, "provider_access", providerAccessModes),
    retention: enumValue(row.retention, "retention", retentions),
    tags: stringArray(row.tags_json, "tags_json", 128, 128),
    provenance: provenanceArray(row.provenance_json),
    warnings: stringArray(row.warnings_json, "warnings_json", 64, 256),
    createdAt: timestamp(row.created_at, "created_at"),
    ...(reviewedAt === undefined ? {} : { reviewedAt }),
    ...(reviewReason === undefined ? {} : { reviewReason }),
  };
};

const asCandidateSource = (value: unknown): MemoryCandidate["sources"][number] => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("SQLite memory candidate source row is invalid.");
  const row = value as Record<string, unknown>;
  return { entryId: text(row.entryId, "sources[].entryId", 256), state: enumValue(row.state, "sources[].state", entryStates), kind: enumValue(row.kind, "sources[].kind", entryKinds) };
};

const candidateSources = (value: unknown): MemoryCandidate["sources"] => jsonArray(value, "sources_json", 8).map(asCandidateSource);

const asMemoryCandidate = (row: SqlRow): MemoryCandidate => {
  const reviewedAt = optionalText(row.reviewed_at, "reviewed_at", 128);
  const reviewReason = optionalText(row.review_reason, "review_reason", 512);
  if ((reviewedAt === undefined) !== (reviewReason === undefined)) throw new Error("SQLite memory candidate review fields are inconsistent.");
  const visibility = enumValue(row.visibility, "visibility", ["private"] as const);
  const providerAccess = enumValue(row.provider_access, "provider_access", ["never"] as const);
  if (visibility !== "private" || providerAccess !== "never") throw new Error("SQLite memory candidate access policy is invalid.");
  const sourceEntryIds = stringArray(row.source_entry_ids_json, "source_entry_ids_json", 8, 256);
  const sources = candidateSources(row.sources_json);
  if (sources.length !== sourceEntryIds.length || sources.some((source, index) => source.entryId !== sourceEntryIds[index])) throw new Error("SQLite memory candidate sources are inconsistent.");
  return {
    candidateId: text(row.candidate_id, "candidate_id", 256),
    version: numberValue(row.version, "version", 1, 1) as 1,
    kind: enumValue(row.kind, "kind", candidateKinds),
    title: text(row.title, "title", 512),
    content: text(row.content, "content", 16_000, true),
    sourceEntryIds,
    sources,
    scope: text(row.scope, "scope", 512),
    importance: numberValue(row.importance, "importance", 1, 5),
    ...(optionalText(row.expires_at, "expires_at", 128) === undefined ? {} : { expiresAt: timestamp(row.expires_at, "expires_at") }),
    sensitivity: enumValue(row.sensitivity, "sensitivity", sensitivities),
    state: enumValue(row.state, "state", candidateStates),
    visibility,
    providerAccess,
    createdAt: timestamp(row.created_at, "created_at"),
    ...(reviewedAt === undefined ? {} : { reviewedAt }),
    ...(reviewReason === undefined ? {} : { reviewReason }),
    blockedReasons: stringArray(row.blocked_reasons_json, "blocked_reasons_json", 16, 256),
  };
};

const boundedLimit = (limit: number, max: number): number => {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > max) throw new Error("SQLite memory list limit is invalid.");
  return limit;
};

export class SqliteMemoryEntryRepository implements MemoryEntryPersistencePort {
  public constructor(private readonly database: SqlExecutor) {}

  public save(entry: MemoryEntry): void {
    this.database.run(`INSERT INTO memory_entries(entry_id, kind, title, content, state, visibility, provider_access, retention, tags_json, provenance_json, warnings_json, created_at, reviewed_at, review_reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(entry_id) DO UPDATE SET kind=excluded.kind, title=excluded.title, content=excluded.content, state=excluded.state, visibility=excluded.visibility,
        provider_access=excluded.provider_access, retention=excluded.retention, tags_json=excluded.tags_json, provenance_json=excluded.provenance_json,
        warnings_json=excluded.warnings_json, reviewed_at=excluded.reviewed_at, review_reason=excluded.review_reason`,
    [entry.entryId, entry.kind, sanitizeAuditText(entry.title, 512), sanitizeAuditText(entry.content, 64 * 1024), entry.state, entry.visibility, entry.providerAccess, entry.retention, saveJson(entry.tags, "tags"), saveJson(entry.provenance, "provenance"), saveJson(entry.warnings, "warnings"), entry.createdAt, entry.reviewedAt ?? null, entry.reviewReason === undefined ? null : sanitizeAuditText(entry.reviewReason, 512)]);
  }

  public list(limit = 256): readonly MemoryEntry[] {
    const rows = this.database.all<SqlRow>("SELECT entry_id, kind, title, content, state, visibility, provider_access, retention, tags_json, provenance_json, warnings_json, created_at, reviewed_at, review_reason FROM memory_entries ORDER BY created_at DESC, entry_id DESC LIMIT ?", [boundedLimit(limit, 256)]);
    return rows.map(asMemoryEntry);
  }
}

export class SqliteMemoryCandidateRepository implements MemoryCandidatePersistencePort {
  public constructor(private readonly database: SqlExecutor) {}

  public save(candidate: MemoryCandidate): void {
    this.database.run(`INSERT INTO memory_candidates(candidate_id, version, kind, title, content, source_entry_ids_json, sources_json, scope, importance, expires_at, sensitivity, state, visibility, provider_access, created_at, reviewed_at, review_reason, blocked_reasons_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(candidate_id) DO UPDATE SET version=excluded.version, kind=excluded.kind, title=excluded.title, content=excluded.content,
        source_entry_ids_json=excluded.source_entry_ids_json, sources_json=excluded.sources_json, scope=excluded.scope, importance=excluded.importance,
        expires_at=excluded.expires_at, sensitivity=excluded.sensitivity, state=excluded.state, visibility=excluded.visibility, provider_access=excluded.provider_access,
        reviewed_at=excluded.reviewed_at, review_reason=excluded.review_reason, blocked_reasons_json=excluded.blocked_reasons_json`,
    [candidate.candidateId, candidate.version, candidate.kind, sanitizeAuditText(candidate.title, 512), sanitizeAuditText(candidate.content, 16_000), saveJson(candidate.sourceEntryIds, "sourceEntryIds", 8 * 256), saveJson(candidate.sources, "sources", 8 * 1024), sanitizeAuditText(candidate.scope, 512), candidate.importance, candidate.expiresAt ?? null, candidate.sensitivity, candidate.state, "private", "never", candidate.createdAt, candidate.reviewedAt ?? null, candidate.reviewReason === undefined ? null : sanitizeAuditText(candidate.reviewReason, 512), saveJson(candidate.blockedReasons, "blockedReasons")]);
  }

  public list(limit = 128): readonly MemoryCandidate[] {
    const rows = this.database.all<SqlRow>("SELECT candidate_id, version, kind, title, content, source_entry_ids_json, sources_json, scope, importance, expires_at, sensitivity, state, visibility, provider_access, created_at, reviewed_at, review_reason, blocked_reasons_json FROM memory_candidates ORDER BY created_at DESC, candidate_id DESC LIMIT ?", [boundedLimit(limit, 128)]);
    return rows.map(asMemoryCandidate);
  }
}

export interface SqliteMemoryPersistence {
  readonly memoryEntries: SqliteMemoryEntryRepository;
  readonly memoryCandidates: SqliteMemoryCandidateRepository;
}

export const createSqliteMemoryPersistence = (database: SqlExecutor): SqliteMemoryPersistence => ({
  memoryEntries: new SqliteMemoryEntryRepository(database),
  memoryCandidates: new SqliteMemoryCandidateRepository(database),
});
