import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ResourcePolicy } from "./application/resource-policy.js";
import { FilesystemProjectContextIndex } from "./application/project-context.js";
import { FilesystemProjectScanner } from "./infrastructure/filesystem-project-scanner.js";
import { GitStatusAdapter } from "./infrastructure/git-status.js";

const createIndex = () => {
  const resourcePolicy = new ResourcePolicy("low_memory");
  const scanner = new FilesystemProjectScanner({ limits: resourcePolicy.limits });
  return new FilesystemProjectContextIndex(scanner, new GitStatusAdapter(), resourcePolicy, () => "2026-08-22T00:00:00.000Z");
};

test("context index summarizes package manifest, files, and a non-repository root", async () => {
  const root = await mkdtemp(join(tmpdir(), "osamah-context-"));
  try {
    await mkdir(join(root, "src"));
    await mkdir(join(root, "node_modules"));
    await writeFile(join(root, "package.json"), JSON.stringify({ name: "context-fixture", version: "1.0.0", packageManager: "pnpm@11", dependencies: { react: "latest" }, devDependencies: { typescript: "latest" } }));
    await writeFile(join(root, "src", "index.ts"), "export const answer = 42;\n");
    await writeFile(join(root, "node_modules", "ignored.js"), "should not be indexed");
    const index = createIndex();
    const snapshot = await index.build(root);
    assert.equal(snapshot.generatedAt, "2026-08-22T00:00:00.000Z");
    assert.deepEqual(snapshot.files.map((file) => file.relativePath), ["package.json", "src/index.ts"]);
    assert.deepEqual(snapshot.manifests[0], {
      relativePath: "package.json",
      kind: "package.json",
      name: "context-fixture",
      version: "1.0.0",
      packageManager: "pnpm@11",
      dependencyNames: ["react", "typescript"],
    });
    assert.equal(snapshot.git.isRepository, false);
    assert.equal(snapshot.git.rawUnavailable, true);
    const targeted = await index.readTargeted(root, ["src/index.ts", "src/index.ts"]);
    assert.equal(targeted.length, 1);
    assert.equal(targeted[0]?.bytes, Buffer.byteLength("export const answer = 42;\n"));
    assert.match(targeted[0]?.sha256 ?? "", /^[a-f0-9]{64}$/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("context index rejects traversal and oversized targeted context", async () => {
  const root = await mkdtemp(join(tmpdir(), "osamah-context-budget-"));
  try {
    await writeFile(join(root, "large.txt"), "x".repeat(512 * 1024 + 1));
    const index = createIndex();
    await assert.rejects(index.readTargeted(root, ["../outside.txt"]), /escapes root/);
    await assert.rejects(index.readTargeted(root, ["large.txt"]), /budget exceeded/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
