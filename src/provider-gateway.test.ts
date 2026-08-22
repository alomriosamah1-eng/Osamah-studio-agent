import assert from "node:assert/strict";
import test from "node:test";
import { ProviderGateway } from "./application/provider-gateway.js";
import { ProviderGatewayError, type ProviderManifest } from "./application/provider-contracts.js";
import { FixtureProviderAdapter } from "./infrastructure/fixture-provider.js";
import { InMemoryProviderRouteAudit } from "./infrastructure/in-memory.js";

const manifest = (id: string, privacy: "local" | "remote", offline: boolean, estimatedLatencyMs: number): ProviderManifest => ({
  id,
  label: id,
  transport: "fixture",
  privacy,
  offline,
  capabilities: ["text", "structured_output"],
  models: [{
    id: `${id}-model`,
    capabilities: ["text", "structured_output"],
    contextWindow: 4096,
    streaming: false,
    offline,
    estimatedLatencyMs,
  }],
});

const request = (overrides: Partial<Parameters<ProviderGateway["invoke"]>[0]> = {}) => ({
  requestId: "request-1",
  sessionId: "session-1",
  capability: "text" as const,
  input: "Summarize the bounded task.",
  privacy: "remote_allowed" as const,
  sideEffect: "none" as const,
  ...overrides,
});

test("provider gateway chooses local provider before a faster remote provider", async () => {
  const remote = new FixtureProviderAdapter({ manifest: manifest("remote", "remote", false, 1) });
  const local = new FixtureProviderAdapter({ manifest: manifest("local", "local", true, 50) });
  const routeAudit = new InMemoryProviderRouteAudit();
  const gateway = new ProviderGateway([remote, local], { audit: routeAudit, now: () => "2026-08-22T00:00:00.000Z" });
  const result = await gateway.invoke(request());
  assert.equal(result.route.providerId, "local");
  assert.equal(result.route.fallbackCount, 0);
  assert.equal(remote.requests.length, 0);
  assert.equal(local.requests.length, 1);
  assert.deepEqual(routeAudit.list(1)[0], {
    requestId: "request-1",
    sessionId: "session-1",
    occurredAt: "2026-08-22T00:00:00.000Z",
    providerId: "local",
    modelId: "local-model",
    fallbackCount: 0,
    reason: "local-first capability match; fallback_count=0",
  });
  assert.equal("input" in (routeAudit.list(1)[0] ?? {}), false);
});

test("offline mode excludes remote providers and returns a clear no-provider error", async () => {
  const remote = new FixtureProviderAdapter({ manifest: manifest("remote", "remote", false, 1) });
  const gateway = new ProviderGateway([remote]);
  await assert.rejects(gateway.invoke(request({ offlineMode: true })), (error: unknown) =>
    error instanceof ProviderGatewayError && error.code === "NO_PROVIDER",
  );
  assert.equal(remote.requests.length, 0);
});

test("retryable provider failure falls back without duplicating a mutation", async () => {
  const first = new FixtureProviderAdapter({
    manifest: manifest("first", "local", true, 1),
    failure: new ProviderGatewayError("TIMEOUT", "first", true, "Fixture timeout."),
  });
  const second = new FixtureProviderAdapter({ manifest: manifest("second", "local", true, 2) });
  const gateway = new ProviderGateway([first, second]);
  const result = await gateway.invoke(request());
  assert.equal(result.route.providerId, "second");
  assert.equal(result.route.fallbackCount, 1);
  assert.equal(first.requests.length, 1);
  assert.equal(second.requests.length, 1);

  const mutation = request({ sideEffect: "mutation" });
  await assert.rejects(gateway.invoke(mutation), (error: unknown) =>
    error instanceof ProviderGatewayError && error.code === "INVALID_REQUEST",
  );
  assert.equal(first.requests.length, 1);
  assert.equal(second.requests.length, 1);
});

test("malformed provider output is bounded and can fall back to a second provider", async () => {
  const malformed = new FixtureProviderAdapter({
    manifest: manifest("malformed", "local", true, 1),
    malformedResponse: { providerId: "wrong-provider" },
  });
  const healthy = new FixtureProviderAdapter({ manifest: manifest("healthy", "local", true, 2) });
  const gateway = new ProviderGateway([malformed, healthy]);
  const result = await gateway.invoke(request({ requestId: "malformed-request", offlineMode: true }));
  assert.equal(result.route.providerId, "healthy");
  assert.equal(result.route.fallbackCount, 1);
});

test("unavailable providers are skipped and explicit model mismatches fail before dispatch", async () => {
  const unavailable = new FixtureProviderAdapter({
    manifest: manifest("unavailable", "local", true, 1),
    health: { status: "unavailable", checkedAt: "2026-08-22T00:00:00.000Z", reason: "fixture offline" },
  });
  const healthy = new FixtureProviderAdapter({ manifest: manifest("healthy", "local", true, 2) });
  const gateway = new ProviderGateway([unavailable, healthy]);
  const result = await gateway.invoke(request({ requestId: "health-request", offlineMode: true }));
  assert.equal(result.route.providerId, "healthy");
  assert.equal(unavailable.requests.length, 0);
  await assert.rejects(gateway.invoke(request({ modelId: "missing-model" })), (error: unknown) =>
    error instanceof ProviderGatewayError && error.code === "NO_PROVIDER",
  );
});
