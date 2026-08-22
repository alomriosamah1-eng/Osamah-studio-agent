import type { AgentPlan, AgentPlanStep } from "./agent-work-cycle.js";
import type { ProjectContextSnapshot, TargetedContextFile } from "./project-context.js";
import type { ProviderGateway } from "./provider-gateway.js";
import { sanitizeAuditText } from "./agent-contracts.js";

export interface PlannerRequest {
  readonly goal: string;
  readonly constraints: readonly string[];
  readonly context: ProjectContextSnapshot;
  readonly targetedFiles: readonly TargetedContextFile[];
  readonly requestId?: string;
  readonly sessionId?: string;
  readonly providerId?: string;
  readonly modelId?: string;
  readonly offlineMode?: boolean;
}

export interface PlannerPort {
  plan(request: PlannerRequest): AgentPlan;
}

export interface AsyncPlannerPort {
  plan(request: PlannerRequest): Promise<AgentPlan>;
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
  review(request: PlannerRequest, proposedPlan?: AgentPlan): PlannerCriticResult | Promise<PlannerCriticResult>;
}

export interface LlmPlannerOptions {
  readonly providerGateway: Pick<ProviderGateway, "invoke">;
  readonly nextRequestId: () => string;
  readonly maxPromptChars?: number;
  readonly maxOutputChars?: number;
}

export class LlmPlannerError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "LlmPlannerError";
  }
}

const maximumSteps = 16;
const maximumText = 2_000;
const maximumConstraints = 32;
const maximumTargetedFiles = 24;
const defaultPlannerPromptLimit = 96 * 1024;
const defaultPlannerOutputLimit = 64 * 1024;

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

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

const buildPlannerPrompt = (request: PlannerRequest, maxPromptChars: number): string => {
  const goal = cleanText(request.goal, "goal");
  if (request.constraints.length > maximumConstraints) throw new LlmPlannerError("Planner constraints exceed bounded limits.");
  if (request.targetedFiles.length > maximumTargetedFiles) throw new LlmPlannerError("Planner targeted files exceed bounded limits.");
  const envelope = {
    goal,
    constraints: request.constraints.map((constraint) => cleanText(constraint, "constraint")),
    context: {
      rootPath: request.context.rootPath,
      files: request.context.files.slice(0, 48),
      manifests: request.context.manifests.slice(0, 16),
      git: request.context.git,
      truncated: request.context.truncated,
      warnings: request.context.warnings.slice(0, 16),
    },
    targetedFiles: request.targetedFiles.map((file) => ({
      relativePath: cleanText(file.relativePath, "targeted path"),
      sha256: file.sha256,
      content: file.content.slice(0, 4_096),
    })),
  };
  const prompt = sanitizeAuditText([
    "You are a local planning component. Return JSON only, with exactly this shape:",
    '{"summary":"short bounded summary","steps":[{"id":"step-id","title":"short title","description":"short description"}]}',
    "Do not return Markdown fences, commentary, tool calls, code execution, or filesystem mutations.",
    JSON.stringify(envelope),
  ].join("\n"), maxPromptChars);
  if (prompt.length > maxPromptChars) throw new LlmPlannerError("Planner prompt exceeds bounded limits.");
  return prompt;
};

const parseLlmPlan = (text: string, maxOutputChars: number): AgentPlan => {
  if (!text || text.length > maxOutputChars || text.trim().startsWith("```") || text.trim().endsWith("```")) {
    throw new LlmPlannerError("Planner provider output is outside the bounded JSON contract.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new LlmPlannerError("Planner provider output is not valid JSON.");
  }
  if (!isRecord(parsed) || Object.keys(parsed).some((key) => key !== "summary" && key !== "steps") || typeof parsed.summary !== "string" || !Array.isArray(parsed.steps) || parsed.steps.length === 0 || parsed.steps.length > maximumSteps) {
    throw new LlmPlannerError("Planner provider output has an invalid plan shape.");
  }
  const summary = cleanText(parsed.summary, "plan summary");
  const steps = parsed.steps.map((candidate) => {
    if (!isRecord(candidate) || Object.keys(candidate).some((key) => key !== "id" && key !== "title" && key !== "description") || typeof candidate.id !== "string" || typeof candidate.title !== "string" || typeof candidate.description !== "string") {
      throw new LlmPlannerError("Planner provider output contains an invalid step.");
    }
    return step(candidate.id, candidate.title, candidate.description);
  });
  return { summary, steps };
};

export class LlmPlanner implements AsyncPlannerPort {
  public constructor(private readonly options: LlmPlannerOptions) {}

  public async plan(request: PlannerRequest): Promise<AgentPlan> {
    const invocation = await this.options.providerGateway.invoke({
      requestId: request.requestId ?? this.options.nextRequestId(),
      sessionId: request.sessionId ?? "planner-session",
      providerId: request.providerId,
      modelId: request.modelId,
      capability: "structured_output",
      input: buildPlannerPrompt(request, this.options.maxPromptChars ?? defaultPlannerPromptLimit),
      privacy: "local_only",
      offlineMode: request.offlineMode ?? true,
      sideEffect: "none",
    });
    return parseLlmPlan(invocation.response.text, this.options.maxOutputChars ?? defaultPlannerOutputLimit);
  }
}

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

export class ProviderBackedPlannerCritic implements PlannerCriticPort {
  public constructor(
    private readonly planner: AsyncPlannerPort,
    private readonly critic: CriticPort = new BoundedPlanCritic(),
  ) {}

  public async review(request: PlannerRequest, proposedPlan?: AgentPlan): Promise<PlannerCriticResult> {
    const plan = proposedPlan ?? await this.planner.plan(request);
    return { plan, critique: this.critic.critique({ request, plan }) };
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
