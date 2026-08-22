import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildProjectTree, normalizeWorkspaceRelativePath, ProjectExplorerError, WorkspaceFileReaderError, workspaceFileContent } from "./application/project-explorer.js";
import { ResourcePolicy } from "./application/resource-policy.js";
import { FilesystemProjectExplorer, FilesystemWorkspaceFileReader } from "./infrastructure/filesystem-project-explorer.js";

const policy = new ResourcePolicy("low_memory");

 test("project tree is deterministic, directories precede files, and unsafe entries are skipped", () => {
  const tree = buildProjectTree(["package.json", "src/z.ts", "src/a.ts", "src/nested/item.ts", "../secret.txt", "src/a.ts"], 16);
  assert.equal(tree.fileCount, 4);
  assert.equal(tree.truncated, false);
  assert.equal(tree.root.children?.map((child) => `${child.kind}:${child.name}`).join(","), "directory:src,file:package.json");
  assert.equal(tree.root.children?.[0]?.children?.map((child) => child.name).join(","), "nested,a.ts,z.ts");
  assert.equal(tree.warnings.length, 1);
  assert.throws(() => normalizeWorkspaceRelativePath("../secret.txt"), WorkspaceFileReaderError);
  assert.throws(() => normalizeWorkspaceRelativePath("/etc/passwd"), WorkspaceFileReaderError);
});

test("workspace file content exposes bounded UTF-8 bytes and deterministic sha256", () => {
  const value = workspaceFileContent("src/app.ts", "export const value = 1;\n");
  assert.equal(value.relativePath, "src/app.ts");
  assert.equal(value.bytes, Buffer.byteLength(value.content, "utf8"));
  assert.equal(value.sha256.length, 64);
  assert.equal(value.truncated, false);
});

test("filesystem explorer ignores heavy directories, symlinks, and bounds tree output", async () => {
  const root = await mkdtemp(join(tmpdir(), "osamah-project-explorer-"));
  try {
    await mkdir(join(root, "src"));
    await mkdir(join(root, "node_modules"));
    await writeFile(join(root, "package.json"), "{}\n");
    await writeFile(join(root, "src", "app.ts"), "export const app = true;\n");
    await writeFile(join(root, "node_modules", "ignored.js"), "ignored\n");
    await symlink(join(root, "src", "app.ts"), join(root, "linked.ts"));
    const explorer = new FilesystemProjectExplorer(new ResourcePolicy("low_memory"));
    const result = await explorer.list(root);
    assert.equal(result.fileCount, 2);
    assert.equal(result.root.children?.some((child) => child.name === "node_modules"), false);
    assert.equal(result.root.children?.some((child) => child.name === "linked.ts"), false);
    assert.equal(result.warnings.length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("filesystem reader reads text with hash and rejects traversal, symlink, binary, and oversized files", async () => {
  const root = await mkdtemp(join(tmpdir(), "osamah-file-reader-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src", "app.ts"), "export const app = true;\n");
    await writeFile(join(root, "binary.bin"), Buffer.from([0, 1, 2, 3]));
    await writeFile(join(root, ".env"), "API_KEY=should-not-be-opened\n");
    await writeFile(join(root, "large.txt"), Buffer.alloc(policy.limits.maxTextFileBytes + 1, 97));
    await symlink(join(root, "src", "app.ts"), join(root, "linked.ts"));
    const reader = new FilesystemWorkspaceFileReader(policy);
    const value = await reader.readText(root, "src/app.ts");
    assert.ok(value);
    assert.equal(value.content, "export const app = true;\n");
    assert.equal(value.relativePath, "src/app.ts");
    assert.equal((await reader.readText(root, "linked.ts")), undefined);
    assert.equal((await reader.readText(root, "binary.bin")), undefined);
    assert.equal((await reader.readText(root, ".env")), undefined);
    assert.equal((await reader.readText(root, "large.txt")), undefined);
    await assert.rejects(reader.readText(root, "../secret.txt"), WorkspaceFileReaderError);
    await assert.rejects(reader.readText(join(root, "missing"), "src/app.ts"), WorkspaceFileReaderError);
    assert.equal(await readFile(join(root, "src", "app.ts"), "utf8"), value.content);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("filesystem explorer surfaces invalid roots as bounded domain errors", async () => {
  const explorer = new FilesystemProjectExplorer(policy);
  await assert.rejects(explorer.list(join(tmpdir(), "osamah-root-does-not-exist")), ProjectExplorerError);
});
