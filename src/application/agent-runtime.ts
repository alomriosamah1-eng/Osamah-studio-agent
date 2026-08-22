import { ResourcePolicy, type ResourceRejectionCode } from "./resource-policy.js";

export type AgentJobState = "queued" | "running" | "completed" | "failed" | "cancelled" | "timed_out";

export interface AgentJobRequest<T> {
  readonly jobId: string;
  readonly run: (signal: AbortSignal) => Promise<T>;
  readonly timeoutMs?: number;
}

export interface AgentJobSnapshot {
  readonly jobId: string;
  readonly state: AgentJobState;
  readonly queuedAt: string;
  readonly startedAt?: string;
  readonly finishedAt?: string;
  readonly error?: string;
}

export class AgentResourceError extends Error {
  public constructor(public readonly code: ResourceRejectionCode | "AGENT_QUEUE_LIMIT", message: string) {
    super(message);
    this.name = "AgentResourceError";
  }
}

interface InternalJob<T> {
  readonly request: AgentJobRequest<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (error: unknown) => void;
  readonly controller: AbortController;
  readonly snapshot: AgentJobSnapshot;
}

export class BoundedAgentRuntime {
  private readonly queue: InternalJob<unknown>[] = [];
  private readonly snapshots = new Map<string, AgentJobSnapshot>();
  private active: InternalJob<unknown> | undefined;
  private draining = false;

  public constructor(private readonly resourcePolicy: ResourcePolicy = new ResourcePolicy("low_memory")) {}

  public submit<T>(request: AgentJobRequest<T>): Promise<T> {
    if (this.snapshots.has(request.jobId)) return Promise.reject(new Error(`Agent job ${request.jobId} already exists.`));
    if (this.queue.length >= this.resourcePolicy.limits.maxQueuedAgentJobs) {
      return Promise.reject(new AgentResourceError("AGENT_QUEUE_LIMIT", `Agent queue limit reached for ${this.resourcePolicy.profile} profile.`));
    }
    const queuedAt = new Date().toISOString();
    const snapshot: AgentJobSnapshot = { jobId: request.jobId, state: "queued", queuedAt };
    const promise = new Promise<T>((resolve, reject) => {
      const job: InternalJob<T> = { request, resolve, reject, controller: new AbortController(), snapshot };
      this.queue.push(job as InternalJob<unknown>);
      this.saveSnapshot(snapshot);
    });
    void this.drain();
    return promise;
  }

  public cancel(jobId: string): boolean {
    if (this.active?.request.jobId === jobId) {
      this.active.controller.abort();
      return true;
    }
    const index = this.queue.findIndex((job) => job.request.jobId === jobId);
    if (index < 0) return false;
    const [job] = this.queue.splice(index, 1);
    if (!job) return false;
    const snapshot = this.update(job.snapshot, { state: "cancelled", finishedAt: new Date().toISOString(), error: "Cancelled before execution." });
    this.saveSnapshot(snapshot);
    job.reject(new Error(`Agent job ${jobId} was cancelled.`));
    return true;
  }

  public inspect(jobId: string): AgentJobSnapshot | undefined { return this.snapshots.get(jobId); }

  public list(): readonly AgentJobSnapshot[] { return [...this.snapshots.values()]; }

  public resourceSnapshot(): ReturnType<ResourcePolicy["snapshot"]> { return this.resourcePolicy.snapshot(); }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.queue.length > 0) {
        const job = this.queue.shift();
        if (!job) continue;
        this.active = job;
        const started = this.update(job.snapshot, { state: "running", startedAt: new Date().toISOString() });
        this.saveSnapshot(started);
        const admission = this.resourcePolicy.acquireAgentJob();
        if (!admission.allowed) {
          const failed = this.update(started, { state: "failed", finishedAt: new Date().toISOString(), error: admission.message });
          this.saveSnapshot(failed);
          job.reject(new AgentResourceError(admission.code, admission.message));
          this.active = undefined;
          continue;
        }
        try {
          const result = await this.runWithTimeout(job);
          const completed = this.update(this.snapshots.get(job.request.jobId) ?? started, { state: "completed", finishedAt: new Date().toISOString() });
          this.saveSnapshot(completed);
          job.resolve(result);
        } catch (error) {
          const timedOut = error instanceof AgentTimeoutError;
          const failed = this.update(this.snapshots.get(job.request.jobId) ?? started, { state: timedOut ? "timed_out" : "failed", finishedAt: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) });
          this.saveSnapshot(failed);
          job.reject(error);
        } finally {
          this.resourcePolicy.releaseAgentJob();
          this.active = undefined;
        }
      }
    } finally {
      this.draining = false;
    }
  }

  private async runWithTimeout<T>(job: InternalJob<T>): Promise<T> {
    const timeoutMs = job.request.timeoutMs ?? 30_000;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    const execution = job.request.run(job.controller.signal);
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        job.controller.abort();
        reject(new AgentTimeoutError(`Agent job ${job.request.jobId} exceeded timeout of ${timeoutMs}ms.`));
      }, timeoutMs);
    });
    try {
      const result = await Promise.race([execution, timeout]);
      if (timedOut) throw new AgentTimeoutError(`Agent job ${job.request.jobId} exceeded timeout of ${timeoutMs}ms.`);
      return result;
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }

  private saveSnapshot(snapshot: AgentJobSnapshot): void {
    this.snapshots.set(snapshot.jobId, snapshot);
    while (this.snapshots.size > this.resourcePolicy.limits.maxAgentHistory) {
      const oldest = [...this.snapshots.keys()].find((jobId) => jobId !== this.active?.request.jobId);
      if (!oldest) break;
      this.snapshots.delete(oldest);
    }
  }

  private update(snapshot: AgentJobSnapshot, patch: Partial<AgentJobSnapshot>): AgentJobSnapshot { return { ...snapshot, ...patch }; }
}

export class AgentTimeoutError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AgentTimeoutError";
  }
}
