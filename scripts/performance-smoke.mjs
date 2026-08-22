import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { createEmbeddedApplication } from "../dist/composition.js";

const fixtureRoot = resolve("fixtures/mobile-expo");
const before = process.memoryUsage();
const startedAt = performance.now();
const application = createEmbeddedApplication();
const classification = await application.generalProjectDetector.detect(fixtureRoot);
const bundle = await application.projectPreviewService.build({ projectId: "performance-smoke", rootPath: fixtureRoot, entry: "app/index.tsx" });
const elapsedMs = performance.now() - startedAt;
const after = process.memoryUsage();
const heapDeltaBytes = after.heapUsed - before.heapUsed;
const rssDeltaBytes = after.rss - before.rss;
const limits = application.resourcePolicy.limits;
const pass = classification.preview === "lightweight_web"
  && bundle.modules.length <= limits.maxPreviewModules
  && bundle.assets.length <= limits.maxPreviewAssets
  && elapsedMs <= 2_000
  && after.heapUsed <= limits.maxMemoryTargetBytes;

console.log(`PERF_PROFILE=${application.resourcePolicy.profile}`);
console.log(`PERF_CLASSIFICATION=${classification.kind}:${classification.preview}`);
console.log(`PERF_PREVIEW_MS=${elapsedMs.toFixed(2)}`);
console.log(`PERF_HEAP_DELTA_BYTES=${heapDeltaBytes}`);
console.log(`PERF_RSS_DELTA_BYTES=${rssDeltaBytes}`);
console.log(`PERF_MODULES=${bundle.modules.length}`);
console.log(`PERF_ASSETS=${bundle.assets.length}`);
console.log(`PERF_MEMORY_TARGET_BYTES=${limits.maxMemoryTargetBytes}`);
console.log(`PERF_SMOKE=${pass ? "PASS" : "FAIL"}`);
if (!pass) process.exitCode = 1;
