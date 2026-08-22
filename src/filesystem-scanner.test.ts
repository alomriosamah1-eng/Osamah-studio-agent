import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { FilesystemProjectScanner } from "./infrastructure/filesystem-project-scanner.js";

test("filesystem scanner reads fixture files and manifest without executing scripts", async () => {
  const scanner = new FilesystemProjectScanner();
  const root = resolve("fixtures/mobile-expo");
  const files = await scanner.listRelativeFiles(root);
  assert.equal(files.includes("package.json"), true);
  assert.equal(files.includes("app/index.tsx"), true);
  assert.equal(files.includes("node_modules/anything"), false);
  const manifest = await scanner.readJson(root, "package.json");
  assert.equal(manifest?.name, "embedded-preview-fixture");
  const entry = await scanner.readText(root, "app/index.tsx");
  assert.match(entry ?? "", /Build with clarity|PreviewStatus/);
});

test("filesystem scanner rejects unsafe paths", async () => {
  const scanner = new FilesystemProjectScanner();
  const root = resolve("fixtures/mobile-expo");
  await assert.rejects(() => scanner.readText(root, "../package.json"), /escapes root/);
  await assert.rejects(() => scanner.readText(root, "/etc/passwd"), /Unsafe project path/);
});
