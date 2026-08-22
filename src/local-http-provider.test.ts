import assert from "node:assert/strict";
import test from "node:test";
import { ProviderGatewayError, type ProviderInvocationRequest } from "./application/provider-contracts.js";
import { LlamaCppProviderAdapter, OllamaProviderAdapter } from "./infrastructure/local-http-provider.js";

const request: ProviderInvocationRequest = {
  requestId: "provider-request-1",
  sessionId: "provider-session-1",
  capability: "text",
  input: "Explain the bounded workspace.",
  privacy: "local_only",
  offlineMode: true,
  sideEffect: "none",
};

test("Ollama adapter is inert at construction and maps generate responses", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const adapter = new OllamaProviderAdapter({
    baseUrl: "http://127.0.0.1:11434",
    modelId: "qwen2.5-coder:7b",
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ response: "Local Ollama response", prompt_eval_count: 4, eval_count: 7, done_reason: "stop" }), { status: 200 });
    },
  });
  assert.equal(calls.length, 0);
  assert.equal(adapter.manifest.privacy, "local");
  assert.equal(adapter.manifest.offline, true);
  const response = await adapter.invoke(request);
  assert.equal(response.text, "Local Ollama response");
  assert.equal(response.inputTokens, 4);
  assert.equal(response.outputTokens, 7);
  assert.equal(calls[0]?.url, "http://127.0.0.1:11434/api/generate");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), { model: "qwen2.5-coder:7b", prompt: request.input, stream: false });
});

test("llama.cpp adapter maps OpenAI-compatible chat responses and health", async () => {
  const paths: string[] = [];
  const adapter = new LlamaCppProviderAdapter({
    baseUrl: "http://localhost:8080/",
    modelId: "local-model",
    now: () => "2026-08-22T00:00:00.000Z",
    fetchImpl: async (url) => {
      paths.push(String(url));
      if (String(url).endsWith("/health")) return new Response("OK", { status: 200 });
      return new Response(JSON.stringify({ choices: [{ message: { content: "Local llama.cpp response" } }], usage: { prompt_tokens: 3, completion_tokens: 5 } }), { status: 200 });
    },
  });
  assert.deepEqual(await adapter.health(), { status: "healthy", checkedAt: "2026-08-22T00:00:00.000Z" });
  const response = await adapter.invoke(request);
  assert.equal(response.text, "Local llama.cpp response");
  assert.equal(response.inputTokens, 3);
  assert.equal(response.outputTokens, 5);
  assert.deepEqual(paths, ["http://localhost:8080/health", "http://localhost:8080/v1/chat/completions"]);
});

test("local HTTP adapters reject non-loopback URLs, credentials, and model mismatches", async () => {
  assert.throws(() => new OllamaProviderAdapter({ baseUrl: "https://127.0.0.1:11434", modelId: "model" }), (error: unknown) => error instanceof ProviderGatewayError && error.code === "INVALID_REQUEST");
  assert.throws(() => new OllamaProviderAdapter({ baseUrl: "http://example.test:11434", modelId: "model" }), (error: unknown) => error instanceof ProviderGatewayError && error.code === "INVALID_REQUEST");
  assert.throws(() => new OllamaProviderAdapter({ baseUrl: "http://user:pass@127.0.0.1:11434", modelId: "model" }), (error: unknown) => error instanceof ProviderGatewayError && error.code === "INVALID_REQUEST");
  const adapter = new OllamaProviderAdapter({ baseUrl: "http://127.0.0.1:11434", modelId: "model", fetchImpl: async () => new Response(JSON.stringify({ response: "unused" }), { status: 200 }) });
  await assert.rejects(() => adapter.invoke({ ...request, modelId: "other-model" }), (error: unknown) => error instanceof ProviderGatewayError && error.code === "INVALID_REQUEST");
});

test("local HTTP adapters convert malformed output and HTTP failures to typed errors", async () => {
  const malformed = new LlamaCppProviderAdapter({ baseUrl: "http://127.0.0.1:8080", modelId: "model", fetchImpl: async () => new Response(JSON.stringify({ choices: [] }), { status: 200 }) });
  await assert.rejects(() => malformed.invoke(request), (error: unknown) => error instanceof ProviderGatewayError && error.code === "MALFORMED_OUTPUT");
  const unauthorized = new OllamaProviderAdapter({ baseUrl: "http://127.0.0.1:11434", modelId: "model", fetchImpl: async () => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }) });
  await assert.rejects(() => unauthorized.invoke(request), (error: unknown) => error instanceof ProviderGatewayError && error.code === "AUTH" && error.retryable === false);
});

test("local HTTP adapters enforce cancellation and timeout without hanging", async () => {
  const adapter = new OllamaProviderAdapter({
    baseUrl: "http://127.0.0.1:11434",
    modelId: "model",
    timeoutMs: 5,
    fetchImpl: async (_url, init) => await new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }),
  });
  await assert.rejects(() => adapter.invoke(request), (error: unknown) => error instanceof ProviderGatewayError && error.code === "TIMEOUT");
});
