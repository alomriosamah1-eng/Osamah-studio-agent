import { createHash } from "node:crypto";
import { AgentAuthorizationError, BoundedAgentRuntime } from "./agent-runtime.js";
import type { AgentActionRequest } from "./agent-contracts.js";
import type {
  ProjectContextSnapshot,
  TargetedContextFile,
} from "./project-context.js";
import type { EventBus } from "../domain/events.js";
import { approvalId as toApprovalId, sessionId as toSessionId } from "../domain/primitives.js";

export interface AgentPlanStep {
  readonly id: string;
  readonly title: string;
  readonly description: string;
}

export interface AgentPlan {
  readonly summary: string;
  readonly steps: readonly AgentPlanStep[];
}

export interface PatchOperation {
  readonly relativePath: string;
  readonly mode: "create" | "update";
  readonly content: string;
  readonly expectedSha256?: string;
}

export interface PatchProposal {
  readonly proposalId: string;
  readonly operations: readonly PatchOperation[];
}

export interface PatchValidation {
  readonly valid: boolean;
  readonly files: readonly string[];
  readonly bytes: number;
  readonly reason?: string;
}

export interface PatchPort {
  preview(rootPath: string, patch: PatchProposal): Promise<PatchValidation>;
  apply(rootPath: string, patch: PatchProposal, validation: PatchValidation, signal?: AbortSignal): Promise<void>;
}

export interface ContextIndexPort {
  build(rootPath: string): Promise<ProjectContextSnapshot>;
  readTargeted(rootPath: string, relativePaths: readonly string[]): Promise<readonly TargetedContextFile[]>;
}

export interface Checkpoint {
  readonly checkpointId: string;
  readonly cycleId: string;
  readonly rootPath: string;
  readonly createdAt: string;
  readonly planDigest: string;
  readonly patchDigest: string;
  readonly targetFiles: readonly string[];
  readonly sourceHashes: Readonly<Record<string, string>>;
}

export interface CheckpointStore {
  save(checkpoint: Checkpoint): void;
  get(checkpointId: string): Checkpoint | undefined;
  list(limit?: number): readonly Checkpoint[];
}

export type WorkCycleStage = "received" | "planning" | "patch_ready" | "waiting_approval" | "checkpointed" | "applied" | "denied" | "cancelled" | "failed";

export interface WorkCycleRequest {
  readonly cycleId: string;
  readonly sessionId: string;
  readonly rootPath: string;
  readonly goal: string;
  readonly constraints: readonly string[];
  readonly targetedPaths: readonly string[];
  readonly plan: AgentPlan;
  readonly patch: PatchProposal;
  readonly approvalId?: string;
  readonly timeoutMs?: number;
}

export interface WorkCycleSnapshot {
  readonly cycleId: string;
  readonly sessionId: string;
  readonly rootPath: string;
  readonly stage: WorkCycleStage;
  readonly goal: string;
  readonly planDigest: string;
  readonly patchDigest: string;
  readonly updatedAt: string;
  readonly checkpointId?: string;
  readonly approvalId?: string;
  readonly error?: string;
}

export interface WorkCycleResult {
  readonly cycle: WorkCycleSnapshot;
  readonly context?: ProjectContextSnapshot;
  readonly targetedFiles: readonly TargetedContextFile[];
  readonly plan: AgentPlan;
  readonly validation?: PatchValidation;
  readonly checkpoint?: Checkpoint;
}

export interface AgentWorkCycleDependencies {
  readonly runtime: BoundedAgentRuntime;
  readonly context: ContextIndexPort;
  readonly patches: PatchPort;
  readonly checkpoints: CheckpointStore;
  readonly events: EventBus;
  readonly now: () => string;
  readonly nextId: (prefix: string) => string;
}

const digest = (value: unknown): string => createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");

const requiredText = (value: string, field: string): string => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2_000 || trimmed.includes("\0") || trimmed.includes("\r") || trimmed.includes("\n")) throw new WorkCycleError(`${field} is invalid.`);
  return trimmed;
};

const validateRequest = (input: WorkCycleRequest): void => {
  requiredText(input.cycleId, "cycleId");
  requiredText(input.sessionId, "sessionId");
  requiredText(input.rootPath, "rootPath");
  requiredText(input.goal, "goal");
  if (input.constraints.length > 32 || input.targetedPaths.length > 24 || input.plan.steps.length > 16 || input.patch.operations.length > 16) {
    throw new WorkCycleError("Work cycle request exceeds bounded limits.");
  }
  for (const constraint of input.constraints) requiredText(constraint, "constraint");
  for (const path of input.targetedPaths) requiredText(path, "targetedPath");
  requiredText(input.plan.summary, "plan summary");
  for (const step of input.plan.steps) {
    requiredText(step.id, "plan step id");
    requiredText(step.title, "plan step title");
    requiredText(step.description, "plan step description");
  }
  requiredText(input.patch.proposalId, "patch proposalId");
  for (const operation of input.patch.operations) {
    requiredText(operation.relativePath, "patch relativePath");
    if (!operation.content || operation.content.length > 512 * 1024) throw new WorkCycleError("Patch content exceeds the per-file limit.");
    if (operation.expectedSha256 && !/^[a-f0-9]{64}$/i.test(operation.expectedSha256)) throw new WorkCycleError("Patch expectedSha256 is invalid.");
  }
};

export class WorkCycleError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "WorkCycleError";
  }
}

export class WorkCycleConflictError extends WorkCycleError {
  public constructor(message: string) {
    super(message);
    this.name = "WorkCycleConflictError";
  }
}

export class AgentWorkCycleService {
  private readonly snapshots = new Map<string, WorkCycleSnapshot>();

  public constructor(
    private readonly dependencies: AgentWorkCycleDependencies,
    private readonly maxHistory = 64,
  ) {}

  public async start(input: WorkCycleRequest): Promise<WorkCycleResult> {
    validateRequest(input);
    const planDigest = digest({ goal: input.goal, constraints: input.constraints, plan: input.plan });
    const patchDigest = digest(input.patch);
    const existing = this.snapshots.get(input.cycleId);
    if (existing && existing.stage !== "waiting_approval") throw new WorkCycleConflictError(`Work cycle ${input.cycleId} is already ${existing.stage}.`);
    if (existing && (existing.planDigest !== planDigest || existing.patchDigest !== patchDigest)) throw new WorkCycleConflictError(`Work cycle ${input.cycleId} resume payload does not match the original proposal.`);

    const received = existing ?? this.save({
      cycleId: input.cycleId,
      sessionId: input.sessionId,
      rootPath: input.rootPath,
      stage: "received",
      goal: input.goal,
      planDigest,
      patchDigest,
      updatedAt: this.dependencies.now(),
    });
    if (!existing) this.dependencies.events.publish({ type: "WorkCycleStarted", cycleId: input.cycleId, sessionId: toSessionId(input.sessionId), occurredAt: received.updatedAt });

    let context: ProjectContextSnapshot | undefined;
    let targetedFiles: readonly TargetedContextFile[] = [];
    let validation: PatchValidation | undefined;
    try {
      context = await this.dependencies.context.build(input.rootPath);
      if (this.snapshots.get(input.cycleId)?.stage === "cancelled") return { cycle: this.snapshots.get(input.cycleId)!, context, targetedFiles, plan: input.plan, validation };
      targetedFiles = await this.dependencies.context.readTargeted(input.rootPath, input.targetedPaths);
      const latestBeforePlanning = this.snapshots.get(input.cycleId);
      if (latestBeforePlanning?.stage === "cancelled") return { cycle: latestBeforePlanning, context, targetedFiles, plan: input.plan, validation };
      this.save({ ...(latestBeforePlanning ?? received), stage: "planning", updatedAt: this.dependencies.now() });
      validation = await this.dependencies.patches.preview(input.rootPath, input.patch);
      if (!validation.valid) return this.failResult(input, context, targetedFiles, validation, validation.reason ?? "Patch validation failed.");
      const latestBeforePatchReady = this.snapshots.get(input.cycleId);
      if (latestBeforePatchReady?.stage === "cancelled") return { cycle: latestBeforePatchReady, context, targetedFiles, plan: input.plan, validation };
      this.save({ ...(latestBeforePatchReady ?? received), stage: "patch_ready", updatedAt: this.dependencies.now() });

      if (input.patch.operations.length === 0) {
        const latestBeforeNoop = this.snapshots.get(input.cycleId);
        if (latestBeforeNoop?.stage === "cancelled") return { cycle: latestBeforeNoop, context, targetedFiles, plan: input.plan, validation };
        const checkpoint = this.createCheckpoint(input, targetedFiles);
        const checkpointed = this.save({ ...(this.snapshots.get(input.cycleId) ?? received), stage: "checkpointed", checkpointId: checkpoint.checkpointId, updatedAt: this.dependencies.now() });
        this.dependencies.events.publish({ type: "WorkCycleCheckpointed", cycleId: input.cycleId, checkpointId: checkpoint.checkpointId, occurredAt: checkpoint.createdAt });
        return { cycle: checkpointed, context, targetedFiles, plan: input.plan, validation, checkpoint };
      }

      const action: AgentActionRequest = {
        actionId: `${input.cycleId}:patch`,
        sessionId: input.sessionId,
        kind: "filesystem.write",
        risk: "high",
        scope: validation.files.join(",").slice(0, 512),
        idempotencyKey: input.patch.proposalId,
      };
      const checkpoint = await this.dependencies.runtime.submitGuarded({
        jobId: input.cycleId,
        timeoutMs: input.timeoutMs,
        run: async (signal) => {
          if (signal.aborted) throw new WorkCycleError("Work cycle was cancelled before patch application.");
          const preApplyCheckpoint = this.createCheckpoint(input, targetedFiles);
          const currentValidation = await this.dependencies.patches.preview(input.rootPath, input.patch);
          if (!currentValidation.valid) throw new WorkCycleError(currentValidation.reason ?? "Patch became invalid before application.");
          if (signal.aborted) throw new WorkCycleError("Work cycle was cancelled before patch application.");
          const latestBeforeCheckpoint = this.snapshots.get(input.cycleId);
          if (latestBeforeCheckpoint?.stage === "cancelled") throw new WorkCycleError("Work cycle was cancelled before patch application.");
          this.save({ ...(latestBeforeCheckpoint ?? received), stage: "checkpointed", checkpointId: preApplyCheckpoint.checkpointId, updatedAt: this.dependencies.now() });
          this.dependencies.events.publish({ type: "WorkCycleCheckpointed", cycleId: input.cycleId, checkpointId: preApplyCheckpoint.checkpointId, occurredAt: preApplyCheckpoint.createdAt });
          await this.dependencies.patches.apply(input.rootPath, input.patch, currentValidation, signal);
          return preApplyCheckpoint;
        },
      }, action, input.approvalId);
      const latest = this.snapshots.get(input.cycleId);
      if (latest?.stage === "cancelled") return { cycle: latest, context, targetedFiles, plan: input.plan, validation, checkpoint };
      const applied = this.save({ ...received, stage: "applied", checkpointId: checkpoint.checkpointId, updatedAt: this.dependencies.now() });
      this.dependencies.events.publish({ type: "WorkCycleApplied", cycleId: input.cycleId, checkpointId: checkpoint.checkpointId, occurredAt: applied.updatedAt });
      return { cycle: applied, context, targetedFiles, plan: input.plan, validation, checkpoint };
    } catch (error) {
      const cancelled = this.snapshots.get(input.cycleId);
      if (cancelled?.stage === "cancelled") {
        return { cycle: cancelled, context, targetedFiles, plan: input.plan, validation };
      }
      if (error instanceof AgentAuthorizationError) {
        if (error.decision === "approval_required") {
          if (!error.approvalId) return this.failResult(input, context, targetedFiles, validation, "Approval was required but no approval ticket was returned.");
          const waiting = this.save({ ...received, stage: "waiting_approval", approvalId: error.approvalId, updatedAt: this.dependencies.now() });
          this.dependencies.events.publish({ type: "WorkCycleWaitingApproval", cycleId: input.cycleId, approvalId: toApprovalId(error.approvalId), occurredAt: waiting.updatedAt });
          return { cycle: waiting, context, targetedFiles, plan: input.plan, validation };
        }
        const denied = this.save({ ...received, stage: "denied", approvalId: error.approvalId, error: error.message, updatedAt: this.dependencies.now() });
        this.dependencies.events.publish({ type: "WorkCycleDenied", cycleId: input.cycleId, occurredAt: denied.updatedAt });
        return { cycle: denied, context, targetedFiles, plan: input.plan, validation };
      }
      const message = error instanceof Error ? error.message : String(error);
      return this.failResult(input, context, targetedFiles, validation, message);
    }
  }

  public cancel(cycleId: string): { cancelled: boolean; cycle?: WorkCycleSnapshot } {
    const current = this.snapshots.get(cycleId);
    if (!current || ["applied", "denied", "failed", "checkpointed"].includes(current.stage)) return { cancelled: false, cycle: current };
    const cancelled = this.save({ ...current, stage: "cancelled", updatedAt: this.dependencies.now(), error: "Cancelled by caller." });
    const runtimeCancelled = this.dependencies.runtime.cancel(cycleId);
    this.dependencies.events.publish({ type: "WorkCycleCancelled", cycleId, occurredAt: cancelled.updatedAt });
    return { cancelled: runtimeCancelled || current.stage === "received" || current.stage === "waiting_approval" || current.stage === "patch_ready" || current.stage === "planning", cycle: cancelled };
  }

  public inspect(cycleId: string): WorkCycleSnapshot | undefined {
    return this.snapshots.get(cycleId);
  }

  public list(): readonly WorkCycleSnapshot[] {
    return [...this.snapshots.values()];
  }

  private createCheckpoint(input: WorkCycleRequest, targetedFiles: readonly TargetedContextFile[]): Checkpoint {
    const checkpoint: Checkpoint = {
      checkpointId: this.dependencies.nextId("checkpoint"),
      cycleId: input.cycleId,
      rootPath: input.rootPath,
      createdAt: this.dependencies.now(),
      planDigest: digest({ goal: input.goal, constraints: input.constraints, plan: input.plan }),
      patchDigest: digest(input.patch),
      targetFiles: targetedFiles.map((file) => file.relativePath),
      sourceHashes: Object.fromEntries(targetedFiles.map((file) => [file.relativePath, file.sha256])),
    };
    this.dependencies.checkpoints.save(checkpoint);
    return checkpoint;
  }

  private failResult(
    input: WorkCycleRequest,
    context: ProjectContextSnapshot | undefined,
    targetedFiles: readonly TargetedContextFile[],
    validation: PatchValidation | undefined,
    error: string,
  ): WorkCycleResult {
    const current = this.snapshots.get(input.cycleId);
    const failed = this.save({
      ...(current ?? {
        cycleId: input.cycleId,
        sessionId: input.sessionId,
        rootPath: input.rootPath,
        stage: "received" as const,
        goal: input.goal,
        planDigest: digest({ goal: input.goal, constraints: input.constraints, plan: input.plan }),
        patchDigest: digest(input.patch),
      }),
      stage: "failed",
      error,
      updatedAt: this.dependencies.now(),
    });
    this.dependencies.events.publish({ type: "WorkCycleFailed", cycleId: input.cycleId, occurredAt: failed.updatedAt });
    return { cycle: failed, context, targetedFiles, plan: input.plan, validation };
  }

  private save(snapshot: WorkCycleSnapshot): WorkCycleSnapshot {
    this.snapshots.set(snapshot.cycleId, snapshot);
    while (this.snapshots.size > this.maxHistory) {
      const oldest = this.snapshots.keys().next().value as string | undefined;
      if (!oldest) break;
      this.snapshots.delete(oldest);
    }
    return snapshot;
  }
}
