import type { AuditRecord, AuditRetentionStore, AuditTrail } from "./agent-contracts.js";

export interface AuditRetentionClock {
  now(): string;
}

export interface AuditRetentionOptions {
  readonly maxAgeMs?: number;
  readonly maxRecords?: number;
}

export interface AuditRetentionResult {
  readonly cutoff: string;
  readonly deletedByAge: number;
  readonly deletedByCount: number;
  readonly remaining: number;
}

const dayMs = 24 * 60 * 60 * 1000;
const minimumAgeMs = dayMs;
const maximumAgeMs = 365 * dayMs;
const maximumRecords = 256;

const boundedAge = (value: number | undefined): number => {
  const candidate = value ?? 30 * dayMs;
  if (!Number.isFinite(candidate) || candidate < minimumAgeMs) throw new Error("Audit retention age must be at least one day.");
  return Math.min(Math.floor(candidate), maximumAgeMs);
};

const boundedRecords = (value: number | undefined): number => {
  const candidate = value ?? maximumRecords;
  if (!Number.isFinite(candidate) || candidate < 1) throw new Error("Audit retention record limit must be positive.");
  return Math.min(Math.floor(candidate), maximumRecords);
};

export class BoundedAuditRetentionPolicy {
  public constructor(
    private readonly trail: AuditTrail & AuditRetentionStore,
    private readonly clock: AuditRetentionClock,
  ) {}

  public prune(options: AuditRetentionOptions = {}): AuditRetentionResult {
    const now = this.clock.now();
    const nowMs = Date.parse(now);
    if (!Number.isFinite(nowMs)) throw new Error("Audit retention clock returned an invalid timestamp.");
    const cutoff = new Date(nowMs - boundedAge(options.maxAgeMs)).toISOString();
    const deletedByAge = this.trail.deleteBefore(cutoff);
    const limit = boundedRecords(options.maxRecords);
    const records = this.trail.list(maximumRecords);
    const overflow = records.slice(limit).map((record: AuditRecord) => record.id);
    const deletedByCount = overflow.length > 0 ? this.trail.deleteIds(overflow) : 0;
    return {
      cutoff,
      deletedByAge,
      deletedByCount,
      remaining: this.trail.list(maximumRecords).length,
    };
  }
}
