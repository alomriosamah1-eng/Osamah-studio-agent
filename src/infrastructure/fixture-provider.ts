import type {
  ProviderAdapter,
  ProviderHealth,
  ProviderInvocationRequest,
  ProviderInvocationResponse,
  ProviderManifest,
} from "../application/provider-contracts.js";
import { ProviderGatewayError } from "../application/provider-contracts.js";

export interface FixtureProviderOptions {
  readonly manifest: ProviderManifest;
  readonly health?: ProviderHealth;
  readonly responseText?: string;
  readonly failure?: ProviderGatewayError;
  readonly malformedResponse?: Partial<ProviderInvocationResponse>;
}

export class FixtureProviderAdapter implements ProviderAdapter {
  public readonly requests: ProviderInvocationRequest[] = [];
  public readonly manifest: ProviderManifest;

  public constructor(private readonly options: FixtureProviderOptions) {
    this.manifest = options.manifest;
  }

  public async health(_signal?: AbortSignal): Promise<ProviderHealth> {
    return this.options.health ?? { status: "healthy", checkedAt: "2026-08-22T00:00:00.000Z" };
  }

  public async invoke(request: ProviderInvocationRequest, _signal?: AbortSignal): Promise<ProviderInvocationResponse> {
    this.requests.push(request);
    if (this.options.failure) throw this.options.failure;
    const modelId = request.modelId ?? this.manifest.models[0]?.id;
    if (!modelId) throw new ProviderGatewayError("INVALID_REQUEST", this.manifest.id, false, "Fixture provider has no model.");
    return {
      requestId: request.requestId,
      providerId: this.manifest.id,
      modelId,
      text: this.options.responseText ?? `Fixture response from ${this.manifest.id}.`,
      ...this.options.malformedResponse,
    };
  }
}
