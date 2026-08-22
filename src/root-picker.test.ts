import assert from "node:assert/strict";
import { mkdtemp, mkdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { chooseProjectRoot, validateProjectRoot } from "./desktop/root-picker.js";

test("root picker requests a directory and returns its canonical path", async () => {
  const root = await mkdtemp(join(tmpdir(), "osamah-root-picker-"));
  try {
    let properties: readonly ["openDirectory"] | undefined;
    const result = await chooseProjectRoot({
      showOpenDialog: async (options) => {
        properties = options.properties;
        return { canceled: false, filePaths: [root] };
      },
    });
    assert.deepEqual(properties, ["openDirectory"]);
    assert.deepEqual(result, { canceled: false, rootPath: await realpath(root) });
    assert.equal(await validateProjectRoot(root), await realpath(root));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("root picker preserves cancellation and reports empty selections", async () => {
  assert.deepEqual(await chooseProjectRoot({ showOpenDialog: async () => ({ canceled: true, filePaths: [] }) }), { canceled: true });
  assert.deepEqual(await chooseProjectRoot({ showOpenDialog: async () => ({ canceled: false, filePaths: [] }) }), {
    canceled: false,
    error: "NO_DIRECTORY_SELECTED",
    message: "No project directory was selected.",
  });
});

test("root picker rejects non-directory and missing roots without throwing to the renderer", async () => {
  const root = await mkdtemp(join(tmpdir(), "osamah-root-picker-file-"));
  try {
    const invalid = await chooseProjectRoot({ showOpenDialog: async () => ({ canceled: false, filePaths: [join(root, "missing")] }) });
    assert.equal(invalid.canceled, false);
    if (!invalid.canceled && "error" in invalid) {
      assert.equal(invalid.error, "INVALID_ROOT");
      assert.equal(invalid.message, "The selected project root is invalid.");
      assert.doesNotMatch(invalid.message, /osamah-root-picker-file/);
    }
    const filePath = join(root, "file.txt");
    await (await import("node:fs/promises")).writeFile(filePath, "not-a-directory", "utf8");
    const fileResult = await chooseProjectRoot({ showOpenDialog: async () => ({ canceled: false, filePaths: [filePath] }) });
    assert.equal(fileResult.canceled, false);
    if (!fileResult.canceled && "error" in fileResult) {
      assert.equal(fileResult.error, "INVALID_ROOT");
      assert.equal(fileResult.message, "The selected project root is not a directory.");
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
