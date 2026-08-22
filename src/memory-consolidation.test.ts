import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryMemoryCapture } from "./application/memory-capture.js";
import { InMemoryMemoryConsolidationService, MemoryConsolidationError, memoryConsolidationContract } from "./application/memory-consolidation.js";

const createService = (): { memory: InMemoryMemoryCapture; consolidation: InMemoryMemoryConsolidationService } => {
  let id = 0;
  const sourceRegistry = { getSource: () => undefined };
  const memory = new InMemoryMemoryCapture(sourceRegistry, { nextId: (prefix) => `${prefix}-${++id}`, now: () => "2026-08-22T00:00:00.000Z" });
  const consolidation = new InMemoryMemoryConsolidationService({ memory, ids: { next: (prefix) => `${prefix}-${++id}` }, clock: { now: () => "2026-08-22T00:00:00.000Z" } });
  return { memory, consolidation };
};

test("memory candidates preserve confirmed source provenance and remain private", () => {
  const { memory, consolidation } = createService();
  const source = memory.capture({ kind: "learning", title: "Confirmed learning", content: "A confirmed local learning.", providerAccess: "never" });
  memory.review({ entryId: source.entryId, decision: "confirm", reason: "Owner reviewed locally." });
  const candidate = consolidation.create({ kind: "summary", title: "Learning summary", content: "Summarize the confirmed learning.", sourceEntryIds: [source.entryId], importance: 4 });
  assert.equal(candidate.state, "review_required");
  assert.equal(candidate.visibility, "private");
  assert.equal(candidate.providerAccess, "never");
  assert.deepEqual(candidate.sources.map((item) => item.state), ["confirmed"]);
  assert.deepEqual(candidate.blockedReasons, []);
  assert.equal(memoryConsolidationContract.persistsToDisk, false);
  assert.equal(memoryConsolidationContract.startsEmbeddingIndex, false);
  assert.equal(memoryConsolidationContract.sharesWithProvider, false);
});

test("unconfirmed sources block consolidation until explicit source review exists", () => {
  const { memory, consolidation } = createService();
  const source = memory.capture({ kind: "note", title: "Pending note", content: "A note waiting for review." });
  const candidate = consolidation.create({ kind: "fact", title: "Candidate fact", content: "A fact from the pending note.", sourceEntryIds: [source.entryId] });
  assert.deepEqual(candidate.blockedReasons, ["source_not_confirmed"]);
  assert.equal(consolidation.preview(candidate.candidateId)?.canConsolidate, false);
  assert.throws(() => consolidation.review({ candidateId: candidate.candidateId, decision: "consolidate", reason: "Confirm" }), /blocked reasons/);
});

test("sensitive, secret-shaped, and provider scopes are blocked conservatively", () => {
  const { memory, consolidation } = createService();
  const source = memory.capture({ kind: "decision", title: "Private decision", content: "Owner reviewed a private decision." });
  memory.review({ entryId: source.entryId, decision: "confirm", reason: "Local review." });
  const candidate = consolidation.create({ kind: "decision", title: "Private provider decision", content: "password=hunter2; send this to provider.", sourceEntryIds: [source.entryId], scope: "external-provider" });
  assert.deepEqual(candidate.blockedReasons, ["secret_shaped_content", "scope_escape"]);
  assert.equal(candidate.sensitivity, "secret_shaped");
  assert.throws(() => consolidation.review({ candidateId: candidate.candidateId, decision: "consolidate", reason: "Not allowed" }), MemoryConsolidationError);
});

test("explicit consolidation preserves sources and rollback archives the candidate", () => {
  const { memory, consolidation } = createService();
  const source = memory.capture({ kind: "research", title: "Reviewed research", content: "A bounded research note." });
  memory.review({ entryId: source.entryId, decision: "confirm", reason: "Reviewed." });
  const candidate = consolidation.create({ kind: "procedure", title: "Review procedure", content: "Review a procedure before use.", sourceEntryIds: [source.entryId] });
  const consolidated = consolidation.review({ candidateId: candidate.candidateId, decision: "consolidate", reason: "Owner explicitly consolidated this candidate." });
  assert.equal(consolidated.state, "consolidated");
  assert.deepEqual(consolidated.sourceEntryIds, [source.entryId]);
  assert.equal(memory.get(source.entryId)?.state, "confirmed");
  assert.equal(consolidation.listConsolidated().length, 1);
  const archived = consolidation.review({ candidateId: candidate.candidateId, decision: "rollback", reason: "Remove this consolidation overlay." });
  assert.equal(archived.state, "archived");
  assert.equal(consolidation.listConsolidated().length, 0);
});

test("memory candidate inputs remain bounded and redacted", () => {
  const { memory, consolidation } = createService();
  const source = memory.capture({ kind: "note", title: "Source", content: "Local source." });
  memory.review({ entryId: source.entryId, decision: "confirm", reason: "Reviewed." });
  const candidate = consolidation.create({ kind: "summary", title: "Secret", content: "token=abc123", sourceEntryIds: [source.entryId] });
  assert.equal(candidate.content, "token=[REDACTED]");
  assert.throws(() => consolidation.create({ kind: "summary", title: "Too many", content: "body", sourceEntryIds: [] }), MemoryConsolidationError);
  assert.throws(() => consolidation.create({ kind: "summary", title: "Bad expiry", content: "body", sourceEntryIds: [source.entryId], expiresAt: "not-a-date" }), /expiry/);
});
