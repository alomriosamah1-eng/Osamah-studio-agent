import { createOpencodeClient, type OpencodeClient } from "@opencode-ai/sdk/v2";
import { ProviderGatewayError, type ProviderAdapter, type ProviderCapability, type ProviderHealth, type ProviderInvocationRequest, type ProviderInvocationResponse, type ProviderManifest } from "../application/provider-contracts.js";

export interface OpenCodeSdkProviderOptions {
  readonly baseUrl: string;
  readonly modelId: string;
  readonly modelProviderId?: string;
  readonly directory?: string;
  readonly agent?: string;
  readonly label?: string;
  readonly estimatedLatencyMs?: number;
  readonly timeoutMs?: number;
  readonly maxInputChars?: number;
  readonly maxOutputChars?: number;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => string;
}

const maxInputChars = 128 * 1024;
const maxOutputChars = 256 * 1024;
const maxTimeoutMs = 120_000;
const maxModelIdLength = 256;
const maxSessionMappings = 32;

const isLoopbackHostname = (hostname: string): boolean => {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "[::1]" || normalized === "::1";
};

const normalizeBaseUrl = (value: string): string => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ProviderGatewayError("INVALID_REQUEST", "opencode", false, "OpenCode baseUrl is invalid.");
  }
  if (url.protocol !== "http:" || !isLoopbackHostname(url.hostname) || url.username || url.password || url.search || url.hash) {
    throw new ProviderGatewayError("INVALID_REQUEST", "opencode", false, "OpenCode baseUrl must be an http loopback URL without credentials or query parameters.");
  }
  return url.toString().replace(/\/$/, "");
};

const boundedNumber = (value: number | undefined, fallback: number, maximum: number): number => {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value) || value <= 0) throw new ProviderGatewayError("INVALID_REQUEST", "opencode", false, "OpenCode numeric option is invalid.");
  return Math.min(Math.floor(value), maximum);
};

const boundedId = (value: string, field: string): string => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxModelIdLength || /[\0\r\n]/.test(trimmed)) {
    throw new ProviderGatewayError("INVALID_REQUEST", "opencode", false, `OpenCode ${field} is invalid.`);
  }
  return trimmed;
};

const asRecord = (value: unknown): Record<string, unknown> | undefined => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;

const boundedResponseText = (value: unknown, maxLength: number): string => {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength || value.includes("\0")) {
    throw new ProviderGatewayError("MALFORMED_OUTPUT", "opencode", true, "OpenCode response text is missing or exceeds the bounded output limit.");
  }
  return value;
};

const extractText = (value: unknown): unknown => {
  if (typeof value === "string") return value;
  const record = asRecord(value);
  if (!record) return undefined;
  if (typeof record.text === "string") return record.text;
  if (typeof record.content === "string") return record.content;
  if (Array.isArray(record.parts)) {
    const parts = record.parts.map((part) => extractText(part)).filter((part): part is string => typeof part === "string" && part.length > 0);
    if (parts.length > 0) return parts.join("\n");
  }
  if (record.message !== undefined) return extractText(record.message);
  if (record.data !== undefined) return extractText(record.data);
  return undefined;
};

const responseError = (status: number, message: string): ProviderGatewayError => {
  if (status === 401 || status === 403) return new ProviderGatewayError("AUTH", "opencode", false, message);
  if (status === 429) return new ProviderGatewayError("RATE_LIMITED", "opencode", true, message);
  if (status >= 400 && status < 500) return new ProviderGatewayError("INVALID_REQUEST", "opencode", false, message);
  return new ProviderGatewayError("UNAVAILABLE", "opencode", true, message);
};

const errorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

export class OpenCodeSdkProviderAdapter implements ProviderAdapter {
  public readonly manifest: ProviderManifest;
  private readonly client: OpencodeClient;
  private readonly modelId: string;
  private readonly modelProviderId: string | undefined;
  private readonly directory: string | undefined;
  private readonly agent: string | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxInputChars: number;
  private readonly maxOutputChars: number;
  private readonly now: () => string;
  private readonly sessionMappings = new Map<string, string>();
  private readonly sessionInitializations = new Map<string, Promise<string>>();

  public constructor(options: OpenCodeSdkProviderOptions) {
    const baseUrl = normalizeBaseUrl(options.baseUrl);
    this.modelId = boundedId(options.modelId, "modelId");
    this.modelProviderId = options.modelProviderId === undefined ? undefined : boundedId(options.modelProviderId, "modelProviderId");
    this.directory = options.directory;
    this.agent = options.agent === undefined ? undefined : boundedId(options.agent, "agent");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = boundedNumber(options.timeoutMs, 15_000, maxTimeoutMs);
    this.maxInputChars = boundedNumber(options.maxInputChars, maxInputChars, maxInputChars);
    this.maxOutputChars = boundedNumber(options.maxOutputChars, maxOutputChars, maxOutputChars);
    this.now = options.now ?? (() => new Date().toISOString());
    this.client = createOpencodeClient({ baseUrl, directory: this.directory, fetch: this.fetchImpl });
    const capabilities: readonly ProviderCapability[] = ["text"];
    this.manifest = {
      id: "opencode",
      label: options.label?.trim() || "OpenCode (local SDK)",
      transport: "http",
      privacy: "local",
      offline: false,
      capabilities,
      models: [{ id: this.modelId, capabilities, contextWindow: 128_000, streaming: false, offline: false, estimatedLatencyMs: boundedNumber(options.estimatedLatencyMs, 1_200, maxTimeoutMs) }],
    };
  }

  public async health(signal?: AbortSignal): Promise<ProviderHealth> {
    try {
      const result = await this.client.global.health({ signal });
      if (result.error !== undefined) throw responseError(result.response.status, "OpenCode health request failed.");
      const payload = asRecord(result.data);
      if (payload?.healthy === true) return { status: "healthy", checkedAt: this.now() };
      return { status: "degraded", checkedAt: this.now(), reason: "OpenCode returned an unexpected health payload." };
    } catch (error) {
      return { status: "unavailable", checkedAt: this.now(), reason: errorMessage(error) };
    }
  }

  public async invoke(request: ProviderInvocationRequest, signal?: AbortSignal): Promise<ProviderInvocationResponse> {
    if (request.modelId && request.modelId !== this.modelId) throw new ProviderGatewayError("INVALID_REQUEST", this.manifest.id, false, `OpenCode model mismatch: expected ${this.modelId}.`);
    if (request.input.length === 0 || request.input.length > this.maxInputChars) throw new ProviderGatewayError("INVALID_REQUEST", this.manifest.id, false, "OpenCode input exceeds the bounded request limit.");
    const upstreamSessionId = await this.sessionFor(request, signal);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error("OpenCode request timed out.")), this.timeoutMs);
    const onAbort = (): void => controller.abort(signal?.reason ?? new Error("OpenCode request was cancelled."));
    if (signal?.aborted) onAbort();
    else signal?.addEventListener("abort", onAbort, { once: true });
    try {
      const result = await this.client.session.prompt({
        sessionID: upstreamSessionId,
        directory: this.directory,
        model: this.modelProviderId ? { providerID: this.modelProviderId, modelID: this.modelId } : undefined,
        agent: this.agent,
        noReply: false,
        tools: {},
        parts: [{ type: "text", text: request.input }],
      }, { signal: controller.signal });
      if (result.error !== undefined) throw responseError(result.response.status, "OpenCode prompt request failed.");
      return { requestId: request.requestId, providerId: this.manifest.id, modelId: this.modelId, text: boundedResponseText(extractText(result.data), this.maxOutputChars), finishReason: "stop" };
    } catch (error) {
      if (error instanceof ProviderGatewayError) throw error;
      if (controller.signal.aborted) throw new ProviderGatewayError("TIMEOUT", this.manifest.id, true, errorMessage(controller.signal.reason));
      throw new ProviderGatewayError("UNAVAILABLE", this.manifest.id, true, errorMessage(error));
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  private async sessionFor(request: ProviderInvocationRequest, signal?: AbortSignal): Promise<string> {
    const existing = this.sessionMappings.get(request.sessionId);
    if (existing) return existing;
    const initializing = this.sessionInitializations.get(request.sessionId);
    if (initializing) return initializing;
    const promise = this.createSession(request, signal);
    this.sessionInitializations.set(request.sessionId, promise);
    try {
      const sessionId = await promise;
      if (this.sessionMappings.size >= maxSessionMappings) this.sessionMappings.delete(this.sessionMappings.keys().next().value as string);
      this.sessionMappings.set(request.sessionId, sessionId);
      return sessionId;
    } finally {
      this.sessionInitializations.delete(request.sessionId);
    }
  }

  private async createSession(request: ProviderInvocationRequest, signal?: AbortSignal): Promise<string> {
    const result = await this.client.session.create({
      directory: this.directory,
      title: `Osamah ${request.sessionId}`,
      agent: this.agent,
      model: this.modelProviderId ? { providerID: this.modelProviderId, id: this.modelId } : undefined,
      metadata: { osamahRequestSessionId: request.sessionId },
    }, { signal });
    if (result.error !== undefined) throw responseError(result.response.status, "OpenCode session creation failed.");
    const session = asRecord(result.data);
    const sessionId = session?.id;
    if (typeof sessionId !== "string" || !sessionId.trim() || sessionId.length > 256) throw new ProviderGatewayError("MALFORMED_OUTPUT", this.manifest.id, true, "OpenCode session response did not contain a valid id.");
    return sessionId;
  }
}
