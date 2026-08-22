import assert from "node:assert/strict";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { GitReadOnlyError } from "./application/git-read-only.js";
import { FilesystemGitReadOnlyAdapter } from "./infrastructure/git-read-only.js";

const execFileAsync = promisify(execFile);

const runGit = async (rootPath: string, args: readonly string[]): Promise<void> => {
  await execFileAsync("git", ["-C", rootPath, ...args], { shell: false, timeout: 10_000 });
};

const createRepository = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "osamah-git-read-only-"));
  await runGit(root, ["init", "-b", "main"]);
  await runGit(root, ["config", "user.email", "test@example.invalid"]);
  await runGit(root, ["config", "user.name", "Test Fixture"]);
  await writeFile(join(root, "tracked.txt"), "before\n");
  await runGit(root, ["add", "tracked.txt"]);
  await runGit(root, ["commit", "-m", "fixture"]);
  return root;
};

test("Git read-only adapter parses branch and staged/unstaged/untracked state", async () => {
  const root = await createRepository();
  try {
    await writeFile(join(root, "tracked.txt"), "after\n");
    await writeFile(join(root, "staged.txt"), "staged\n");
    await runGit(root, ["add", "staged.txt"]);
    await writeFile(join(root, "untracked.txt"), "untracked\n");
    const adapter = new FilesystemGitReadOnlyAdapter();
    const before = await readFile(join(root, "tracked.txt"), "utf8");
    const status = await adapter.status(root);
    assert.equal(status.isRepository, true);
    assert.equal(status.branch, "main");
    assert.equal(status.staged.some((change) => change.path === "staged.txt" && change.staged), true);
    assert.equal(status.unstaged.some((change) => change.path === "tracked.txt" && !change.staged), true);
    assert.deepEqual(status.untracked, ["untracked.txt"]);
    assert.equal(await readFile(join(root, "tracked.txt"), "utf8"), before);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Git read-only adapter returns bounded diff for the whole tree and selected file", async () => {
  const root = await createRepository();
  try {
    await writeFile(join(root, "tracked.txt"), "after\n");
    const adapter = new FilesystemGitReadOnlyAdapter();
    const whole = await adapter.diff(root);
    assert.equal(whole.rawUnavailable, undefined);
    assert.equal(whole.truncated, false);
    assert.match(whole.patch, /-before/);
    assert.match(whole.patch, /\+after/);
    assert.equal(whole.bytes, Buffer.byteLength(whole.patch, "utf8"));
    const selected = await adapter.diff(root, "tracked.txt");
    assert.equal(selected.relativePath, "tracked.txt");
    assert.match(selected.patch, /tracked\.txt/);
    assert.equal(await readFile(join(root, "tracked.txt"), "utf8"), "after\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Git read-only adapter marks oversized diff as truncated without changing files", async () => {
  const root = await createRepository();
  try {
    const large = `${"x".repeat(20_000)}\n`;
    await writeFile(join(root, "tracked.txt"), large);
    const adapter = new FilesystemGitReadOnlyAdapter({ diffMaxBytes: 4 * 1024 });
    const result = await adapter.diff(root, "tracked.txt");
    assert.equal(result.truncated, true);
    assert.match(result.patch, /output truncated by policy/);
    assert.ok(result.bytes > 0);
    assert.equal(await readFile(join(root, "tracked.txt"), "utf8"), large);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Git read-only adapter fails closed for non-repository roots and unsafe paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "osamah-git-nonrepo-"));
  try {
    const adapter = new FilesystemGitReadOnlyAdapter();
    const status = await adapter.status(root);
    assert.equal(status.isRepository, false);
    assert.equal(status.rawUnavailable, true);
    const diff = await adapter.diff(root);
    assert.equal(diff.rawUnavailable, true);
    await assert.rejects(() => adapter.diff(root, "../outside"), GitReadOnlyError);
    await assert.rejects(() => adapter.diff(root, "/etc/passwd"), GitReadOnlyError);
    await assert.rejects(() => adapter.diff(root, "-p"), GitReadOnlyError);
    await assert.rejects(() => adapter.diff(root, "nested\\file.txt"), GitReadOnlyError);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Git read-only adapter rejects invalid construction bounds", () => {
  assert.throws(() => new FilesystemGitReadOnlyAdapter({ timeoutMs: 100 }), GitReadOnlyError);
  assert.throws(() => new FilesystemGitReadOnlyAdapter({ statusMaxBytes: 1024 }), GitReadOnlyError);
  assert.throws(() => new FilesystemGitReadOnlyAdapter({ diffMaxBytes: 256 * 1024 }), GitReadOnlyError);
  assert.throws(() => new FilesystemGitReadOnlyAdapter({ maxEntries: 0 }), GitReadOnlyError);
});
