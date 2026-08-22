import assert from "node:assert/strict";
import test from "node:test";
import { AgentCatalogError, InMemoryAgentCatalog, agentCatalogContract, defaultAgentDefinitions, validateAgentDefinition } from "./application/agent-catalog.js";

test("default agent catalog exposes the 46 roles with explicit execution status", () => {
  const catalog = new InMemoryAgentCatalog();
  assert.equal(catalog.list(64).length, 46);
  assert.equal(new Set(catalog.list(64).map((definition) => definition.agentId)).size, 46);
  assert.equal(catalog.get("api-architect")?.executionStatus, "bounded_capability");
  assert.equal(catalog.get("market-research")?.executionStatus, "not_implemented");
  assert.equal(catalog.get("ceo-master-orchestrator")?.executionStatus, "definition_only");
});

test("agent definitions carry bounded mission, handoff, privacy, and approval fields", () => {
  const catalog = new InMemoryAgentCatalog();
  const definition = catalog.get("security");
  assert.ok(definition);
  assert.equal(definition?.schemaVersion, 1);
  assert.equal(definition?.handoffProtocol, "handoff.v1.reviewable_packet");
  assert.deepEqual(definition?.memoryRequirements, { visibility: "private", retention: "session", providerAccess: "never" });
  assert.ok(definition?.validationCriteria.includes("evidence_present"));
  assert.ok(definition?.humanApprovalRequirements.includes("github.push"));
  assert.deepEqual(agentCatalogContract, {
    mutatesFilesystem: false,
    executesCommands: false,
    invokesProviders: false,
    requiresHumanGateForMutation: true,
    executionStatusIsExplicit: true,
  });
});

test("catalog list is bounded and get fails closed for unsafe identifiers", () => {
  const catalog = new InMemoryAgentCatalog();
  assert.equal(catalog.list(2).length, 2);
  assert.equal(catalog.get("../secret"), undefined);
  assert.equal(catalog.get("Agent_Admin"), undefined);
  assert.throws(() => catalog.list(0), (error: unknown) => error instanceof AgentCatalogError);
  assert.throws(() => catalog.list(65), (error: unknown) => error instanceof AgentCatalogError);
});

test("catalog rejects duplicate IDs and invalid definition fields before storage", () => {
  const first = defaultAgentDefinitions[0]!;
  assert.throws(() => new InMemoryAgentCatalog([first, first]), /duplicate agent IDs/);
  assert.throws(() => validateAgentDefinition({ ...first, agentId: "../unsafe" }), /safe lowercase identifier/);
  assert.throws(() => validateAgentDefinition({ ...first, responsibilities: ["same", "same"] }), /contains duplicates/);
  assert.throws(() => validateAgentDefinition({ ...first, memoryRequirements: { ...first.memoryRequirements, providerAccess: "always" as never } }), /provider access/);
});
