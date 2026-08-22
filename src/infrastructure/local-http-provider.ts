import { ProviderGatewayError, type ProviderAdapter, type ProviderCapability, type ProviderHealth, type ProviderInvocationRequest, type ProviderInvocationResponse, type ProviderManifest } from "../application/provider-contracts.js";

export interface LocalHttpProviderOptions {
  readonly baseUrl: string;
  readonly modelId: string;
  readonly label: string;
  readonly transport: "http";
  readonly capabilities?: readonly ProviderCapability[];
  readonly contextWindow?: number;
  readonly estimatedLatencyMs?: number;
  readonly timeoutMs?: number;
  readonly maxInputChars?: number;
  readonly maxOutputChars?: number;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => string;
}

interface JsonResponse {
  readonly status: number;
  readonly body: unknown;
}

const defaultCapabilities: readonly ProviderCapability[] = ["text", "structured_output"];
const maxRequestChars = 128 * 1024;
const maxResponseChars = 256 * 1024;
const maxTimeoutMs = 120_000;
const maxContextWindow = 1_000_000;

const isLoopbackHostname = (hostname: string): boolean => {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "[::1]" || normalized === "::1";
};

const normalizeBaseUrl = (value: string): string => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ProviderGatewayError("INVALID_REQUEST", undefined, false, "Local provider baseUrl is invalid.");
  }
  if (url.protocol !== "http:" || !isLoopbackHostname(url.hostname) || url.username || url.password || url.search || url.hash) {
    throw new ProviderGatewayError("INVALID_REQUEST", undefined, false, "Local provider baseUrl must be an http loopback URL without credentials or query parameters.");
  }
  return url.toString().replace(/\/$/, "");
};

const boundedPositive = (value: number | undefined, fallback: number, maximum: number): number => {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value) || value <= 0) throw new ProviderGatewayError("INVALID_REQUEST", undefined, false, "Local provider numeric option is invalid.");
  return Math.min(Math.floor(value), maximum);
};

const boundedText = (value: unknown, maxChars: number): string => {
  if (typeof value !== "string") throw new ProviderGatewayError("MALFORMED_OUTPUT", undefined, true, "Local provider response text is not a string.");
  if (value.length === 0 || value.length > maxChars) throw new ProviderGatewayError("MALFORMED_OUTPUT", undefined, true, "Local provider response text exceeds the bounded output limit.");
  return value;
};

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ProviderGatewayError("MALFORMED_OUTPUT", undefined, true, "Local provider response is not a JSON object.");
  return value as Record<string, unknown>;
};

const numberIfPresent = (value: unknown): number | undefined => {
  if (value === undefined) return undefined;
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
};

const responseError = (status: number): { code: "AUTH" | "RATE_LIMITED" | "INVALID_REQUEST" | "UNAVAILABLE"; retryable: boolean } => {
  if (status === 401 || status === 403) return { code: "AUTH", retryable: false };
  if (status === 429) return { code: "RATE_LIMITED", retryable: true };
  if (status >= 400 && status < 500) return { code: "INVALID_REQUEST", retryable: false };
  return { code: "UNAVAILABLE", retryable: true };
};

export abstract class LocalHttpProviderAdapter implements ProviderAdapter {
  public readonly manifest: ProviderManifest;
  protected readonly baseUrl: string;
  protected readonly modelId: string;
  protected readonly timeoutMs: number;
  protected readonly maxInputChars: number;
  protected readonly maxOutputChars: number;
  protected readonly fetchImpl: typeof fetch;
  protected readonly now: () => string;

  protected constructor(options: Omit<LocalHttpProviderOptions, "label" | "transport">, manifest: ProviderManifest) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.modelId = options.modelId.trim();
    if (!this.modelId || this.modelId.length > 256 || /[\0\r\n]/.test(this.modelId)) {
      throw new ProviderGatewayError("INVALID_REQUEST", manifest.id, false, "Local provider modelId is invalid.");
    }
    this.timeoutMs = boundedPositive(options.timeoutMs, 15_000, maxTimeoutMs);
    this.maxInputChars = boundedPositive(options.maxInputChars, maxRequestChars, maxRequestChars);
    this.maxOutputChars = boundedPositive(options.maxOutputChars, maxResponseChars, maxResponseChars);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date().toISOString());
    this.manifest = {
      ...manifest,
      models: [{ ...manifest.models[0]!, id: this.modelId }],
    };
  }

  public async health(signal?: AbortSignal): Promise<ProviderHealth> {
    try {
      const response = await this.requestJson(this.healthPath(), { method: "GET" }, signal);
      if (response.status >= 200 && response.status < 300 && this.isHealthyPayload(response.body)) {
        return { status: "healthy", checkedAt: this.now() };
      }
      return { status: "degraded", checkedAt: this.now(), reason: "Local provider returned an unexpected health payload." };
    } catch (error) {
      return { status: "unavailable", checkedAt: this.now(), reason: error instanceof Error ? error.message : String(error) };
    }
  }

  public async invoke(request: ProviderInvocationRequest, signal?: AbortSignal): Promise<ProviderInvocationResponse> {
    if (request.modelId && request.modelId !== this.modelId) {
      throw new ProviderGatewayError("INVALID_REQUEST", this.manifest.id, false, `Provider model mismatch: expected ${this.modelId}.`);
    }
    if (request.input.length === 0 || request.input.length > this.maxInputChars) {
      throw new ProviderGatewayError("INVALID_REQUEST", this.manifest.id, false, "Local provider input exceeds the bounded request limit.");
    }
    const response = await this.requestJson(this.invokePath(), {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(this.requestBody(request)),
    }, signal);
    if (response.status < 200 || response.status >= 300) {
      const mapped = responseError(response.status);
      throw new ProviderGatewayError(mapped.code, this.manifest.id, mapped.retryable, `Local provider request failed with HTTP ${response.status}.`);
    }
    return this.toInvocationResponse(request, response.body);
  }

  protected abstract healthPath(): string;
  protected abstract invokePath(): string;
  protected abstract requestBody(request: ProviderInvocationRequest): Record<string, unknown>;
  protected abstract isHealthyPayload(body: unknown): boolean;
  protected abstract extractText(body: Record<string, unknown>): unknown;

  private async requestJson(path: string, init: RequestInit, signal?: AbortSignal): Promise<JsonResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error("Local provider request timed out.")), this.timeoutMs);
    const onAbort = (): void => controller.abort(signal?.reason ?? new Error("Local provider request was cancelled."));
    if (signal?.aborted) onAbort();
    else signal?.addEventListener("abort", onAbort, { once: true });
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, signal: controller.signal });
      const text = await response.text();
      if (text.length > this.maxOutputChars) throw new ProviderGatewayError("MALFORMED_OUTPUT", this.manifest.id, true, "Local provider JSON response exceeds the bounded output limit.");
      let body: unknown = undefined;
      if (text) {
        try {
          body = JSON.parse(text) as unknown;
        } catch {
          body = text;
        }
      }
      return { status: response.status, body };
    } catch (error) {
      if (error instanceof ProviderGatewayError) throw error;
      if (controller.signal.aborted) {
        const message = controller.signal.reason instanceof Error ? controller.signal.reason.message : "Local provider request was cancelled.";
        throw new ProviderGatewayError("TIMEOUT", this.manifest.id, true, message);
      }
      throw new ProviderGatewayError("UNAVAILABLE", this.manifest.id, true, error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  private toInvocationResponse(request: ProviderInvocationRequest, body: unknown): ProviderInvocationResponse {
    const record = asRecord(body);
    return {
      requestId: request.requestId,
      providerId: this.manifest.id,
      modelId: this.modelId,
      text: boundedText(this.extractText(record), this.maxOutputChars),
      inputTokens: numberIfPresent(record.prompt_eval_count) ?? numberIfPresent(record.usage && typeof record.usage === "object" ? (record.usage as Record<string, unknown>).prompt_tokens : undefined),
      outputTokens: numberIfPresent(record.eval_count) ?? numberIfPresent(record.usage && typeof record.usage === "object" ? (record.usage as Record<string, unknown>).completion_tokens : undefined),
      finishReason: this.finishReason(record),
    };
  }

  private finishReason(record: Record<string, unknown>): ProviderInvocationResponse["finishReason"] {
    const value = record.done_reason ?? record.finish_reason;
    return value === "length" ? "length" : value === "tool_call" ? "tool_call" : value === "stop" || value === undefined ? "stop" : undefined;
  }
}

export class OllamaProviderAdapter extends LocalHttpProviderAdapter {
  public constructor(options: Omit<LocalHttpProviderOptions, "label" | "transport"> & Partial<Pick<LocalHttpProviderOptions, "label" | "transport">>) {
    const capabilities = options.capabilities ?? defaultCapabilities;
    super(options, {
      id: "ollama",
      label: options.label ?? "Ollama (local)",
      transport: options.transport ?? "http",
      privacy: "local",
      offline: true,
      capabilities,
      models: [{ id: options.modelId, capabilities, contextWindow: boundedPositive(options.contextWindow, 8_192, maxContextWindow), streaming: false, offline: true, estimatedLatencyMs: boundedPositive(options.estimatedLatencyMs, 800, maxTimeoutMs)
 }],
    });
  }

  protected healthPath(): string { return "/api/tags"; }
  protected invokePath(): string { return "/api/generate"; }
  protected requestBody(request: ProviderInvocationRequest): Record<string, unknown> { return { model: this.modelId, prompt: request.input, stream: false }; }
  protected isHealthyPayload(body: unknown): boolean { return Boolean(body && typeof body === "object" && Array.isArray((body as Record<string, unknown>).models)); }
  protected extractText(body: Record<string, unknown>): unknown { return body.response; }
}

export class LlamaCppProviderAdapter extends LocalHttpProviderAdapter {
  public constructor(options: Omit<LocalHttpProviderOptions, "label" | "transport"> & Partial<Pick<LocalHttpProviderOptions, "label" | "transport">>) {
    const capabilities = options.capabilities ?? defaultCapabilities;
    super(options, {
      id: "llama.cpp",
      label: options.label ?? "llama.cpp (local)",
      transport: options.transport ?? "http",
      privacy: "local",
      offline: true,
      capabilities,
      models: [{ id: options.modelId, capabilities, contextWindow: boundedPositive(options.contextWindow, 8_192, maxContextWindow), streaming: false, offline: true, estimatedLatencyMs: boundedPositive(options.estimatedLatencyMs, 1_000, maxTimeoutMs)
 }],
    });
  }

  protected healthPath(): string { return "/health"; }
  protected invokePath(): string { return "/v1/chat/completions"; }
  protected requestBody(request: ProviderInvocationRequest): Record<string, unknown> { return { model: this.modelId, messages: [{ role: "user", content: request.input }], stream: false }; }
  protected isHealthyPayload(body: unknown): boolean {
    if (typeof body === "string") return body === "OK";
    return Boolean(body && typeof body === "object" && ["ok", "healthy", "status"].some((key) => (body as Record<string, unknown>)[key] === true || (body as Record<string, unknown>)[key] === "ok" || (body as Record<string, unknown>)[key] === "healthy"));
  }
  protected extractText(body: Record<string, unknown>): unknown {
    const choices = body.choices;
    if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") return undefined;
    const message = (choices[0] as Record<string, unknown>).message;
    return message && typeof message === "object" ? (message as Record<string, unknown>).content : undefined;
  }
}
