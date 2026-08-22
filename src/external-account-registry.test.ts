import assert from "node:assert/strict";
import test from "node:test";
import { ExternalAccountRegistryError, InMemoryExternalAccountRegistry, externalAccountRegistryContract } from "./application/external-account-registry.js";

test("external account metadata defaults to disconnected and consent required", () => {
  let nowCalls = 0;
  const registry = new InMemoryExternalAccountRegistry({ now: () => { nowCalls += 1; return "2026-08-22T00:00:00.000Z"; } });
  const account = registry.register({ providerId: "GitHub", label: "Work account", owner: "Osamah", scopes: ["repo:read"], resourceScope: "workspace:demo" });
  assert.equal(account.providerId, "github");
  assert.equal(account.status, "disconnected");
  assert.equal(account.consentState, "required");
  assert.equal(account.verificationState, "unknown");
  assert.equal(account.resourceScope, "workspace:demo");
  assert.deepEqual(account.scopes, ["repo:read"]);
  assert.equal(account.createdAt, "2026-08-22T00:00:00.000Z");
  assert.equal(nowCalls, 1);
  assert.equal("token" in account, false);
  assert.equal("cookie" in account, false);
});

test("external accounts deduplicate metadata and expose bounded get/list", () => {
  const registry = new InMemoryExternalAccountRegistry({ nextId: (prefix) => `${prefix}-fixed` });
  const first = registry.register({ providerId: "google", label: "Personal", owner: "owner" });
  const duplicate = registry.register({ providerId: "GOOGLE", label: "Personal", owner: "owner", scopes: ["different"] });
  assert.equal(duplicate.accountId, first.accountId);
  assert.equal(registry.get(first.accountId)?.scopes.length, 0);
  assert.equal(registry.list(1).length, 1);
  assert.throws(() => registry.list(0), /limit is invalid/);
  assert.throws(() => registry.get(""), ExternalAccountRegistryError);
});

test("external account registry rejects unsafe metadata and bounds collection", () => {
  const registry = new InMemoryExternalAccountRegistry({ maxAccounts: 1 });
  assert.throws(() => registry.register({ providerId: "github", label: "", owner: "owner" }), /label is invalid/);
  assert.throws(() => registry.register({ providerId: "github", label: "Account", owner: "owner", scopes: ["repo", "repo"] }), /unique/);
  assert.throws(() => registry.register({ providerId: "bad provider", label: "Account", owner: "owner" }), /providerId is invalid/);
  assert.throws(() => registry.register({ providerId: "github", label: "Account", owner: "owner", expiresAt: "not-a-date" }), /expiresAt/);
  registry.register({ providerId: "github", label: "Account", owner: "owner" });
  assert.throws(() => registry.register({ providerId: "google", label: "Account", owner: "owner" }), /limit reached/);
});

export const externalAccountRegistryContractTest = {
  statusAtRegistration: externalAccountRegistryContract.statusAtRegistration,
  consentAtRegistration: externalAccountRegistryContract.consentAtRegistration,
  verificationAtRegistration: externalAccountRegistryContract.verificationAtRegistration,
  performsNetworkCalls: externalAccountRegistryContract.performsNetworkCalls,
  storesSecrets: externalAccountRegistryContract.storesSecrets,
  invokesProviders: externalAccountRegistryContract.invokesProviders,
  requiresHumanGate: externalAccountRegistryContract.requiresHumanGate,
} as const;
