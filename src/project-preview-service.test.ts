import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { FilesystemProjectScanner } from "./infrastructure/filesystem-project-scanner.js";
import { FilesystemProjectPreviewService } from "./application/project-preview-service.js";

test("project preview service builds bundle from the fixture root", async () => {
  const service = new FilesystemProjectPreviewService(new FilesystemProjectScanner());
  const bundle = await service.build({ projectId: "filesystem-fixture", rootPath: resolve("fixtures/mobile-expo") });
  assert.equal(bundle.entry, "app/index.tsx");
  assert.equal(bundle.modules.length, 2);
  assert.equal(bundle.root.children?.[0]?.text, "Build with clarity.");
  assert.equal(bundle.warnings.length, 0);
});
