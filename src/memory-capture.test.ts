import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryMemoryCapture, MemoryCaptureError } from "./application/memory-capture.js";
import { InMemorySourceRegistry } from "./application/source-registry.js";

test("memory capture creates a review-required redacted entry with explicit privacy defaults", () => {
  const sources = new InMemorySourceRegistry({ now: () => "2026-08-22T12:00:00.000Z", nextId: (prefix) => `${prefix}-1` });
  const source = sources.registerSource({ kind: "workspace_document", locator: "studio://doc/one", bytes: 10, sha256: "a".repeat(64), verificationState: "content_validated" });
  const memory = new InMemoryMemoryCapture(sources, { now: () => "2026-08-22T12:01:00.000Z", nextId: (prefix) => `${prefix}-1` });
  const entry = memory.capture({ kind: "research", title: "Local finding", content: "token=super-secret\nThe evidence is reviewable.", provenance: [{ kind: "source", id: source.sourceId, relation: "derived_from" }], tags: ["research", "local"] });
  assert.equal(entry.state, "review_required");
  assert.equal(entry.visibility, "private");
  assert.equal(entry.providerAccess, "never");
  assert.equal(entry.retention, "session");
  assert.match(entry.content, /token=\[REDACTED\]/);
  assert.doesNotMatch(entry.content, /super-secret/);
  assert.ok(entry.warnings.includes("provider_access_never"));
  assert.equal(entry.provenance[0]?.id, source.sourceId);
  assert.equal(entry.createdAt, "2026-08-22T12:01:00.000Z");
});

test("memory capture searches bounded local entries and deduplicates identical captures", () => {
  const sources = new InMemorySourceRegistry();
  const memory = new InMemoryMemoryCapture(sources, { nextId: (prefix) => `${prefix}-${Math.random()}` });
  const first = memory.capture({ kind: "note", title: "Offline plan", content: "Keep the provider offline and bounded.", tags: ["offline"] });
  const duplicate = memory.capture({ kind: "note", title: "Offline plan", content: "Keep the provider offline and bounded.", tags: ["offline"] });
  assert.equal(duplicate.entryId, first.entryId);
  assert.equal(memory.list(8).length, 1);
  assert.equal(memory.searchLocal("provider", 8)[0]?.entryId, first.entryId);
  assert.equal(memory.searchLocal("offline", 8)[0]?.entryId, first.entryId);
  assert.deepEqual(memory.searchLocal("missing", 8), []);
});

test("memory local retrieval normalizes Arabic text and ranks title/tag matches deterministically", () => {
  const memory = new InMemoryMemoryCapture(new InMemorySourceRegistry(), { now: (() => { let index = 0; return () => `2026-08-22T12:0${index++}:00.000Z`; })(), nextId: (prefix) => `${prefix}-retrieval` });
  const contentMatch = memory.capture({ kind: "note", title: "ملاحظة عامة", content: "هذه خطة العمل المحلية.", tags: ["offline"] });
  const titleMatch = memory.capture({ kind: "decision", title: "خُطَّة العمل", content: "قرار محلي.", tags: ["local"] });
  assert.equal(memory.searchLocal("خطة العمل", 8)[0]?.entryId, titleMatch.entryId);
  assert.equal(memory.searchLocal("خطة العمل", 8).some((entry) => entry.entryId === contentMatch.entryId), true);
  assert.deepEqual(memory.searchLocal("خطة غائبة", 8), []);
});

test("memory capture rejects unknown source provenance and unsafe or duplicate references", () => {
  const sources = new InMemorySourceRegistry();
  const memory = new InMemoryMemoryCapture(sources);
  assert.throws(() => memory.capture({ kind: "note", title: "Unknown", content: "Review", provenance: [{ kind: "source", id: "missing", relation: "supports" }] }), /unknown/);
  assert.throws(() => memory.capture({ kind: "note", title: "Duplicate refs", content: "Review", provenance: [{ kind: "artifact", id: "artifact-1", relation: "related_to" }, { kind: "artifact", id: "artifact-1", relation: "related_to" }] }), /unique/);
  assert.throws(() => memory.capture({ kind: "note", title: "Bad", content: "Review", tags: ["same", "same"] }), /unique/);
  assert.throws(() => memory.capture({ kind: "note", title: "Bad", content: "Review", provenance: [{ kind: "task", id: "../escape", relation: "related_to" }] }), MemoryCaptureError);
});

test("memory capture preserves review-only state and enforces bounded limits", () => {
  const sources = new InMemorySourceRegistry();
  const memory = new InMemoryMemoryCapture(sources, { maxEntries: 1, maxContentLength: 12 });
  const first = memory.capture({ kind: "idea", title: "Small", content: "bounded text" });
  assert.equal(first.state, "review_required");
  assert.throws(() => memory.capture({ kind: "idea", title: "Second", content: "another text" }), /capacity/);
  assert.throws(() => memory.searchLocal("", 8), /query/);
  assert.throws(() => memory.list(129), /limit/);
  assert.throws(() => new InMemoryMemoryCapture(sources, { maxContentLength: 65 * 1024 }), /maxContentLength/);
});

test("memory review explicitly confirms or archives entries without changing provider access", () => {
  const sources = new InMemorySourceRegistry();
  const memory = new InMemoryMemoryCapture(sources, { now: () => "2026-08-22T13:00:00.000Z", nextId: (prefix) => `${prefix}-review` });
  const entry = memory.capture({ kind: "decision", title: "Reviewed decision", content: "Keep local-only memory.", providerAccess: "never", visibility: "private", retention: "project" });
  const confirmed = memory.review({ entryId: entry.entryId, decision: "confirm", reason: "I reviewed this local decision." });
  assert.equal(confirmed.state, "confirmed");
  assert.equal(confirmed.providerAccess, "never");
  assert.equal(confirmed.retention, "project");
  assert.equal(confirmed.reviewReason, "I reviewed this local decision.");
  assert.equal(confirmed.reviewedAt, "2026-08-22T13:00:00.000Z");
  assert.ok(confirmed.warnings.includes("user_confirmed_not_externally_verified"));
  assert.equal(memory.listForReview(8).length, 0);

  const archivedEntry = memory.capture({ kind: "note", title: "Archive me", content: "Not needed now." });
  const archived = memory.review({ entryId: archivedEntry.entryId, decision: "archive", reason: "No longer needed for active review." });
  assert.equal(archived.state, "archived");
  assert.equal(memory.listForReview(8).length, 0);
  assert.throws(() => memory.review({ entryId: archived.entryId, decision: "confirm", reason: "Too late." }), /archived/);
  assert.throws(() => memory.review({ entryId: entry.entryId, decision: "confirm", reason: "" }), /reviewReason/);
});
