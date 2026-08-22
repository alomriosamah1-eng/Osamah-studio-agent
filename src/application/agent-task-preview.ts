import type { AgentPlan } from "./agent-work-cycle.js";
import type { ProjectContextSnapshot, TargetedContextFile } from "./project-context.js";
import type { ContextIndexPort } from "./agent-work-cycle.js";
import type { PlannerCriticPort, PlanCritique } from "./planner-critic.js";

export interface AgentTaskPreviewRequest {
  readonly rootPath: string;
  readonly goal: string;
  readonly constraints: readonly string[];
  readonly targetedPaths: readonly string[];
  readonly providerId?: string;
  readonly modelId?: string;
  readonly offlineMode?: boolean;
}

export interface AgentTaskPreviewResult {
  readonly context: ProjectContextSnapshot;
  readonly targetedFiles: readonly TargetedContextFile[];
  readonly plan: AgentPlan;
  readonly critique: PlanCritique;
  readonly safeToProceed: boolean;
  readonly warnings: readonly string[];
}

export class AgentTaskPreviewError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AgentTaskPreviewError";
  }
}

const boundedText = (value: string, field: string, maxLength: number): string => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength || trimmed.includes("\0") || trimmed.includes("\r") || trimmed.includes("\n")) {
    throw new AgentTaskPreviewError(`${field} is invalid.`);
  }
  return trimmed;
};

const boundedRelativePath = (value: string): string => {
  const path = boundedText(value, "targetedPath", 512);
  if (path.startsWith("/") || path.includes("\\") || path.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    throw new AgentTaskPreviewError("targetedPath must be a safe relative path.");
  }
  return path;
};

const validateRequest = (request: AgentTaskPreviewRequest): void => {
  boundedText(request.rootPath, "rootPath", 4_096);
  boundedText(request.goal, "goal", 2_000);
  if (request.constraints.length > 32 || request.targetedPaths.length > 24) throw new AgentTaskPreviewError("Task preview request exceeds bounded limits.");
  request.constraints.forEach((constraint) => boundedText(constraint, "constraint", 2_000));
  request.targetedPaths.forEach(boundedRelativePath);
  if (request.providerId !== undefined) boundedText(request.providerId, "providerId", 256);
  if (request.modelId !== undefined) boundedText(request.modelId, "modelId", 256);
  if (request.offlineMode !== undefined && typeof request.offlineMode !== "boolean") throw new AgentTaskPreviewError("offlineMode is invalid.");
};

export class AgentTaskPreviewService {
  public constructor(
    private readonly context: Pick<ContextIndexPort, "build" | "readTargeted">,
    private readonly deterministicPlannerCritic: Pick<PlannerCriticPort, "review">,
    private readonly providerBackedPlannerCritic?: Pick<PlannerCriticPort, "review">,
  ) {}

  public async preview(request: AgentTaskPreviewRequest): Promise<AgentTaskPreviewResult> {
    validateRequest(request);
    const context = await this.context.build(request.rootPath);
    const targetedFiles = await this.context.readTargeted(request.rootPath, request.targetedPaths);
    const plannerCritic = request.providerId || request.modelId
      ? this.providerBackedPlannerCritic
      : this.deterministicPlannerCritic;
    if (!plannerCritic) throw new AgentTaskPreviewError("Explicit provider selection is unavailable for task preview.");
    const review = await plannerCritic.review({
      goal: request.goal,
      constraints: request.constraints,
      context,
      targetedFiles,
      requestId: "task-preview",
      sessionId: "task-preview",
      providerId: request.providerId,
      modelId: request.modelId,
      offlineMode: request.offlineMode ?? true,
    });
    const warnings = [
      ...context.warnings,
      ...(context.truncated ? ["Project context is truncated by resource policy."] : []),
      ...review.critique.issues.filter((issue) => issue.severity === "warning").map((issue) => issue.message),
    ].slice(0, 32);
    return {
      context,
      targetedFiles,
      plan: review.plan,
      critique: review.critique,
      safeToProceed: review.critique.accepted,
      warnings,
    };
  }
}

export const taskPreviewContract = {
  mutatesFilesystem: false,
  executesCommands: false,
  requiresHumanGateForMutation: true,
} as const;
