import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { sanitizeAuditText, type AuditExportManifest, type AuditExportProvider, type AuditRecord, type AuditTrail } from "../application/agent-contracts.js";

const exportFileName = "audit.ndjson" as const;
const manifestFileName = "manifest.json";
const maximumRecords = 256;
const manifestFormatVersion = 1 as const;

const isSafeExportRoot = (root: string): boolean => {
  const resolved = resolve(root);
  return resolved !== sep && resolved.length > 1;
};

const isWithin = (parent: string, child: string): boolean => {
  const pathFromParent = relative(resolve(parent), resolve(child));
  return pathFromParent === "" || (!pathFromParent.startsWith(`..${sep}`) && pathFromParent !== ".." && !pathFromParent.includes(`..${sep}`));
};

const assertSeparateExportRoot = (sourceProfileDirectory: string | undefined, destinationRoot: string): void => {
  if (!sourceProfileDirectory) return;
  if (isWithin(sourceProfileDirectory, destinationRoot) || isWithin(destinationRoot, sourceProfileDirectory)) {
    throw new Error("Audit export destination must be separate from the live profile directory.");
  }
};

const boundedLimit = (limit: number | undefined): number => {
  const candidate = limit ?? maximumRecords;
  if (!Number.isFinite(candidate) || candidate < 1) throw new Error("Audit export limit must be positive.");
  return Math.min(Math.floor(candidate), maximumRecords);
};

const writeAtomic = async (path: string, content: string): Promise<void> => {
  const temporaryPath = `${path}.tmp-${randomUUID()}`;
  try {
    await writeFile(temporaryPath, content, { encoding: "utf8", flag: "wx" });
    await rename(temporaryPath, path);
  } finally {
    await rm(temporaryPath, { force: true });
  }
};

const exportRecord = (record: AuditRecord): AuditRecord => ({
  ...record,
  scope: sanitizeAuditText(record.scope, 512),
  reason: sanitizeAuditText(record.reason, 1024),
});

export interface LocalAuditExportProviderOptions {
  readonly trail: AuditTrail;
  readonly clock: { now(): string };
  readonly sourceProfileDirectory?: string;
}

export class LocalAuditExportProvider implements AuditExportProvider {
  public constructor(private readonly options: LocalAuditExportProviderOptions) {}

  public async create(destinationRoot: string, limit?: number): Promise<AuditExportManifest> {
    if (!isSafeExportRoot(destinationRoot)) throw new Error("Audit export destination is unsafe.");
    assertSeparateExportRoot(this.options.sourceProfileDirectory, destinationRoot);
    await mkdir(destinationRoot, { recursive: true });
    const records = this.options.trail.list(boundedLimit(limit)).map(exportRecord);
    const content = records.map((record) => JSON.stringify(record)).join("\n") + (records.length > 0 ? "\n" : "");
    const destinationPath = resolve(destinationRoot, exportFileName);
    await writeAtomic(destinationPath, content);
    const bytes = (await readFile(destinationPath)).byteLength;
    const sha256 = createHash("sha256").update(content, "utf8").digest("hex");
    const manifest: AuditExportManifest = {
      formatVersion: manifestFormatVersion,
      createdAt: this.options.clock.now(),
      recordCount: records.length,
      bytes,
      sha256,
      relativePath: exportFileName,
    };
    await writeAtomic(resolve(destinationRoot, manifestFileName), `${JSON.stringify(manifest, null, 2)}\n`);
    return manifest;
  }
}
