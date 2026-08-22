export type ResourceProfile = "low_memory" | "standard";

export interface ResourceLimits {
  readonly maxPreviewSessions: number;
  readonly maxAgentJobs: number;
  readonly maxQueuedAgentJobs: number;
  readonly maxAgentHistory: number;
  readonly maxPreviewSourceBytes: number;
  readonly maxPreviewModules: number;
  readonly maxPreviewAssets: number;
  readonly maxPreviewWarnings: number;
  readonly maxTextFileBytes: number;
  readonly maxMemoryTargetBytes: number;
  readonly refreshDebounceMs: number;
}

export const LOW_MEMORY_RESOURCE_LIMITS: ResourceLimits = Object.freeze({
  maxPreviewSessions: 1,
  maxAgentJobs: 1,
  maxQueuedAgentJobs: 4,
  maxAgentHistory: 32,
  maxPreviewSourceBytes: 24 * 1024 * 1024,
  maxPreviewModules: 256,
  maxPreviewAssets: 128,
  maxPreviewWarnings: 256,
  maxTextFileBytes: 1_500_000,
  maxMemoryTargetBytes: 1_024 * 1024 * 1024,
  refreshDebounceMs: 250,
});

export const STANDARD_RESOURCE_LIMITS: ResourceLimits = Object.freeze({
  maxPreviewSessions: 2,
  maxAgentJobs: 2,
  maxQueuedAgentJobs: 8,
  maxAgentHistory: 64,
  maxPreviewSourceBytes: 48 * 1024 * 1024,
  maxPreviewModules: 512,
  maxPreviewAssets: 256,
  maxPreviewWarnings: 512,
  maxTextFileBytes: 2_000_000,
  maxMemoryTargetBytes: 1_536 * 1024 * 1024,
  refreshDebounceMs: 150,
});

export const limitsForProfile = (profile: ResourceProfile): ResourceLimits => profile === "low_memory" ? LOW_MEMORY_RESOURCE_LIMITS : STANDARD_RESOURCE_LIMITS;

export const resourceProfileForTotalMemory = (totalMemoryBytes: number): ResourceProfile => totalMemoryBytes <= 8 * 1024 * 1024 * 1024 ? "low_memory" : "standard";

export type ResourceRejectionCode = "PREVIEW_SESSION_LIMIT" | "AGENT_JOB_LIMIT" | "PREVIEW_SOURCE_LIMIT" | "PREVIEW_MODULE_LIMIT" | "PREVIEW_ASSET_LIMIT" | "PREVIEW_WARNING_LIMIT";

export type ResourceAdmission =
  | { readonly allowed: true; readonly profile: ResourceProfile; readonly limits: ResourceLimits }
  | { readonly allowed: false; readonly code: ResourceRejectionCode; readonly message: string; readonly profile: ResourceProfile; readonly limits: ResourceLimits };

export interface PreviewBudgetInput {
  readonly sourceBytes: number;
  readonly moduleCount: number;
  readonly assetCount: number;
  readonly warningCount: number;
}

export class SupersededTaskError extends Error {
  public readonly code = "SUPERSEDED" as const;

  public constructor() {
    super("The queued task was superseded by a newer request.");
    this.name = "SupersededTaskError";
  }
}

type PendingTask<T> = {
  readonly task: () => Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (error: unknown) => void;
};

export class LatestOnlyAsyncQueue<T> {
  private running = false;
  private pending: PendingTask<T> | undefined;

  public enqueue(task: () => Promise<T>): Promise<T> {
    const promise = new Promise<T>((resolve, reject) => {
      if (this.pending) this.pending.reject(new SupersededTaskError());
      this.pending = { task, resolve, reject };
    });
    void this.drain();
    return promise;
  }

  public pendingCount(): number { return this.pending ? 1 : 0; }

  public cancelPending(): void {
    if (this.pending) this.pending.reject(new SupersededTaskError());
    this.pending = undefined;
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (this.pending) {
        const current = this.pending;
        this.pending = undefined;
        try {
          current.resolve(await current.task());
        } catch (error) {
          current.reject(error);
        }
      }
    } finally {
      this.running = false;
    }
  }
}

export class ResourcePolicy {
  private activePreviewSessions = 0;
  private activeAgentJobs = 0;

  public constructor(public readonly profile: ResourceProfile = "low_memory", public readonly limits: ResourceLimits = limitsForProfile(profile)) {}

  public snapshot(): { readonly activePreviewSessions: number; readonly activeAgentJobs: number; readonly profile: ResourceProfile } {
    return { activePreviewSessions: this.activePreviewSessions, activeAgentJobs: this.activeAgentJobs, profile: this.profile };
  }

  public acquirePreview(): ResourceAdmission {
    if (this.activePreviewSessions >= this.limits.maxPreviewSessions) return this.reject("PREVIEW_SESSION_LIMIT", `Preview session limit reached for ${this.profile} profile.`);
    this.activePreviewSessions += 1;
    return this.allow();
  }

  public releasePreview(): void {
    this.activePreviewSessions = Math.max(0, this.activePreviewSessions - 1);
  }

  public acquireAgentJob(): ResourceAdmission {
    if (this.activeAgentJobs >= this.limits.maxAgentJobs) return this.reject("AGENT_JOB_LIMIT", `Agent concurrency limit reached for ${this.profile} profile.`);
    this.activeAgentJobs += 1;
    return this.allow();
  }

  public releaseAgentJob(): void {
    this.activeAgentJobs = Math.max(0, this.activeAgentJobs - 1);
  }

  public checkPreviewBudget(input: PreviewBudgetInput): ResourceAdmission {
    if (input.sourceBytes > this.limits.maxPreviewSourceBytes) return this.reject("PREVIEW_SOURCE_LIMIT", `Preview source budget exceeded: ${input.sourceBytes} > ${this.limits.maxPreviewSourceBytes} bytes.`);
    if (input.moduleCount > this.limits.maxPreviewModules) return this.reject("PREVIEW_MODULE_LIMIT", `Preview module budget exceeded: ${input.moduleCount} > ${this.limits.maxPreviewModules}.`);
    if (input.assetCount > this.limits.maxPreviewAssets) return this.reject("PREVIEW_ASSET_LIMIT", `Preview asset budget exceeded: ${input.assetCount} > ${this.limits.maxPreviewAssets}.`);
    if (input.warningCount > this.limits.maxPreviewWarnings) return this.reject("PREVIEW_WARNING_LIMIT", `Preview warning budget exceeded: ${input.warningCount} > ${this.limits.maxPreviewWarnings}.`);
    return this.allow();
  }

  public trim<T>(items: readonly T[], limit = this.limits.maxPreviewWarnings): readonly T[] {
    const boundedLimit = Math.max(1, Math.min(Math.floor(limit), this.limits.maxPreviewWarnings));
    return items.slice(-boundedLimit);
  }

  private allow(): ResourceAdmission { return { allowed: true, profile: this.profile, limits: this.limits }; }

  private reject(code: ResourceRejectionCode, message: string): ResourceAdmission {
    return { allowed: false, code, message, profile: this.profile, limits: this.limits };
  }
}
