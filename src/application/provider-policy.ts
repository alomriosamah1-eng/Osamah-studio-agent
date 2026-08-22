import type { ProviderHealthStatus } from "./provider-contracts.js";

export type LocalProviderId = "ollama" | "llama.cpp";

export interface LocalProviderConfig {
  readonly providerId: LocalProviderId;
  readonly enabled: boolean;
  readonly baseUrl: string;
  readonly modelId: string;
  readonly timeoutMs: number;
  readonly maxInputChars: number;
  readonly maxOutputChars: number;
  readonly maxConcurrent: number;
  readonly maxRequestsPerWindow: number;
  readonly quotaWindowMs: number;
  readonly circuitFailureThreshold: number;
  readonly circuitCooldownMs: number;
}

export interface ProviderConfigurationPort {
  validate(config: LocalProviderConfig): LocalProviderConfig;
}

export interface ProviderDoctorReport {
  readonly providerId: LocalProviderId;
  readonly modelId: string;
  readonly status: ProviderHealthStatus | "disabled" | "blocked";
  readonly checkedAt: string;
  readonly latencyMs?: number;
  readonly reason?: string;
}

export interface ProviderDoctorPort {
  check(config: LocalProviderConfig, signal?: AbortSignal): Promise<ProviderDoctorReport>;
}

export type ProviderAdmissionReason = "admitted" | "disabled" | "circuit_open" | "concurrency_limit" | "rate_limit";

export interface ProviderAdmission {
  readonly allowed: boolean;
  readonly reason: ProviderAdmissionReason;
  readonly remaining: number;
  readonly retryAfterMs?: number;
}

export interface ProviderQuotaPort {
  acquire(providerId: string, nowMs?: number): ProviderAdmission;
  release(providerId: string): void;
  snapshot(providerId: string): ProviderQuotaSnapshot;
}

export interface ProviderQuotaSnapshot {
  readonly providerId: string;
  readonly inFlight: number;
  readonly requestsInWindow: number;
  readonly windowStartedAt: number;
  readonly circuitState: "closed" | "open" | "half_open";
  readonly consecutiveFailures: number;
  readonly openedAt?: number;
}

export interface ProviderCircuitPort {
  allow(providerId: string, nowMs?: number): ProviderAdmission;
  recordSuccess(providerId: string, nowMs?: number): void;
  recordFailure(providerId: string, nowMs?: number): void;
  snapshot(providerId: string): ProviderQuotaSnapshot;
}

export interface ProviderExecutionPolicy extends ProviderQuotaPort, ProviderCircuitPort {}

export interface ProviderPolicyOptions {
  readonly now?: () => number;
  readonly maxConfigurations?: number;
}

const maxConfigurations = 8;
const maxModelIdLength = 256;
const maxTimeoutMs = 120_000;
const maxInputChars = 128 * 1024;
const maxOutputChars = 256 * 1024;
const maxQuotaWindowMs = 60 * 60 * 1000;
const maxFailureThreshold = 8;
const maxCircuitCooldownMs = 10 * 60 * 1000;

const isLoopbackHostname = (hostname: string): boolean => {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "[::1]" || normalized === "::1";
};

export const validateLocalProviderConfig = (input: LocalProviderConfig): LocalProviderConfig => {
  if (input.providerId !== "ollama" && input.providerId !== "llama.cpp") throw new Error("Unsupported local provider ID.");
  let url: URL;
  try {
    url = new URL(input.baseUrl);
  } catch {
    throw new Error("Local provider baseUrl is invalid.");
  }
  if (url.protocol !== "http:" || !isLoopbackHostname(url.hostname) || url.username || url.password || url.search || url.hash) {
    throw new Error("Local provider baseUrl must be an http loopback URL without credentials or query parameters.");
  }
  if (!input.modelId.trim() || input.modelId.length > maxModelIdLength || /[\0\r\n]/.test(input.modelId)) throw new Error("Local provider modelId is invalid.");
  if (!Number.isInteger(input.timeoutMs) || input.timeoutMs <= 0 || input.timeoutMs > maxTimeoutMs) throw new Error("Local provider timeoutMs is outside the bounded range.");
  if (!Number.isInteger(input.maxInputChars) || input.maxInputChars <= 0 || input.maxInputChars > maxInputChars) throw new Error("Local provider maxInputChars is outside the bounded range.");
  if (!Number.isInteger(input.maxOutputChars) || input.maxOutputChars <= 0 || input.maxOutputChars > maxOutputChars) throw new Error("Local provider maxOutputChars is outside the bounded range.");
  if (!Number.isInteger(input.maxConcurrent) || input.maxConcurrent < 1 || input.maxConcurrent > 1) throw new Error("Local provider maxConcurrent must be one for the low-memory profile.");
  if (!Number.isInteger(input.maxRequestsPerWindow) || input.maxRequestsPerWindow < 1 || input.maxRequestsPerWindow > 64) throw new Error("Local provider maxRequestsPerWindow is outside the bounded range.");
  if (!Number.isInteger(input.quotaWindowMs) || input.quotaWindowMs < 1_000 || input.quotaWindowMs > maxQuotaWindowMs) throw new Error("Local provider quotaWindowMs is outside the bounded range.");
  if (!Number.isInteger(input.circuitFailureThreshold) || input.circuitFailureThreshold < 1 || input.circuitFailureThreshold > maxFailureThreshold) throw new Error("Local provider circuitFailureThreshold is outside the bounded range.");
  if (!Number.isInteger(input.circuitCooldownMs) || input.circuitCooldownMs < 1_000 || input.circuitCooldownMs > maxCircuitCooldownMs) throw new Error("Local provider circuitCooldownMs is outside the bounded range.");
  return { ...input, baseUrl: url.toString().replace(/\/$/, ""), modelId: input.modelId.trim() };
};

export const defaultLocalProviderConfig = (providerId: LocalProviderId, modelId: string, baseUrl?: string): LocalProviderConfig => validateLocalProviderConfig({
  providerId,
  enabled: false,
  baseUrl: baseUrl ?? (providerId === "ollama" ? "http://127.0.0.1:11434" : "http://127.0.0.1:8080"),
  modelId,
  timeoutMs: 15_000,
  maxInputChars,
  maxOutputChars,
  maxConcurrent: 1,
  maxRequestsPerWindow: 8,
  quotaWindowMs: 60_000,
  circuitFailureThreshold: 3,
  circuitCooldownMs: 15_000,
});

type ProviderExecutionState = {
  config: LocalProviderConfig;
  inFlight: number;
  requestsInWindow: number;
  windowStartedAt: number;
  circuitState: "closed" | "open" | "half_open";
  consecutiveFailures: number;
  openedAt?: number;
};

export class BoundedProviderExecutionPolicy implements ProviderExecutionPolicy {
  private readonly states = new Map<string, ProviderExecutionState>();
  private readonly clock: () => number;

  public constructor(configs: readonly LocalProviderConfig[], now: () => number = () => Date.now()) {
    this.clock = now;
    for (const config of new BoundedProviderConfiguration().validateMany(configs)) this.configure(config);
  }

  public configure(input: LocalProviderConfig): LocalProviderConfig {
    const config = validateLocalProviderConfig(input);
    const existing = this.states.get(config.providerId);
    if (existing) {
      existing.config = config;
      return config;
    }
    this.states.set(config.providerId, {
      config,
      inFlight: 0,
      requestsInWindow: 0,
      windowStartedAt: this.clock(),
      circuitState: "closed",
      consecutiveFailures: 0,
    });
    return config;
  }

  public allow(providerId: string, nowMs = this.clock()): ProviderAdmission {
    const state = this.states.get(providerId);
    if (!state || !state.config.enabled) return state ? { allowed: false, reason: "disabled", remaining: 0 } : { allowed: true, reason: "admitted", remaining: 1 };
    this.resetWindowIfNeeded(state, nowMs);
    if (state.circuitState === "open") {
      const retryAfterMs = Math.max(0, state.config.circuitCooldownMs - (nowMs - (state.openedAt ?? nowMs)));
      if (retryAfterMs > 0) return { allowed: false, reason: "circuit_open", remaining: 0, retryAfterMs };
      state.circuitState = "half_open";
    }
    if (state.inFlight >= state.config.maxConcurrent) return { allowed: false, reason: "concurrency_limit", remaining: 0 };
    if (state.requestsInWindow >= state.config.maxRequestsPerWindow) {
      return { allowed: false, reason: "rate_limit", remaining: 0, retryAfterMs: Math.max(0, state.config.quotaWindowMs - (nowMs - state.windowStartedAt)) };
    }
    return { allowed: true, reason: "admitted", remaining: Math.max(0, state.config.maxConcurrent - state.inFlight - 1) };
  }

  public acquire(providerId: string, nowMs = this.clock()): ProviderAdmission {
    const admission = this.allow(providerId, nowMs);
    if (!admission.allowed) return admission;
    const state = this.states.get(providerId);
    if (!state) return admission;
    state.inFlight += 1;
    state.requestsInWindow += 1;
    return { ...admission, remaining: Math.max(0, state.config.maxConcurrent - state.inFlight) };
  }

  public release(providerId: string): void {
    const state = this.states.get(providerId);
    if (state) state.inFlight = Math.max(0, state.inFlight - 1);
  }

  public recordSuccess(providerId: string, _nowMs = this.clock()): void {
    const state = this.states.get(providerId);
    if (!state) return;
    state.consecutiveFailures = 0;
    state.circuitState = "closed";
    state.openedAt = undefined;
  }

  public recordFailure(providerId: string, nowMs = this.clock()): void {
    const state = this.states.get(providerId);
    if (!state) return;
    state.consecutiveFailures += 1;
    if (state.consecutiveFailures >= state.config.circuitFailureThreshold) {
      state.circuitState = "open";
      state.openedAt = nowMs;
    }
  }

  public snapshot(providerId: string): ProviderQuotaSnapshot {
    const state = this.states.get(providerId);
    if (!state) return { providerId, inFlight: 0, requestsInWindow: 0, windowStartedAt: this.clock(), circuitState: "closed", consecutiveFailures: 0 };
    return {
      providerId,
      inFlight: state.inFlight,
      requestsInWindow: state.requestsInWindow,
      windowStartedAt: state.windowStartedAt,
      circuitState: state.circuitState,
      consecutiveFailures: state.consecutiveFailures,
      openedAt: state.openedAt,
    };
  }

  private resetWindowIfNeeded(state: ProviderExecutionState, nowMs: number): void {
    if (nowMs - state.windowStartedAt < state.config.quotaWindowMs) return;
    state.windowStartedAt = nowMs;
    state.requestsInWindow = 0;
  }
}

export class BoundedProviderConfiguration implements ProviderConfigurationPort {
  private readonly maxItems: number;
  private readonly configs = new Map<LocalProviderId, LocalProviderConfig>();

  public constructor(options: ProviderPolicyOptions = {}, initial: readonly LocalProviderConfig[] = []) {
    this.maxItems = Math.max(1, Math.min(Math.floor(options.maxConfigurations ?? maxConfigurations), maxConfigurations));
    for (const config of this.validateMany(initial)) this.configs.set(config.providerId, config);
  }

  public validate(config: LocalProviderConfig): LocalProviderConfig {
    return validateLocalProviderConfig(config);
  }

  public validateMany(configs: readonly LocalProviderConfig[]): readonly LocalProviderConfig[] {
    if (configs.length > this.maxItems) throw new Error("Provider configuration registry limit reached.");
    const seen = new Set<LocalProviderId>();
    return configs.map((config) => {
      const validated = this.validate(config);
      if (seen.has(validated.providerId)) throw new Error(`Provider ${validated.providerId} is configured more than once.`);
      seen.add(validated.providerId);
      return validated;
    });
  }

  public configure(input: LocalProviderConfig): LocalProviderConfig {
    const config = this.validate(input);
    if (!this.configs.has(config.providerId) && this.configs.size >= this.maxItems) throw new Error("Provider configuration registry limit reached.");
    this.configs.set(config.providerId, config);
    return config;
  }

  public get(providerId: LocalProviderId): LocalProviderConfig | undefined {
    return this.configs.get(providerId);
  }

  public list(): readonly LocalProviderConfig[] {
    return [...this.configs.values()];
  }
}

export const isLocalProviderId = (value: string): value is LocalProviderId => value === "ollama" || value === "llama.cpp";
