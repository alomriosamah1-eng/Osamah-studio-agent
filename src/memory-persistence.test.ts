import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createEmbeddedApplication } from "./composition.js";
import type { MemoryCandidate } from "./application/memory-consolidation.js";
import type { MemoryEntry } from "./application/memory-capture.js";
import type { IpcResponse } from "./ipc/contracts.js";

const migrationsPath = join(process.cwd(), "db", "migrations");

test("embedded sqlite application reloads memory entries and candidates across restart", async () => {
  const root = mkdtempSync(join(tmpdir(), "osamah-studio-memory-profile-"));
  const databasePath = join(root, "studio.sqlite");
  const storage = { kind: "sqlite", databasePath, migrationsPath, allowFallback: false } as const;
  const first = createEmbeddedApplication({ storage });
  let entryId = "";
  let linkedEntryId = "";
  let candidateId = "";
  try {
    const captured = await first.ipc.dispatch({ protocolVersion: 1, requestId: "persist-memory-capture", correlationId: "persist-memory", method: "brain.memory.capture", payload: { kind: "learning", title: "Persistent learning", content: "تعلم محلي bounded.", tags: ["restart"], providerAccess: "never", visibility: "private", retention: "until_deleted" } } as const) as IpcResponse<MemoryEntry>;
    assert.equal(captured.ok, true);
    if (!captured.ok) return;
    entryId = captured.result.entryId;
    const linkedCapture = await first.ipc.dispatch({ protocolVersion: 1, requestId: "persist-memory-linked-capture", correlationId: "persist-memory", method: "brain.memory.capture", payload: { kind: "note", title: "Linked local note", content: "A linked note.", links: [{ entryId, relation: "supports" }] } } as const) as IpcResponse<MemoryEntry>;
    assert.equal(linkedCapture.ok, true);
    if (!linkedCapture.ok) return;
    linkedEntryId = linkedCapture.result.entryId;
    const reviewed = await first.ipc.dispatch({ protocolVersion: 1, requestId: "persist-memory-review", correlationId: "persist-memory", method: "brain.memory.review", payload: { entryId, decision: "confirm", reason: "Reviewed locally before restart." } } as const) as IpcResponse<MemoryEntry>;
    assert.equal(reviewed.ok, true);
    if (!reviewed.ok) return;
    const candidate = await first.ipc.dispatch({ protocolVersion: 1, requestId: "persist-candidate-create", correlationId: "persist-memory", method: "memory-candidate.create", payload: { kind: "summary", title: "Persistent summary", content: "A summary of the confirmed learning.", sourceEntryIds: [entryId], scope: "second-brain" } } as const) as IpcResponse<MemoryCandidate>;
    assert.equal(candidate.ok, true);
    if (!candidate.ok) return;
    candidateId = candidate.result.candidateId;
    const consolidated = await first.ipc.dispatch({ protocolVersion: 1, requestId: "persist-candidate-review", correlationId: "persist-memory", method: "memory-candidate.review", payload: { candidateId, decision: "consolidate", reason: "Reviewed locally before restart." } } as const) as IpcResponse<MemoryCandidate>;
    assert.equal(consolidated.ok, true);
    if (!consolidated.ok) return;
    assert.equal(consolidated.result.state, "consolidated");
  } finally {
    first.close();
  }
  const second = createEmbeddedApplication({ storage });
  try {
    const entries = await second.ipc.dispatch({ protocolVersion: 1, requestId: "persist-memory-list", correlationId: "persist-memory-restart", method: "brain.memory.list", payload: { limit: 8 } } as const) as IpcResponse<readonly MemoryEntry[]>;
    assert.equal(entries.ok, true);
    if (!entries.ok) return;
    assert.equal(entries.result.some((entry) => entry.entryId === entryId && entry.state === "confirmed"), true);
    assert.equal(entries.result.some((entry) => entry.entryId === linkedEntryId && entry.links.some((link) => link.entryId === entryId && link.relation === "supports")), true);
    const matches = await second.ipc.dispatch({ protocolVersion: 1, requestId: "persist-memory-search", correlationId: "persist-memory-restart", method: "brain.memory.searchLocal", payload: { query: "تعلم محلي", limit: 8 } } as const) as IpcResponse<readonly MemoryEntry[]>;
    assert.equal(matches.ok, true);
    if (!matches.ok) return;
    assert.equal(matches.result.some((entry) => entry.entryId === entryId), true);
    const invalidFilter = await second.ipc.dispatch({ protocolVersion: 1, requestId: "persist-memory-invalid-filter", correlationId: "persist-memory-restart", method: "brain.memory.searchLocal", payload: { query: "تعلم", visibility: "shared" as never } } as const);
    assert.equal(invalidFilter.ok, false);
    const candidates = await second.ipc.dispatch({ protocolVersion: 1, requestId: "persist-candidate-list", correlationId: "persist-memory-restart", method: "memory-candidate.list", payload: { limit: 8 } } as const) as IpcResponse<readonly MemoryCandidate[]>;
    assert.equal(candidates.ok, true);
    if (!candidates.ok) return;
    assert.equal(candidates.result.some((candidate) => candidate.candidateId === candidateId && candidate.state === "consolidated"), true);
  } finally {
    second.close();
    rmSync(root, { recursive: true, force: true });
  }
});
