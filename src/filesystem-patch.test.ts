import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ResourcePolicy } from "./application/resource-policy.js";
import { FilesystemPatchAdapter } from "./infrastructure/filesystem-patch.js";

const sha256 = (content: string): string => createHash("sha256").update(content, "utf8").digest("hex");

const updatePatch = (expectedSha256?: string) => ({
  proposalId: "patch-test",
  operations: [{ relativePath: "src/example.ts", mode: "update" as const, content: "export const value = 2;\n", expectedSha256 }],
});

test("filesystem patch adapter previews and applies create/update operations atomically", async () => {
  const root = await mkdtemp(join(tmpdir(), "osamah-patch-"));
  try {
    const adapter = new FilesystemPatchAdapter(new ResourcePolicy("low_memory"));
    const create = { proposalId: "create", operations: [{ relativePath: "src/new.ts", mode: "create" as const, content: "export const created = true;\n" }] };
    const createValidation = await adapter.preview(root, create);
    assert.equal(createValidation.valid, true);
    await adapter.apply(root, create, createValidation);
    assert.equal(await readFile(join(root, "src", "new.ts"), "utf8"), "export const created = true;\n");

    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src", "example.ts"), "export const value = 1;\n");
    const update = updatePatch(sha256("export const value = 1;\n"));
    const validation = await adapter.preview(root, update);
    assert.equal(validation.valid, true);
    await adapter.apply(root, update, validation);
    assert.equal(await readFile(join(root, "src", "example.ts"), "utf8"), "export const value = 2;\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("filesystem patch adapter refuses stale hashes, traversal, and symlink targets", async () => {
  const root = await mkdtemp(join(tmpdir(), "osamah-patch-safety-"));
  const outside = await mkdtemp(join(tmpdir(), "osamah-patch-outside-"));
  try {
    const adapter = new FilesystemPatchAdapter(new ResourcePolicy("low_memory"));
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src", "example.ts"), "export const value = 1;\n");
    const stale = updatePatch(sha256("old content\n"));
    const staleValidation = await adapter.preview(root, stale);
    assert.equal(staleValidation.valid, false);
    assert.match(staleValidation.reason ?? "", /expected source hash/);

    const valid = updatePatch(sha256("export const value = 1;\n"));
    const validValidation = await adapter.preview(root, valid);
    await writeFile(join(root, "src", "example.ts"), "changed after preview\n");
    await assert.rejects(adapter.apply(root, valid, validValidation), /expected source hash/);

    await assert.rejects(adapter.preview(root, { proposalId: "traversal", operations: [{ relativePath: "../escape.ts", mode: "create", content: "unsafe" }] }), /escapes root/);
    await writeFile(join(outside, "outside.ts"), "outside\n");
    await symlink(join(outside, "outside.ts"), join(root, "src", "link.ts"));
    await assert.rejects(adapter.preview(root, { proposalId: "symlink", operations: [{ relativePath: "src/link.ts", mode: "update", content: "unsafe" }] }), /Symlink/);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});
