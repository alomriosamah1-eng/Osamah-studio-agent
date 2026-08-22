export type ProviderCapability = "text" | "tool_calling" | "structured_output" | "streaming" | "embeddings" | "vision";

export type ProviderPrivacy = "local" | "remote";

export interface ProviderModelManifest {
  readonly id: string;
  readonly capabilities: readonly ProviderCapability[];
  readonly contextWindow: number;
  readonly streaming: boolean;
  readonly offline: boolean;
  readonly estimatedLatencyMs: number;
  readonly inputCostPerMillionTokens?: number;
  readonly outputCostPerMillionTokens?: number;
}

export interface ProviderManifest {
  readonly id: string;
  readonly label: string;
  readonly transport: "local" | "http" | "fixture";
  readonly privacy: ProviderPrivacy;
  readonly offline: boolean;
  readonly capabilities: readonly ProviderCapability[];
  readonly models: readonly ProviderModelManifest[];
}

export type ProviderHealthStatus = "healthy" | "degraded" | "unavailable";

export interface ProviderHealth {
  readonly status: ProviderHealthStatus;
  readonly checkedAt: string;
  readonly reason?: string;
}

export interface ProviderInvocationRequest {
  readonly requestId: string;
  readonly sessionId: string;
  readonly providerId?: string;
  readonly capability: ProviderCapability;
  readonly input: string;
  readonly privacy: "local_only" | "workspace" | "remote_allowed";
  readonly offlineMode?: boolean;
  readonly sideEffect: "none" | "mutation";
  readonly idempotencyKey?: string;
  readonly modelId?: string;
}

export interface ProviderInvocationResponse {
  readonly requestId: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly text: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly finishReason?: "stop" | "length" | "tool_call";
}

export interface ProviderAdapter {
  readonly manifest: ProviderManifest;
  health(signal?: AbortSignal): Promise<ProviderHealth>;
  invoke(request: ProviderInvocationRequest, signal?: AbortSignal): Promise<ProviderInvocationResponse>;
}

export interface ProviderRouteAuditRecord {
  readonly requestId: string;
  readonly sessionId: string;
  readonly occurredAt: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly fallbackCount: number;
  readonly reason: string;
}

export interface ProviderRouteAudit {
  record(route: ProviderRouteAuditRecord): void;
  list(limit?: number): readonly ProviderRouteAuditRecord[];
}

export interface ProviderRouteDecision {
  readonly providerId: string;
  readonly modelId: string;
  readonly reason: string;
  readonly fallbackCount: number;
  readonly privacy: ProviderPrivacy;
  readonly offline: boolean;
}

export interface ProviderInvocationResult {
  readonly response: ProviderInvocationResponse;
  readonly route: ProviderRouteDecision;
}

export type ProviderErrorCode = "NO_PROVIDER" | "AUTH" | "BILLING" | "INVALID_REQUEST" | "RATE_LIMITED" | "TIMEOUT" | "UNAVAILABLE" | "MALFORMED_OUTPUT";

export class ProviderGatewayError extends Error {
  public constructor(
    public readonly code: ProviderErrorCode,
    public readonly providerId: string | undefined,
    public readonly retryable: boolean,
    message: string,
  ) {
    super(message);
    this.name = "ProviderGatewayError";
  }
}
