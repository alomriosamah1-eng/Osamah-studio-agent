import type { AgentPlan, AgentPlanStep } from "./agent-work-cycle.js";
import type { ProjectContextSnapshot, TargetedContextFile } from "./project-context.js";

export interface PlannerRequest {
  readonly goal: string;
  readonly constraints: readonly string[];
  readonly context: ProjectContextSnapshot;
  readonly targetedFiles: readonly TargetedContextFile[];
}

export interface PlannerPort {
  plan(request: PlannerRequest): AgentPlan;
}

export interface PlanCritiqueRequest {
  readonly request: PlannerRequest;
  readonly plan: AgentPlan;
}

export type CritiqueSeverity = "blocking" | "warning";

export interface PlanCritiqueIssue {
  readonly code: "empty_goal" | "invalid_plan" | "unsafe_target" | "context_mismatch" | "context_truncated" | "too_many_steps";
  readonly severity: CritiqueSeverity;
  readonly message: string;
  readonly stepId?: string;
}

export interface PlanCritique {
  readonly accepted: boolean;
  readonly issues: readonly PlanCritiqueIssue[];
}

export interface CriticPort {
  critique(request: PlanCritiqueRequest): PlanCritique;
}

export interface PlannerCriticResult {
  readonly plan: AgentPlan;
  readonly critique: PlanCritique;
}

export interface PlannerCriticPort {
  review(request: PlannerRequest, proposedPlan?: AgentPlan): PlannerCriticResult;
}

const maximumSteps = 16;
const maximumText = 2_000;
const maximumConstraints = 32;
const maximumTargetedFiles = 24;

const cleanText = (value: string, field: string): string => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maximumText || trimmed.includes("\0") || trimmed.includes("\r") || trimmed.includes("\n")) {
    throw new Error(`${field} is invalid.`);
  }
  return trimmed;
};

const safeRelativePath = (value: string): boolean => {
  if (!value || value.startsWith("/") || value.includes("\\")) return false;
  const segments = value.split("/");
  return segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
};

const step = (id: string, title: string, description: string): AgentPlanStep => ({
  id,
  title: cleanText(title, "plan step title"),
  description: cleanText(description, "plan step description"),
});

export class DeterministicPlanner implements PlannerPort {
  public plan(request: PlannerRequest): AgentPlan {
    const goal = cleanText(request.goal, "goal");
    if (request.constraints.length > maximumConstraints) throw new Error("Planner constraints exceed bounded limits.");
    if (request.targetedFiles.length > maximumTargetedFiles) throw new Error("Planner targeted files exceed bounded limits.");
    const constraintSummary = request.constraints.map((constraint) => cleanText(constraint, "constraint")).join("; ");
    const targetSummary = request.targetedFiles.map((file) => cleanText(file.relativePath, "targeted path")).join(", ") || "no targeted files";
    const steps: AgentPlanStep[] = [
      step("context", "Review project context", `Review the bounded project snapshot for ${goal}.`),
      step("targets", "Inspect targeted files", `Inspect ${targetSummary} without executing project scripts.`),
      step("proposal", "Prepare a guarded proposal", `Prepare a reviewable proposal that respects: ${constraintSummary || "no additional constraints"}.`),
      step("verify", "Verify before mutation", "Re-read affected files, validate hashes, and wait for Human Gate approval before any write."),
    ];
    if (request.context.truncated || request.context.warnings.length > 0) {
      steps.splice(2, 0, step("uncertainty", "Resolve context uncertainty", "Review bounded-index warnings or missing context before relying on the proposal."));
    }
    return {
      summary: `Bounded plan for: ${goal}`,
      steps: steps.slice(0, maximumSteps),
    };
  }
}

export class BoundedPlanCritic implements CriticPort {
  public critique(input: PlanCritiqueRequest): PlanCritique {
    const issues: PlanCritiqueIssue[] = [];
    if (!input.request.goal.trim()) issues.push({ code: "empty_goal", severity: "blocking", message: "Planner request has no goal." });
    if (input.plan.steps.length === 0 || input.plan.steps.length > maximumSteps) {
      issues.push({ code: input.plan.steps.length > maximumSteps ? "too_many_steps" : "invalid_plan", severity: "blocking", message: "Plan step count is outside the bounded range." });
    }
    if (input.request.context.rootPath !== input.request.context.rootPath.trim() || !input.request.context.rootPath) {
      issues.push({ code: "context_mismatch", severity: "blocking", message: "Project context root is invalid." });
    }
    for (const file of input.request.targetedFiles) {
      if (!safeRelativePath(file.relativePath)) issues.push({ code: "unsafe_target", severity: "blocking", message: `Targeted path is not a safe relative path: ${file.relativePath}.` });
      if (file.bytes !== Buffer.byteLength(file.content, "utf8")) issues.push({ code: "context_mismatch", severity: "blocking", message: `Targeted file byte count mismatches content: ${file.relativePath}.` });
    }
    const stepIds = new Set<string>();
    for (const planStep of input.plan.steps) {
      try {
        cleanText(planStep.id, "plan step id");
        cleanText(planStep.title, "plan step title");
        cleanText(planStep.description, "plan step description");
      } catch {
        issues.push({ code: "invalid_plan", severity: "blocking", message: "Plan contains malformed step text.", stepId: planStep.id });
      }
      if (stepIds.has(planStep.id)) issues.push({ code: "invalid_plan", severity: "blocking", message: `Plan step id is duplicated: ${planStep.id}.`, stepId: planStep.id });
      stepIds.add(planStep.id);
    }
    if (input.request.context.truncated || input.request.context.warnings.length > 0) {
      issues.push({ code: "context_truncated", severity: "warning", message: "Plan depends on bounded or warning-bearing project context and requires explicit review." });
    }
    return { accepted: !issues.some((issue) => issue.severity === "blocking"), issues };
  }
}

export class DeterministicPlannerCritic implements PlannerCriticPort {
  public constructor(
    private readonly planner: PlannerPort = new DeterministicPlanner(),
    private readonly critic: CriticPort = new BoundedPlanCritic(),
  ) {}

  public review(request: PlannerRequest, proposedPlan?: AgentPlan): PlannerCriticResult {
    const plan = proposedPlan ?? this.planner.plan(request);
    return { plan, critique: this.critic.critique({ request, plan }) };
  }
}

export const assertPlanAccepted = (critique: PlanCritique): void => {
  if (!critique.accepted) {
    const reasons = critique.issues.filter((issue) => issue.severity === "blocking").map((issue) => issue.message).join(" ");
    throw new Error(`Planner critique rejected the plan. ${reasons}`.trim());
  }
};
