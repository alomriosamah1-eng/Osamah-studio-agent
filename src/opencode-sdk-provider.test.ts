import assert from "node:assert/strict";
import test from "node:test";
import { ProviderGatewayError, type ProviderInvocationRequest } from "./application/provider-contracts.js";
import { OpenCodeSdkProviderAdapter } from "./infrastructure/opencode-sdk-provider.js";

interface RecordedRequest {
  readonly url: string;
  readonly method: string;
  readonly body?: Record<string, unknown>;
}

const jsonResponse = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const requestOf = (sessionId = "application-session"): ProviderInvocationRequest => ({
  requestId: "request-1",
  sessionId,
  capability: "text",
  input: "Explain the local-first architecture.",
  privacy: "local_only",
  offlineMode: false,
  sideEffect: "none",
});

test("OpenCode SDK adapter is inert until health or invoke is explicitly requested", async () => {
  const requests: RecordedRequest[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    requests.push({ url, method });
    return jsonResponse({ healthy: true });
  };
  const adapter = new OpenCodeSdkProviderAdapter({ baseUrl: "http://127.0.0.1:4096", modelId: "local-model", fetchImpl });
  assert.equal(requests.length, 0);
  const health = await adapter.health();
  assert.equal(health.status, "healthy");
  assert.equal(requests.length, 1);
});

test("OpenCode SDK adapter creates one upstream session and maps prompt text into ProviderAdapter output", async () => {
  const requests: RecordedRequest[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    const serializedBody = typeof init?.body === "string" ? init.body : input instanceof Request ? await input.clone().text() : "";
    const rawBody = serializedBody ? JSON.parse(serializedBody) as Record<string, unknown> : undefined;
    requests.push({ url, method, body: rawBody });
    if (url.endsWith("/session") && method === "POST") return jsonResponse({ id: "ses_upstream_1" });
    if (url.endsWith("/session/ses_upstream_1/message") && method === "POST") return jsonResponse({ id: "msg_1", parts: [{ type: "text", text: "OpenCode integrated answer" }] });
    return jsonResponse({ healthy: true });
  };
  const adapter = new OpenCodeSdkProviderAdapter({ baseUrl: "http://localhost:4096", modelId: "local-model", modelProviderId: "local-provider", agent: "plan", fetchImpl });
  const first = await adapter.invoke(requestOf());
  const second = await adapter.invoke({ ...requestOf(), requestId: "request-2" });
  assert.equal(first.text, "OpenCode integrated answer");
  assert.equal(second.text, "OpenCode integrated answer");
  assert.equal(requests.filter((entry) => entry.url.endsWith("/session") && entry.method === "POST").length, 1);
  const createBody = requests.find((entry) => entry.url.endsWith("/session") && entry.method === "POST")?.body;
  assert.deepEqual(createBody?.model, { id: "local-model", providerID: "local-provider" });
  const promptBody = requests.find((entry) => entry.url.endsWith("/message") && entry.method === "POST")?.body;
  assert.deepEqual(promptBody?.model, { providerID: "local-provider", modelID: "local-model" });
  assert.deepEqual(promptBody?.parts, [{ type: "text", text: "Explain the local-first architecture." }]);
  assert.deepEqual(adapter.manifest, {
    id: "opencode",
    label: "OpenCode (local SDK)",
    transport: "http",
    privacy: "local",
    offline: false,
    capabilities: ["text"],
    models: [{ id: "local-model", capabilities: ["text"], contextWindow: 128_000, streaming: false, offline: false, estimatedLatencyMs: 1_200 }],
  });
});

test("OpenCode SDK adapter fails closed for remote URLs and malformed prompt output", async () => {
  assert.throws(() => new OpenCodeSdkProviderAdapter({ baseUrl: "https://example.test", modelId: "model" }), (error: unknown) => error instanceof ProviderGatewayError && error.code === "INVALID_REQUEST");
  const fetchImpl: typeof fetch = async () => jsonResponse({ id: "ses_upstream_1" });
  const adapter = new OpenCodeSdkProviderAdapter({ baseUrl: "http://127.0.0.1:4096", modelId: "model", fetchImpl });
  await assert.rejects(adapter.invoke(requestOf()), (error: unknown) => error instanceof ProviderGatewayError && error.code === "MALFORMED_OUTPUT");
});
