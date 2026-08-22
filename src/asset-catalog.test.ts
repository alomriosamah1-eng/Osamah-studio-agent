import assert from "node:assert/strict";
import test from "node:test";
import { AssetCatalogError, InMemoryAssetCatalog } from "./application/asset-catalog.js";
import { InMemorySourceRegistry } from "./application/source-registry.js";

const verifiedHash = "a".repeat(64);

test("asset catalog registers bounded metadata and deduplicates the same locator/hash", () => {
  const sources = new InMemorySourceRegistry();
  const source = sources.registerSource({ kind: "user_url", locator: "https://example.test/asset", verificationState: "metadata_validated" });
  const catalog = new InMemoryAssetCatalog(sources);
  const request = {
    kind: "image" as const,
    title: "Hero image",
    locator: "https://example.test/hero.png",
    mediaType: "image/png",
    bytes: 2048,
    sha256: verifiedHash,
    license: { name: "CC BY 4.0", attribution: "Author", state: "declared" as const, warnings: [] },
    sourceIds: [source.sourceId],
  };
  const first = catalog.registerAsset(request);
  const second = catalog.registerAsset(request);
  assert.equal(first.assetId, second.assetId);
  assert.ok(first.warnings.includes("asset_source_unverified"));
  assert.equal(catalog.listAssets().length, 1);
});

test("asset catalog rejects unknown source, invalid hash/bytes, unsafe locator, and oversized metadata", () => {
  const sources = new InMemorySourceRegistry();
  const catalog = new InMemoryAssetCatalog(sources);
  const base = { kind: "document" as const, title: "Notes", locator: "workspace://notes.md", license: { name: "Declared", state: "declared" as const, warnings: [] } };
  assert.throws(() => catalog.registerAsset({ ...base, sourceIds: ["missing"] }), AssetCatalogError);
  assert.throws(() => catalog.registerAsset({ ...base, sha256: "bad" }), AssetCatalogError);
  assert.throws(() => catalog.registerAsset({ ...base, bytes: 128 * 1024 * 1024 + 1 }), AssetCatalogError);
  assert.throws(() => catalog.registerAsset({ ...base, locator: "workspace://../secret" }), AssetCatalogError);
  assert.throws(() => catalog.registerAsset({ ...base, title: "\u0000secret" }), AssetCatalogError);
});

test("creative brief attaches allowed assets with explicit license/provenance warnings", () => {
  const sources = new InMemorySourceRegistry();
  const source = sources.registerSource({ kind: "user_url", locator: "https://example.test/license", verificationState: "unverified" });
  const catalog = new InMemoryAssetCatalog(sources);
  const asset = catalog.registerAsset({ kind: "audio", title: "Theme", locator: "https://example.test/theme.mp3", license: { name: "Unknown", state: "unverified", warnings: [] }, sourceIds: [source.sourceId] });
  const brief = catalog.createBrief({ title: "Launch brief", intent: "Define a calm launch mood", constraints: ["Do not imply final license approval"], assetSlots: ["theme"] });
  assert.ok(brief.warnings.includes("asset_slots_unfilled"));
  const attached = catalog.attachAsset({ briefId: brief.briefId, assetId: asset.assetId });
  assert.deepEqual(attached.assetIds, [asset.assetId]);
  assert.ok(attached.warnings.includes("asset_license_unverified"));
  assert.ok(attached.warnings.includes("asset_has_provenance_warning"));
});

test("creative brief blocks blocked assets and duplicate attachments", () => {
  const sources = new InMemorySourceRegistry();
  const catalog = new InMemoryAssetCatalog(sources);
  const asset = catalog.registerAsset({ kind: "video", title: "Blocked clip", locator: "workspace://blocked.mp4", license: { name: "Restricted", state: "blocked", warnings: [] } });
  const brief = catalog.createBrief({ title: "Video brief", intent: "Review a clip" });
  assert.throws(() => catalog.attachAsset({ briefId: brief.briefId, assetId: asset.assetId }), AssetCatalogError);
  const allowed = catalog.registerAsset({ kind: "video", title: "Allowed clip", locator: "workspace://allowed.mp4", license: { name: "Declared", state: "declared", warnings: [] } });
  const attached = catalog.attachAsset({ briefId: brief.briefId, assetId: allowed.assetId });
  assert.throws(() => catalog.attachAsset({ briefId: brief.briefId, assetId: allowed.assetId }), AssetCatalogError);
  assert.equal(attached.assetIds.length, 1);
});
