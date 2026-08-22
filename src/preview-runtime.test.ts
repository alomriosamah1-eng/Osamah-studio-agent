import assert from "node:assert/strict";
import test from "node:test";
import { buildProjectPreviewBundle, FixturePreviewRuntime } from "./mobile/preview-runtime.js";

const fixtureFiles = {
  "app/index.tsx": `import { View, Text } from "react-native";\nimport { PreviewStatus } from "../components/PreviewStatus";\nexport default function Home() { return <View><Text>Build with clarity.</Text><PreviewStatus /></View>; }`,
  "components/PreviewStatus.tsx": `import { Text } from "react-native"; export function PreviewStatus() { return <Text>embedded_web / ready</Text>; }`,
  "assets/icon.png": "fixture-bytes",
};

test("builds a deterministic preview bundle from project fixture files", () => {
  const bundle = buildProjectPreviewBundle({ projectId: "fixture", rootPath: "/fixtures/mobile-expo", entry: "app/index.tsx", files: fixtureFiles });
  assert.equal(bundle.entry, "app/index.tsx");
  assert.equal(bundle.modules.length, 2);
  assert.equal(bundle.assets.length, 1);
  assert.equal(bundle.warnings.length, 0);
  assert.equal(bundle.root.children?.[0]?.text, "Build with clarity.");
  const changed = buildProjectPreviewBundle({ projectId: "fixture", rootPath: "/fixtures/mobile-expo", entry: "app/index.tsx", files: { ...fixtureFiles, "app/index.tsx": `${fixtureFiles["app/index.tsx"]}\n// changed` } });
  assert.notEqual(changed.sourceHash, bundle.sourceHash);
});

test("preview rejects module and asset budgets before creating a render tree", () => {
  const moduleFiles: Record<string, string> = { "src/0.tsx": `import Next from "./1"; export default Next;` };
  for (let index = 1; index <= 256; index += 1) {
    moduleFiles[`src/${index}.tsx`] = index === 256 ? "export default null;" : `import Next from "./${index + 1}"; export default Next;`;
  }
  assert.throws(() => buildProjectPreviewBundle({ projectId: "large-modules", rootPath: "/fixtures", entry: "src/0.tsx", files: moduleFiles }), /Preview module budget exceeded/);
  const assetFiles: Record<string, string> = { "app/index.tsx": "export default null;" };
  for (let index = 0; index <= 128; index += 1) assetFiles[`assets/${index}.png`] = "x";
  assert.throws(() => buildProjectPreviewBundle({ projectId: "large-assets", rootPath: "/fixtures", entry: "app/index.tsx", files: assetFiles }), /Preview asset budget exceeded/);
});

test("fixture runtime loads content, receives input, and refreshes with diagnostics", () => {
  const bundle = buildProjectPreviewBundle({ projectId: "fixture", rootPath: "/fixtures/mobile-expo", entry: "app/index.tsx", files: fixtureFiles });
  const runtime = new FixturePreviewRuntime();
  assert.equal(runtime.load(bundle).status, "ready");
  assert.equal(runtime.input({ type: "tap", x: 12, y: 24 }).events.at(-1)?.type, "input_received");
  const refreshed = runtime.refresh(bundle, "fast");
  assert.equal(refreshed.status, "ready");
  assert.equal(refreshed.events.at(-1)?.type, "refresh_completed");
});

test("blocked imports fail before preview execution", () => {
  assert.throws(() => buildProjectPreviewBundle({ projectId: "unsafe", rootPath: "/fixtures", entry: "app/index.tsx", files: { "app/index.tsx": `import fs from "node:fs"; export default function App() { return null; }` } }), /Blocked import/);
  assert.throws(() => buildProjectPreviewBundle({ projectId: "unsafe", rootPath: "/fixtures", entry: "../outside.tsx", files: { "../outside.tsx": "export default null" } }), /Unsafe preview path/);
});
