import type { ProviderAdapter } from "../application/provider-contracts.js";
import type { LocalProviderConfig, ProviderDoctorPort, ProviderDoctorReport } from "../application/provider-policy.js";

export class LocalProviderDoctor implements ProviderDoctorPort {
  private readonly adapters: ReadonlyMap<string, ProviderAdapter>;
  private readonly now: () => number;

  public constructor(adapters: readonly ProviderAdapter[], now: () => number = () => Date.now()) {
    this.adapters = new Map(adapters.map((adapter) => [adapter.manifest.id, adapter]));
    this.now = now;
  }

  public async check(config: LocalProviderConfig, signal?: AbortSignal): Promise<ProviderDoctorReport> {
    const checkedAt = new Date(this.now()).toISOString();
    if (!config.enabled) return { providerId: config.providerId, modelId: config.modelId, status: "disabled", checkedAt, reason: "Provider is disabled by configuration." };
    const adapter = this.adapters.get(config.providerId);
    if (!adapter) return { providerId: config.providerId, modelId: config.modelId, status: "blocked", checkedAt, reason: "No matching provider adapter is registered." };
    const startedAt = this.now();
    const health = await adapter.health(signal);
    return {
      providerId: config.providerId,
      modelId: config.modelId,
      status: health.status,
      checkedAt: health.checkedAt,
      latencyMs: Math.max(0, this.now() - startedAt),
      reason: health.reason,
    };
  }
}
