import type { ArtifactAssemblyPort, ArtifactDraft } from "./artifact-assembly.js";

export type RenderFormat = "markdown" | "html" | "pptx" | "pdf" | "image" | "video";
export type RenderDecision = "blocked" | "review_required" | "allowed_preview";
export type RenderAdapter = "markdown" | "html" | "slides" | "document" | "media" | "none";

export interface RenderBudget {
  readonly timeoutMs: number;
  readonly maxMemoryMb: number;
  readonly maxOutputBytes: number;
  readonly maxPages: number;
}

export interface RenderPolicyRequest {
  readonly artifactId: string;
  readonly format: RenderFormat;
  readonly relativeDestination?: string;
  readonly budget?: Partial<RenderBudget>;
}

export interface RenderPolicyPreview {
  readonly artifactId: string;
  readonly format: RenderFormat;
  readonly decision: RenderDecision;
  readonly adapter: RenderAdapter;
  readonly budget: RenderBudget;
  readonly warnings: readonly string[];
  readonly checks: readonly string[];
  readonly executionStarted: false;
}

export interface RenderPolicyPort {
  preview(request: RenderPolicyRequest): RenderPolicyPreview;
}

export interface RenderPolicyOptions {
  readonly nextBudget?: Partial<RenderBudget>;
  readonly maxWarnings?: number;
}

export class RenderPolicyError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "RenderPolicyError";
  }
}

const defaultBudget: RenderBudget = { timeoutMs: 30_000, maxMemoryMb: 512, maxOutputBytes: 64 * 1024 * 1024, maxPages: 100 };
const maxBudget: RenderBudget = { timeoutMs: 30_000, maxMemoryMb: 512, maxOutputBytes: 64 * 1024 * 1024, maxPages: 100 };
const maxIdLength = 256;
const maxDestinationLength = 512;

const cleanText = (value: string, field: string, maxLength: number): string => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength || /[\u0000\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(trimmed)) throw new RenderPolicyError(`${field} is invalid.`);
  return trimmed;
};
const isFormat = (value: RenderFormat): boolean => value === "markdown" || value === "html" || value === "pptx" || value === "pdf" || value === "image" || value === "video";
const cleanBudgetValue = (value: number | undefined, field: keyof RenderBudget, upperBound: number): number | undefined => {
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value) || value < 1 || value > upperBound) throw new RenderPolicyError(`${field} is outside the low-memory bound.`);
  return value;
};
const cleanDestination = (value: string | undefined): string | undefined => {
  if (value === undefined) return undefined;
  const destination = cleanText(value, "relativeDestination", maxDestinationLength);
  if (destination.startsWith("/") || destination.startsWith("~") || destination.includes("\\") || destination.includes("..") || destination.includes(":")) throw new RenderPolicyError("relativeDestination is unsafe.");
  return destination;
};
const adapterFor = (format: RenderFormat): RenderAdapter => format === "markdown" ? "markdown" : format === "html" ? "html" : format === "pptx" ? "slides" : format === "pdf" ? "document" : format === "image" || format === "video" ? "media" : "none";
const supports = (kind: ArtifactDraft["kind"], format: RenderFormat): boolean => {
  if (kind === "presentation") return format === "pptx" || format === "html" || format === "pdf" || format === "image";
  if (kind === "media_bundle") return format === "image" || format === "video";
  if (kind === "markdown") return format === "markdown" || format === "html" || format === "pdf";
  return format === "markdown" || format === "html" || format === "pdf";
};

export class InMemoryRenderPolicy implements RenderPolicyPort {
  private readonly artifacts: Pick<ArtifactAssemblyPort, "getDraft">;
  private readonly defaults: RenderBudget;
  private readonly maxWarningsPerPreview: number;

  public constructor(artifacts: Pick<ArtifactAssemblyPort, "getDraft">, options: RenderPolicyOptions = {}) {
    this.artifacts = artifacts;
    this.defaults = {
      timeoutMs: options.nextBudget?.timeoutMs ?? defaultBudget.timeoutMs,
      maxMemoryMb: options.nextBudget?.maxMemoryMb ?? defaultBudget.maxMemoryMb,
      maxOutputBytes: options.nextBudget?.maxOutputBytes ?? defaultBudget.maxOutputBytes,
      maxPages: options.nextBudget?.maxPages ?? defaultBudget.maxPages,
    };
    this.maxWarningsPerPreview = options.maxWarnings ?? 32;
  }

  public preview(request: RenderPolicyRequest): RenderPolicyPreview {
    const artifactId = cleanText(request.artifactId, "artifactId", maxIdLength);
    if (!isFormat(request.format)) throw new RenderPolicyError("format is invalid.");
    const relativeDestination = cleanDestination(request.relativeDestination);
    const budget: RenderBudget = {
      timeoutMs: cleanBudgetValue(request.budget?.timeoutMs ?? this.defaults.timeoutMs, "timeoutMs", maxBudget.timeoutMs)!,
      maxMemoryMb: cleanBudgetValue(request.budget?.maxMemoryMb ?? this.defaults.maxMemoryMb, "maxMemoryMb", maxBudget.maxMemoryMb)!,
      maxOutputBytes: cleanBudgetValue(request.budget?.maxOutputBytes ?? this.defaults.maxOutputBytes, "maxOutputBytes", maxBudget.maxOutputBytes)!,
      maxPages: cleanBudgetValue(request.budget?.maxPages ?? this.defaults.maxPages, "maxPages", maxBudget.maxPages)!,
    };
    const draft = this.artifacts.getDraft(artifactId);
    const warnings = new Set<string>(draft?.warnings ?? []);
    const checks = new Set<string>();
    checks.add("execution_not_started");
    checks.add("tools_not_invoked");
    if (!draft) {
      checks.add("artifact_manifest_missing");
      return this.result(artifactId, request.format, "blocked", "none", budget, warnings, checks);
    }
    checks.add("artifact_manifest_present");
    if (!supports(draft.kind, request.format)) {
      checks.add("format_incompatible");
      warnings.add(`format_not_supported_for_${draft.kind}`);
      return this.result(artifactId, request.format, "blocked", "none", budget, warnings, checks);
    }
    checks.add("format_supported");
    if (relativeDestination === undefined) checks.add("destination_not_requested");
    else checks.add("relative_destination_safe");
    checks.add("budget_bounded");
    if (draft.reviewState === "blocked") {
      checks.add("artifact_review_blocked");
      return this.result(artifactId, request.format, "blocked", "none", budget, warnings, checks);
    }
    if (draft.reviewState === "needs_review") {
      checks.add("artifact_review_required");
      return this.result(artifactId, request.format, "review_required", adapterFor(request.format), budget, warnings, checks);
    }
    checks.add("artifact_review_ready");
    return this.result(artifactId, request.format, "allowed_preview", adapterFor(request.format), budget, warnings, checks);
  }

  private result(artifactId: string, format: RenderFormat, decision: RenderDecision, adapter: RenderAdapter, budget: RenderBudget, warnings: Set<string>, checks: Set<string>): RenderPolicyPreview {
    return { artifactId, format, decision, adapter, budget, warnings: [...warnings].slice(0, this.maxWarningsPerPreview), checks: [...checks], executionStarted: false };
  }
}
