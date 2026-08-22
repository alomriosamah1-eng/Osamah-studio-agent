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
