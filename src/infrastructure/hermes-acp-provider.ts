import { spawn, type ChildProcess } from "node:child_process";
import { Readable, Writable } from "node:stream";
import { realpath, readFile, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import * as acp from "@agentclientprotocol/sdk";
import { ProviderGatewayError, type ProviderAdapter, type ProviderHealth, type ProviderInvocationRequest, type ProviderInvocationResponse, type ProviderManifest } from "../application/provider-contracts.js";

export interface HermesAcpProviderOptions {
  readonly workspaceRoot: string;
  readonly command?: string;
  readonly args?: readonly string[];
  readonly modelId?: string;
  readonly label?: string;
  readonly timeoutMs?: number;
  readonly maxInputChars?: number;
  readonly maxOutputChars?: number;
  readonly maxFileReadChars?: number;
  readonly maxSessionMappings?: number;
  readonly fetchImpl?: never;
  readonly spawnImpl?: typeof spawn;
  readonly now?: () => string;
}

type SpawnFunction = typeof spawn;

const defaultCommand = "python3";
const defaultArgs = ["-m", "acp_adapter.entry"] as const;
const maxTimeoutMs = 120_000;
const maxTextChars = 256 * 1024;
const defaultFileReadChars = 128 * 1024;
const defaultMaxSessions = 8;
const defaultModelId = "hermes-acp";

const errorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

const boundedPositive = (value: number | undefined, fallback: number, maximum: number): number => {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value <= 0) throw new ProviderGatewayError("INVALID_REQUEST", "hermes", false, "Hermes numeric option is invalid.");
  return Math.min(value, maximum);
};

const boundedTextOption = (value: string, field: string): string => {
  const normalized = value.trim();
  if (!normalized || normalized.length > 512 || /[\0\r\n]/.test(normalized)) throw new ProviderGatewayError("INVALID_REQUEST", "hermes", false, `Hermes ${field} is invalid.`);
  return normalized;
};

const asRecord = (value: unknown): Record<string, unknown> | undefined => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;

const ensureAbsoluteRoot = (value: string): string => {
  const raw = value.trim();
  if (!raw || !isAbsolute(raw) || /[\0\r\n]/.test(value)) throw new ProviderGatewayError("INVALID_REQUEST", "hermes", false, "Hermes workspaceRoot must be an absolute safe path.");
  return resolve(raw);
};

const ensureCommand = (value: string): string => {
  const normalized = value.trim();
  if (!normalized || normalized.length > 512 || /[\0\r\n]/.test(normalized) || (!isAbsolute(normalized) && normalized.includes("/"))) {
    throw new ProviderGatewayError("INVALID_REQUEST", "hermes", false, "Hermes command must be a safe executable name or absolute path.");
  }
  return normalized;
};

const ensureArgs = (args: readonly string[]): readonly string[] => {
  if (args.length > 16) throw new ProviderGatewayError("INVALID_REQUEST", "hermes", false, "Hermes command arguments exceed the bounded limit.");
  return args.map((arg) => {
    if (typeof arg !== "string" || arg.length > 512 || /[\0\r\n]/.test(arg)) throw new ProviderGatewayError("INVALID_REQUEST", "hermes", false, "Hermes command argument is invalid.");
    return arg;
  });
};

const providerErrorForStatus = (status: number, message: string): ProviderGatewayError => {
  if (status === 401 || status === 403) return new ProviderGatewayError("AUTH", "hermes", false, message);
  if (status === 429) return new ProviderGatewayError("RATE_LIMITED", "hermes", true, message);
  if (status >= 400 && status < 500) return new ProviderGatewayError("INVALID_REQUEST", "hermes", false, message);
  return new ProviderGatewayError("UNAVAILABLE", "hermes", true, message);
};

export class HermesAcpProviderAdapter implements ProviderAdapter {
  public readonly manifest: ProviderManifest;
  private readonly workspaceRoot: string;
  private readonly command: string;
  private readonly args: readonly string[];
  private readonly modelId: string;
  private readonly timeoutMs: number;
  private readonly maxInputChars: number;
  private readonly maxOutputChars: number;
  private readonly maxFileReadChars: number;
  private readonly maxSessionMappings: number;
  private readonly spawnImpl: SpawnFunction;
  private readonly now: () => string;
  private readonly sessions = new Map<string, acp.ActiveSession>();
  private readonly sessionInitializations = new Map<string, Promise<acp.ActiveSession>>();
  private process: ChildProcess | undefined;
  private connection: acp.ClientConnection | undefined;
  private connectionInitialization: Promise<acp.ClientContext> | undefined;
  private activeInvocation = false;

  public constructor(options: HermesAcpProviderOptions) {
    this.workspaceRoot = ensureAbsoluteRoot(options.workspaceRoot);
    this.command = ensureCommand(options.command ?? defaultCommand);
    this.args = ensureArgs(options.args ?? defaultArgs);
    this.modelId = boundedTextOption(options.modelId ?? defaultModelId, "modelId");
    this.timeoutMs = boundedPositive(options.timeoutMs, 120_000, maxTimeoutMs);
    this.maxInputChars = boundedPositive(options.maxInputChars, maxTextChars, maxTextChars);
    this.maxOutputChars = boundedPositive(options.maxOutputChars, maxTextChars, maxTextChars);
    this.maxFileReadChars = boundedPositive(options.maxFileReadChars, defaultFileReadChars, defaultFileReadChars);
    this.maxSessionMappings = boundedPositive(options.maxSessionMappings, defaultMaxSessions, defaultMaxSessions);
    this.spawnImpl = options.spawnImpl ?? spawn;
    this.now = options.now ?? (() => new Date().toISOString());
    const capabilities = ["text"] as const;
    this.manifest = {
      id: "hermes",
      label: options.label?.trim() || "Hermes Agent (ACP worker)",
      transport: "local",
      privacy: "remote",
      offline: false,
      capabilities,
      models: [{ id: this.modelId, capabilities, contextWindow: 128_000, streaming: true, offline: false, estimatedLatencyMs: 2_000 }],
    };
  }

  public async health(signal?: AbortSignal): Promise<ProviderHealth> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error("Hermes health check timed out.")), this.timeoutMs);
    const onAbort = (): void => controller.abort(signal?.reason ?? new Error("Hermes health check was cancelled."));
    if (signal?.aborted) onAbort();
    else signal?.addEventListener("abort", onAbort, { once: true });
    let child: ChildProcess | undefined;
    try {
      child = this.spawnImpl(this.command, [...this.args, "--check"], { cwd: this.workspaceRoot, stdio: ["ignore", "pipe", "pipe"] });
      const output = await this.collectProcessOutput(child, controller.signal);
      if (output.code === 0 && output.stdout.includes("Hermes ACP check OK")) return { status: "healthy", checkedAt: this.now() };
      return { status: "degraded", checkedAt: this.now(), reason: `Hermes ACP check exited with code ${output.code} after ${Date.now() - startedAt}ms.` };
    } catch (error) {
      return { status: "unavailable", checkedAt: this.now(), reason: errorMessage(error) };
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      if (child && !child.killed) child.kill();
    }
  }

  public async invoke(request: ProviderInvocationRequest, signal?: AbortSignal): Promise<ProviderInvocationResponse> {
    if (request.modelId && request.modelId !== this.modelId) throw new ProviderGatewayError("INVALID_REQUEST", this.manifest.id, false, `Hermes model mismatch: expected ${this.modelId}.`);
    if (request.sideEffect !== "none") throw new ProviderGatewayError("INVALID_REQUEST", this.manifest.id, false, "Hermes ACP mutation requires an Osamah approval bridge and is disabled in this slice.");
    if (!request.input || request.input.length > this.maxInputChars) throw new ProviderGatewayError("INVALID_REQUEST", this.manifest.id, false, "Hermes input exceeds the bounded request limit.");
    if (this.activeInvocation) throw new ProviderGatewayError("UNAVAILABLE", this.manifest.id, true, "Hermes ACP worker is busy; retry after the active turn completes.");
    this.activeInvocation = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error("Hermes prompt timed out.")), this.timeoutMs);
    const onAbort = (): void => controller.abort(signal?.reason ?? new Error("Hermes prompt was cancelled."));
    if (signal?.aborted) onAbort();
    else signal?.addEventListener("abort", onAbort, { once: true });
    try {
      const session = await this.sessionFor(request, controller.signal);
      const textPromise = session.readText();
      await session.prompt(request.input);
      const text = await textPromise;
      if (!text || text.length > this.maxOutputChars) throw new ProviderGatewayError("MALFORMED_OUTPUT", this.manifest.id, true, "Hermes ACP produced no bounded text output.");
      return { requestId: request.requestId, providerId: this.manifest.id, modelId: this.modelId, text, finishReason: "stop" };
    } catch (error) {
      if (error instanceof ProviderGatewayError) throw error;
      if (controller.signal.aborted) throw new ProviderGatewayError("TIMEOUT", this.manifest.id, true, errorMessage(controller.signal.reason));
      throw new ProviderGatewayError("UNAVAILABLE", this.manifest.id, true, errorMessage(error));
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      this.activeInvocation = false;
    }
  }

  public async close(): Promise<void> {
    for (const session of this.sessions.values()) session.dispose();
    this.sessions.clear();
    this.sessionInitializations.clear();
    this.connection?.close();
    this.connection = undefined;
    this.connectionInitialization = undefined;
    if (this.process && !this.process.killed) this.process.kill();
    this.process = undefined;
  }

  private async sessionFor(request: ProviderInvocationRequest, signal: AbortSignal): Promise<acp.ActiveSession> {
    const existing = this.sessions.get(request.sessionId);
    if (existing) return existing;
    const initializing = this.sessionInitializations.get(request.sessionId);
    if (initializing) return initializing;
    const promise = this.createSession(request, signal);
    this.sessionInitializations.set(request.sessionId, promise);
    try {
      const session = await promise;
      if (this.sessions.size >= this.maxSessionMappings) {
        const oldest = this.sessions.entries().next().value as [string, acp.ActiveSession] | undefined;
        if (oldest) {
          oldest[1].dispose();
          this.sessions.delete(oldest[0]);
        }
      }
      this.sessions.set(request.sessionId, session);
      return session;
    } finally {
      this.sessionInitializations.delete(request.sessionId);
    }
  }

  private async createSession(request: ProviderInvocationRequest, signal: AbortSignal): Promise<acp.ActiveSession> {
    const context = await this.ensureConnection(signal);
    if (signal.aborted) throw signal.reason ?? new Error("Hermes session creation was cancelled.");
    const session = await context.buildSession(this.workspaceRoot).start();
    return session;
  }

  private async ensureConnection(signal: AbortSignal): Promise<acp.ClientContext> {
    if (this.connection?.agent) return this.connection.agent;
    if (this.connectionInitialization) return this.connectionInitialization;
    this.connectionInitialization = this.initializeConnection(signal);
    try {
      return await this.connectionInitialization;
    } finally {
      this.connectionInitialization = undefined;
    }
  }

  private async initializeConnection(signal: AbortSignal): Promise<acp.ClientContext> {
    this.process = this.spawnImpl(this.command, this.args, { cwd: this.workspaceRoot, stdio: ["pipe", "pipe", "pipe"] });
    if (!this.process.stdin || !this.process.stdout || !this.process.stderr) throw providerErrorForStatus(503, "Hermes ACP worker did not expose stdio pipes.");
    this.process.stderr.setEncoding("utf8");
    this.process.stderr.on("data", () => undefined);
    const stream = acp.ndJsonStream(Writable.toWeb(this.process.stdin), Readable.toWeb(this.process.stdout) as unknown as ReadableStream<Uint8Array>);
    const app = acp.client({ name: "osamah-studio-agent" })
      .onRequest(acp.methods.client.session.requestPermission, async () => ({ outcome: { outcome: "cancelled" } }))
      .onRequest(acp.methods.client.fs.readTextFile, async (context) => this.readTextFile(context.params))
      .onRequest(acp.methods.client.fs.writeTextFile, async () => {
        throw new Error("Osamah disabled Hermes filesystem writes in this bridge.");
      })
      .onRequest(acp.methods.client.terminal.create, async () => {
        throw new Error("Osamah disabled Hermes terminal execution in this bridge.");
      })
      .onRequest(acp.methods.client.terminal.output, async () => {
        throw new Error("Osamah disabled Hermes terminal execution in this bridge.");
      })
      .onRequest(acp.methods.client.terminal.release, async () => {
        throw new Error("Osamah disabled Hermes terminal execution in this bridge.");
      })
      .onRequest(acp.methods.client.terminal.waitForExit, async () => {
        throw new Error("Osamah disabled Hermes terminal execution in this bridge.");
      })
      .onRequest(acp.methods.client.terminal.kill, async () => {
        throw new Error("Osamah disabled Hermes terminal execution in this bridge.");
      });
    const connection = app.connect(stream);
    this.connection = connection;
    const initialization = await connection.agent.request(acp.methods.agent.initialize, {
      protocolVersion: acp.PROTOCOL_VERSION,
      clientCapabilities: { fs: { readTextFile: true, writeTextFile: false } },
    });
    if (!initialization) throw providerErrorForStatus(503, "Hermes ACP initialize returned no response.");
    return connection.agent;
  }

  private async readTextFile(params: acp.ReadTextFileRequest): Promise<acp.ReadTextFileResponse> {
    if (!isAbsolute(params.path)) throw new Error("Hermes requested a non-absolute file path.");
    const root = await realpath(this.workspaceRoot);
    const candidate = await realpath(params.path);
    const pathFromRoot = relative(root, candidate);
    if (pathFromRoot.startsWith("..") || isAbsolute(pathFromRoot)) throw new Error("Hermes requested a file outside the approved workspace root.");
    const fileStats = await stat(candidate);
    if (!fileStats.isFile() || fileStats.size > this.maxFileReadChars * 4) throw new Error("Hermes requested a file outside the bounded read policy.");
    let content = await readFile(candidate, "utf8");
    if (content.length > this.maxFileReadChars) content = content.slice(0, this.maxFileReadChars);
    const lines = content.split("\n");
    const start = params.line && params.line > 0 ? params.line - 1 : 0;
    const selected = lines.slice(start, params.limit && params.limit > 0 ? start + Math.min(params.limit, 512) : undefined).join("\n");
    return { content: selected.slice(0, this.maxFileReadChars) };
  }

  private async collectProcessOutput(child: ChildProcess, signal: AbortSignal): Promise<{ code: number; stdout: string }> {
    let stdout = "";
    if (!child.stdout) throw providerErrorForStatus(503, "Hermes health worker did not expose stdout.");
    const onAbort = (): void => { child.kill(); };
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
    try {
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        if (stdout.length < 16 * 1024) stdout += chunk;
      });
      const code = await new Promise<number>((resolveExit, reject) => {
        child.once("error", reject);
        child.once("exit", (exitCode) => resolveExit(exitCode ?? 1));
      });
      return { code, stdout };
    } finally {
      signal.removeEventListener("abort", onAbort);
    }
  }
}
