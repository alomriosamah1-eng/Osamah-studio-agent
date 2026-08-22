import assert from "node:assert/strict";
import test from "node:test";
import { ProviderGateway } from "./application/provider-gateway.js";
import { ProviderGatewayError, type ProviderManifest, type ProviderInvocationRequest } from "./application/provider-contracts.js";
import { BoundedProviderConfiguration, BoundedProviderExecutionPolicy, defaultLocalProviderConfig, type LocalProviderConfig } from "./application/provider-policy.js";
import { FixtureProviderAdapter } from "./infrastructure/fixture-provider.js";
import { LocalProviderDoctor } from "./infrastructure/local-provider-doctor.js";

const config = (overrides: Partial<LocalProviderConfig> = {}): LocalProviderConfig => ({
  ...defaultLocalProviderConfig("ollama", "local-model"),
  enabled: true,
  ...overrides,
});

const manifest = (id: string, modelId: string, estimatedLatencyMs: number): ProviderManifest => ({
  id,
  label: id,
  transport: "fixture",
  privacy: "local",
  offline: true,
  capabilities: ["text"],
  models: [{ id: modelId, capabilities: ["text"], contextWindow: 8_192, streaming: false, offline: true, estimatedLatencyMs }],
});

const request: ProviderInvocationRequest = {
  requestId: "policy-request",
  sessionId: "policy-session",
  capability: "text",
  input: "Hello local provider",
  privacy: "local_only",
  offlineMode: true,
  sideEffect: "none",
};

test("provider configuration validates loopback and low-memory bounds", () => {
  const configuration = new BoundedProviderConfiguration();
  const validated = configuration.validate(config({ baseUrl: "http://localhost:11434/" }));
  assert.equal(validated.baseUrl, "http://localhost:11434");
  assert.equal(validated.maxConcurrent, 1);
  assert.throws(() => configuration.validate(config({ baseUrl: "http://remote.example" })), /loopback/);
  assert.throws(() => configuration.validate(config({ maxConcurrent: 2 })), /maxConcurrent/);
  assert.throws(() => configuration.validateMany([config(), config({ providerId: "llama.cpp" }) as LocalProviderConfig, config()]), /configured more than once/);
});

test("provider execution policy enforces one in-flight request and a bounded rate window", () => {
  let now = 1_000;
  const policy = new BoundedProviderExecutionPolicy([config({ maxRequestsPerWindow: 2, quotaWindowMs: 10_000 })], () => now);
  assert.deepEqual(policy.acquire("ollama", now), { allowed: true, reason: "admitted", remaining: 0 });
  assert.equal(policy.acquire("ollama", now).reason, "concurrency_limit");
  policy.release("ollama");
  assert.deepEqual(policy.acquire("ollama", now), { allowed: true, reason: "admitted", remaining: 0 });
  policy.release("ollama");
  assert.equal(policy.acquire("ollama", now).reason, "rate_limit");
  now += 10_000;
  assert.equal(policy.acquire("ollama", now).allowed, true);
});

test("provider circuit opens after bounded failures and closes after cooldown success", () => {
  let now = 2_000;
  const policy = new BoundedProviderExecutionPolicy([config({ circuitFailureThreshold: 2, circuitCooldownMs: 5_000 })], () => now);
  policy.recordFailure("ollama", now);
  assert.equal(policy.allow("ollama", now).allowed, true);
  policy.recordFailure("ollama", now);
  const open = policy.allow("ollama", now);
  assert.equal(open.reason, "circuit_open");
  assert.equal(open.retryAfterMs, 5_000);
  now += 5_000;
  assert.equal(policy.allow("ollama", now).allowed, true);
  assert.equal(policy.snapshot("ollama").circuitState, "half_open");
  policy.recordSuccess("ollama", now);
  assert.equal(policy.snapshot("ollama").circuitState, "closed");
  assert.equal(policy.snapshot("ollama").consecutiveFailures, 0);
});

test("local provider doctor is explicit and reports disabled or blocked states without probes", async () => {
  let calls = 0;
  const adapter = new FixtureProviderAdapter({
    manifest: manifest("ollama", "local-model", 1),
    health: { status: "healthy", checkedAt: "2026-08-22T00:00:00.000Z" },
  });
  const doctor = new LocalProviderDoctor([adapter], () => Date.parse("2026-08-22T00:00:00.000Z"));
  const disabled = await doctor.check(config({ enabled: false }));
  assert.equal(disabled.status, "disabled");
  assert.equal(calls, 0);
  const healthy = await doctor.check(config());
  assert.equal(healthy.status, "healthy");
  const blocked = await doctor.check(config({ providerId: "llama.cpp" }));
  assert.equal(blocked.status, "blocked");
});

test("ProviderGateway applies execution policy before invoking an explicitly registered adapter", async () => {
  const adapter = new FixtureProviderAdapter({ manifest: manifest("ollama", "local-model", 1) });
  const disabledPolicy = new BoundedProviderExecutionPolicy([config({ enabled: false })]);
  const disabledGateway = new ProviderGateway([adapter], { executionPolicy: disabledPolicy });
  await assert.rejects(() => disabledGateway.invoke(request), (error: unknown) => error instanceof ProviderGatewayError && error.code === "UNAVAILABLE");
  assert.equal(adapter.requests.length, 0);

  const enabledPolicy = new BoundedProviderExecutionPolicy([config({ maxRequestsPerWindow: 2 })]);
  const gateway = new ProviderGateway([adapter], { executionPolicy: enabledPolicy });
  const result = await gateway.invoke(request);
  assert.equal(result.response.text.includes("Fixture response"), true);
  assert.equal(enabledPolicy.snapshot("ollama").inFlight, 0);
});
