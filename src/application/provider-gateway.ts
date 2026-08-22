import type {
  ProviderAdapter,
  ProviderCapability,
  ProviderErrorCode,
  ProviderHealth,
  ProviderInvocationRequest,
  ProviderInvocationResult,
  ProviderModelManifest,
  ProviderRouteAudit,
  ProviderRouteDecision,
} from "./provider-contracts.js";
import type { ProviderExecutionPolicy } from "./provider-policy.js";
import { ProviderGatewayError } from "./provider-contracts.js";

export interface ProviderGatewayOptions {
  readonly maxProviders?: number;
  readonly maxFallbacks?: number;
  readonly audit?: ProviderRouteAudit;
  readonly executionPolicy?: ProviderExecutionPolicy;
  readonly now?: () => string;
}

interface Candidate {
  readonly adapter: ProviderAdapter;
  readonly model: ProviderModelManifest;
}

const isLocalAllowed = (request: ProviderInvocationRequest, adapter: ProviderAdapter): boolean => {
  if (request.privacy === "local_only" && adapter.manifest.privacy !== "local") return false;
  if (request.offlineMode && !adapter.manifest.offline) return false;
  return true;
};

const supportsCapability = (adapter: ProviderAdapter, model: ProviderModelManifest, capability: ProviderCapability): boolean =>
  adapter.manifest.capabilities.includes(capability) && model.capabilities.includes(capability);

const selectModel = (adapter: ProviderAdapter, request: ProviderInvocationRequest): ProviderModelManifest | undefined => {
  const models = adapter.manifest.models.filter((model) => supportsCapability(adapter, model, request.capability));
  if (request.modelId) return models.find((model) => model.id === request.modelId);
  return [...models].sort((left, right) => left.estimatedLatencyMs - right.estimatedLatencyMs)[0];
};

const errorCode = (error: unknown): ProviderErrorCode => {
  if (error instanceof ProviderGatewayError) return error.code;
  if (error instanceof Error && (error.name === "AbortError" || /timeout/i.test(error.message))) return "TIMEOUT";
  return "UNAVAILABLE";
};

const errorRetryable = (error: unknown): boolean => {
  if (error instanceof ProviderGatewayError) return error.retryable;
  return true;
};

const errorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

export class ProviderGateway {
  private readonly adapters: ProviderAdapter[] = [];
  private readonly maxProviders: number;
  private readonly maxFallbacks: number;
  private readonly audit: ProviderRouteAudit | undefined;
  private readonly executionPolicy: ProviderExecutionPolicy | undefined;
  private readonly now: () => string;

  public constructor(adapters: readonly ProviderAdapter[] = [], options: ProviderGatewayOptions = {}) {
    this.maxProviders = Math.max(1, Math.min(Math.floor(options.maxProviders ?? 16), 16));
    this.maxFallbacks = Math.max(0, Math.min(Math.floor(options.maxFallbacks ?? 2), this.maxProviders - 1));
    this.audit = options.audit;
    this.executionPolicy = options.executionPolicy;
    this.now = options.now ?? (() => new Date().toISOString());
    for (const adapter of adapters) this.register(adapter);
  }

  public register(adapter: ProviderAdapter): void {
    if (this.adapters.some((candidate) => candidate.manifest.id === adapter.manifest.id)) {
      throw new ProviderGatewayError("INVALID_REQUEST", adapter.manifest.id, false, `Provider ${adapter.manifest.id} is already registered.`);
    }
    if (this.adapters.length >= this.maxProviders) {
      throw new ProviderGatewayError("INVALID_REQUEST", adapter.manifest.id, false, "Provider registry limit reached.");
    }
    this.adapters.push(adapter);
  }

  public listProviders(): readonly ProviderAdapter["manifest"][] {
    return this.adapters.map((adapter) => adapter.manifest);
  }

  public async health(providerId: string, signal?: AbortSignal): Promise<ProviderHealth> {
    const adapter = this.adapters.find((candidate) => candidate.manifest.id === providerId);
    if (!adapter) throw new ProviderGatewayError("NO_PROVIDER", undefined, false, `Provider ${providerId} was not found.`);
    try {
      return await adapter.health(signal);
    } catch (error) {
      return { status: "unavailable", checkedAt: this.now(), reason: errorMessage(error) };
    }
  }

  public async invoke(request: ProviderInvocationRequest, signal?: AbortSignal): Promise<ProviderInvocationResult> {
    this.validateRequest(request);
    const candidates = this.candidates(request);
    if (candidates.length === 0) throw new ProviderGatewayError("NO_PROVIDER", undefined, false, "No provider satisfies capability, privacy, model, or offline policy.");

    let lastError: ProviderGatewayError | undefined;
    let attempts = 0;
    for (const candidate of candidates) {
      if (attempts > this.maxFallbacks) break;
      const providerId = candidate.adapter.manifest.id;
      const admission = this.executionPolicy?.acquire(providerId);
      if (admission && !admission.allowed) {
        const code = admission.reason === "disabled" ? "UNAVAILABLE" : "RATE_LIMITED";
        lastError = new ProviderGatewayError(code, providerId, admission.reason !== "disabled", `Provider ${providerId} was not admitted: ${admission.reason}.`);
        attempts += 1;
        continue;
      }
      try {
        const health = await this.health(providerId, signal);
        if (health.status === "unavailable") {
          this.executionPolicy?.recordFailure(providerId);
          lastError = new ProviderGatewayError("UNAVAILABLE", providerId, true, health.reason ?? `Provider ${providerId} is unavailable.`);
          attempts += 1;
          continue;
        }
        const response = await candidate.adapter.invoke(request, signal);
        this.validateResponse(response, request, candidate);
        this.executionPolicy?.recordSuccess(providerId);
        const route: ProviderRouteDecision = {
          providerId: candidate.adapter.manifest.id,
          modelId: candidate.model.id,
          reason: `${candidate.adapter.manifest.privacy}-first capability match; fallback_count=${attempts}`,
          fallbackCount: attempts,
          privacy: candidate.adapter.manifest.privacy,
          offline: candidate.adapter.manifest.offline,
        };
        this.audit?.record({
          requestId: request.requestId,
          sessionId: request.sessionId,
          occurredAt: this.now(),
          providerId: route.providerId,
          modelId: route.modelId,
          fallbackCount: route.fallbackCount,
          reason: route.reason,
        });
        return { response, route };
      } catch (error) {
        const code = errorCode(error);
        const retryable = errorRetryable(error);
        if (retryable) this.executionPolicy?.recordFailure(providerId);
        lastError = error instanceof ProviderGatewayError
          ? error
          : new ProviderGatewayError(code, candidate.adapter.manifest.id, retryable, errorMessage(error));
        if (!retryable || (request.sideEffect === "mutation" && !request.idempotencyKey)) throw lastError;
        attempts += 1;
      } finally {
        this.executionPolicy?.release(providerId);
      }
    }
    if (request.sideEffect === "mutation" && !request.idempotencyKey && lastError?.retryable) {
      throw new ProviderGatewayError("INVALID_REQUEST", lastError.providerId, false, "Mutation fallback requires an idempotency key.");
    }
    throw lastError ?? new ProviderGatewayError("NO_PROVIDER", undefined, false, "No provider could serve the request.");
  }

  private candidates(request: ProviderInvocationRequest): readonly Candidate[] {
    return this.adapters
      .filter((adapter) => isLocalAllowed(request, adapter))
      .map((adapter) => ({ adapter, model: selectModel(adapter, request) }))
      .filter((candidate): candidate is Candidate => candidate.model !== undefined)
      .filter(({ model }) => !request.offlineMode || model.offline)
      .sort((left, right) => {
        const privacyScore = (candidate: Candidate): number => candidate.adapter.manifest.privacy === "local" ? 0 : 1;
        return privacyScore(left) - privacyScore(right) || left.model.estimatedLatencyMs - right.model.estimatedLatencyMs;
      });
  }

  private validateRequest(request: ProviderInvocationRequest): void {
    if (!request.requestId.trim() || !request.sessionId.trim() || !request.input.trim()) {
      throw new ProviderGatewayError("INVALID_REQUEST", undefined, false, "Provider requestId, sessionId, and input are required.");
    }
    if (request.sideEffect === "mutation" && !request.idempotencyKey) {
      throw new ProviderGatewayError("INVALID_REQUEST", undefined, false, "Mutation requests require an idempotency key before dispatch.");
    }
  }

  private validateResponse(
    response: Awaited<ReturnType<ProviderAdapter["invoke"]>>,
    request: ProviderInvocationRequest,
    candidate: Candidate,
  ): void {
    if (
      response.requestId !== request.requestId ||
      response.providerId !== candidate.adapter.manifest.id ||
      response.modelId !== candidate.model.id ||
      !response.text.trim()
    ) {
      throw new ProviderGatewayError("MALFORMED_OUTPUT", candidate.adapter.manifest.id, true, "Provider response did not satisfy the typed output contract.");
    }
  }
}
