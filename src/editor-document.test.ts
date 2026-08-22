import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  createBoundedDiff,
  EditorDocumentConflictError,
  EditorDocumentError,
} from "./application/editor-document.js";
import { ResourcePolicy } from "./application/resource-policy.js";
import { FilesystemWorkspaceFileReader } from "./infrastructure/filesystem-project-explorer.js";
import { InMemoryEditorDocumentStore } from "./infrastructure/in-memory-editor-document.js";

test("bounded diff is deterministic and includes line metadata", () => {
  const result = createBoundedDiff("one\nsame\nold\nend", "one\nsame\nnew\nend");
  assert.equal(result.truncated, false);
  assert.deepEqual(result.lines.map((line) => [line.kind, line.text]), [
    ["equal", "one"],
    ["equal", "same"],
    ["remove", "old"],
    ["add", "new"],
    ["equal", "end"],
  ]);
  assert.equal(result.lines[2]?.beforeLine, 3);
  assert.equal(result.lines[3]?.afterLine, 3);
});

test("bounded diff refuses to pretend completeness after line cap", () => {
  const result = createBoundedDiff("a\nb\nc\nd", "a\nb\nC\nD", { maxLines: 2, maxBytes: 1024 });
  assert.equal(result.lines.length, 2);
  assert.equal(result.truncated, true);
});

test("editor store opens and proposes an in-memory edit without mutating the file", async () => {
  const root = await mkdtemp(join(tmpdir(), "osamah-editor-document-"));
  try {
    await writeFile(join(root, "app.ts"), "const value = 1;\n");
    const reader = new FilesystemWorkspaceFileReader(new ResourcePolicy("low_memory"));
    const store = new InMemoryEditorDocumentStore(reader, new ResourcePolicy("low_memory"), { nextProposalId: () => "proposal-fixed" });
    const opened = await store.open(root, "app.ts");
    assert.ok(opened);
    const proposal = await store.propose(root, "app.ts", "const value = 2;\n", opened.sha256);
    assert.equal(proposal.proposalId, "proposal-fixed");
    assert.equal(proposal.relativePath, "app.ts");
    assert.equal(proposal.before, "const value = 1;\n");
    assert.equal(proposal.after, "const value = 2;\n");
    assert.equal(proposal.expectedSha256, opened.sha256);
    assert.notEqual(proposal.nextSha256, opened.sha256);
    assert.equal((await readFile(join(root, "app.ts"), "utf8")), "const value = 1;\n");
    assert.equal(store.getBuffered(root, "app.ts")?.content, "const value = 2;\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("editor store rejects stale source before producing a proposal", async () => {
  const root = await mkdtemp(join(tmpdir(), "osamah-editor-conflict-"));
  try {
    await writeFile(join(root, "app.ts"), "const value = 1;\n");
    const policy = new ResourcePolicy("low_memory");
    const reader = new FilesystemWorkspaceFileReader(policy);
    const store = new InMemoryEditorDocumentStore(reader, policy, { nextProposalId: () => "proposal-conflict" });
    const opened = await store.open(root, "app.ts");
    assert.ok(opened);
    await writeFile(join(root, "app.ts"), "const value = 3;\n");
    await assert.rejects(store.propose(root, "app.ts", "const value = 2;\n", opened.sha256), EditorDocumentConflictError);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("editor store rejects unsafe paths, NUL content, and oversized content", async () => {
  const root = await mkdtemp(join(tmpdir(), "osamah-editor-guards-"));
  try {
    await writeFile(join(root, "app.ts"), "const value = 1;\n");
    const policy = new ResourcePolicy("low_memory");
    const reader = new FilesystemWorkspaceFileReader(policy);
    const store = new InMemoryEditorDocumentStore(reader, policy, { nextProposalId: () => "proposal-guards" });
    const opened = await store.open(root, "app.ts");
    assert.ok(opened);
    await assert.rejects(store.propose(root, "../app.ts", "const value = 2;\n", opened.sha256), EditorDocumentError);
    await assert.rejects(store.propose(root, "app.ts", "bad\u0000content", opened.sha256), EditorDocumentError);
    await assert.rejects(store.propose(root, "app.ts", "x".repeat(policy.limits.maxTextFileBytes + 1), opened.sha256), EditorDocumentError);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
