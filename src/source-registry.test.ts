import assert from "node:assert/strict";
import test from "node:test";
import { InMemorySourceRegistry, SourceRegistryError } from "./application/source-registry.js";

test("source registry registers bounded metadata and deduplicates the same source", () => {
  const registry = new InMemorySourceRegistry({ now: () => "2026-08-22T00:00:00.000Z" });
  const first = registry.registerSource({ kind: "user_url", locator: "https://example.test/report", title: "apiKey=hidden report", verificationState: "metadata_validated" });
  const duplicate = registry.registerSource({ kind: "user_url", locator: "https://example.test/report", title: "different title", verificationState: "unverified" });
  assert.equal(first.sourceId, duplicate.sourceId);
  assert.equal(first.title, "apiKey=[REDACTED] report");
  assert.equal(registry.listSources().length, 1);
});

test("source registry requires hash and bytes for content validation", () => {
  const registry = new InMemorySourceRegistry();
  assert.throws(
    () => registry.registerSource({ kind: "local_file", locator: "workspace://report.md", verificationState: "content_validated" }),
    (error: unknown) => error instanceof SourceRegistryError && error.message.includes("bytes and sha256"),
  );
  const source = registry.registerSource({ kind: "local_file", locator: "workspace://report.md", bytes: 12, sha256: "A".repeat(64), verificationState: "content_validated" });
  assert.equal(source.sha256, "a".repeat(64));
});

test("source registry links citations and provenance only to known entities", () => {
  const registry = new InMemorySourceRegistry();
  const source = registry.registerSource({ kind: "workspace_document", locator: "workspace://brief.md", title: "Brief" });
  const citation = registry.addCitation({ sourceId: source.sourceId, label: "Brief paragraph", span: { start: 0, end: 20 }, quotePreview: "bounded quote", verificationState: "unverified" });
  const link = registry.addProvenanceLink({ fromId: citation.citationId, toId: source.sourceId, relation: "derived_from", evidence: ["user-provided citation"] });
  assert.equal(registry.listCitations(source.sourceId)[0]?.citationId, citation.citationId);
  assert.equal(registry.listProvenanceLinks(source.sourceId)[0]?.linkId, link.linkId);
  assert.throws(() => registry.addCitation({ sourceId: "missing", label: "No source" }), SourceRegistryError);
  assert.throws(() => registry.addProvenanceLink({ fromId: source.sourceId, toId: "missing", relation: "used" }), SourceRegistryError);
});

test("source registry rejects invalid spans, pages, and unbounded warnings", () => {
  const registry = new InMemorySourceRegistry();
  const source = registry.registerSource({ kind: "generated_artifact", locator: "artifact://draft" });
  assert.throws(() => registry.addCitation({ sourceId: source.sourceId, label: "Bad span", span: { start: 10, end: 1 } }), SourceRegistryError);
  assert.throws(() => registry.addCitation({ sourceId: source.sourceId, label: "Bad page", page: 0 }), SourceRegistryError);
  assert.throws(() => registry.registerSource({ kind: "user_url", locator: "https://example.test", warnings: Array.from({ length: 17 }, () => "warning") }), SourceRegistryError);
});
