import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { BackupFileEntry, BackupManifest, BackupProvider } from "../application/ports.js";
import { SqliteDatabase } from "./sqlite.js";

const manifestFileName = "manifest.json";
const databaseFileName = "studio.sqlite";
const manifestFormatVersion = 1 as const;

const sha256File = async (path: string): Promise<{ sha256: string; bytes: number }> => {
  const content = await readFile(path);
  return { sha256: createHash("sha256").update(content).digest("hex"), bytes: content.byteLength };
};

const isSafeBackupRoot = (root: string): boolean => {
  const resolved = resolve(root);
  return resolved !== sep && resolved.length > 1;
};

const assertSeparateRoot = (databasePath: string, destinationRoot: string): void => {
  if (resolve(dirname(databasePath)) === resolve(destinationRoot)) throw new Error("Backup or restore destination must be a separate profile directory.");
};

const assertManifest: (value: unknown) => asserts value is BackupManifest = (value: unknown): asserts value is BackupManifest => {
  if (!value || typeof value !== "object") throw new Error("Backup manifest is not an object.");
  const manifest = value as Partial<BackupManifest>;
  if (manifest.formatVersion !== manifestFormatVersion) throw new Error("Unsupported backup manifest format.");
  if (typeof manifest.createdAt !== "string" || typeof manifest.schemaVersion !== "string" || typeof manifest.databaseSha256 !== "string") throw new Error("Backup manifest metadata is invalid.");
  if (!Array.isArray(manifest.files) || manifest.files.some((file) => !file || typeof file !== "object" || typeof (file as BackupFileEntry).relativePath !== "string" || typeof (file as BackupFileEntry).sha256 !== "string" || typeof (file as BackupFileEntry).bytes !== "number")) throw new Error("Backup manifest files are invalid.");
};

const writeAtomic = async (path: string, content: string | Uint8Array): Promise<void> => {
  const temporaryPath = `${path}.tmp-${randomUUID()}`;
  try {
    await writeFile(temporaryPath, content);
    await rename(temporaryPath, path);
  } finally {
    await rm(temporaryPath, { force: true });
  }
};

const readManifest = async (backupRoot: string): Promise<BackupManifest> => {
  const parsed = JSON.parse(await readFile(join(backupRoot, manifestFileName), "utf8")) as unknown;
  assertManifest(parsed);
  return parsed;
};

const assertRelativeFile = (backupRoot: string, relativePath: string): string => {
  const resolvedRoot = resolve(backupRoot);
  const absolutePath = resolve(resolvedRoot, relativePath);
  const pathFromRoot = relative(resolvedRoot, absolutePath);
  if (!pathFromRoot || pathFromRoot.startsWith(`..${sep}`) || pathFromRoot === ".." || pathFromRoot.includes(`..${sep}`) || pathFromRoot.includes("\\")) throw new Error(`Unsafe backup path: ${relativePath}`);
  return absolutePath;
};

export interface SqliteBackupProviderOptions {
  readonly database: SqliteDatabase;
  readonly databasePath: string;
  readonly migrationsPath: string;
  readonly clock: { now(): string };
}

export class LocalSqliteBackupProvider implements BackupProvider {
  public constructor(private readonly options: SqliteBackupProviderOptions) {}

  public async create(destinationRoot: string): Promise<BackupManifest> {
    if (!isSafeBackupRoot(destinationRoot)) throw new Error("Backup destination is unsafe.");
    assertSeparateRoot(this.options.databasePath, destinationRoot);
    await mkdir(destinationRoot, { recursive: true });
    const databaseDestination = join(destinationRoot, databaseFileName);
    const temporaryDatabaseDestination = `${databaseDestination}.tmp-${randomUUID()}`;
    await rm(temporaryDatabaseDestination, { force: true });
    try {
      this.options.database.snapshot(temporaryDatabaseDestination);
      await rename(temporaryDatabaseDestination, databaseDestination);
    } finally {
      await rm(temporaryDatabaseDestination, { force: true });
    }
    const databaseDigest = await sha256File(databaseDestination);
    const schemaVersion = this.options.database.get<{ value: string }>("SELECT value FROM schema_meta WHERE key = ?", ["schema_version"])?.value;
    if (!schemaVersion) throw new Error("SQLite schema version is missing.");
    const manifest: BackupManifest = {
      formatVersion: manifestFormatVersion,
      createdAt: this.options.clock.now(),
      schemaVersion,
      databaseSha256: databaseDigest.sha256,
      files: [{ relativePath: databaseFileName, sha256: databaseDigest.sha256, bytes: databaseDigest.bytes }],
    };
    await writeAtomic(join(destinationRoot, manifestFileName), `${JSON.stringify(manifest, null, 2)}\n`);
    return manifest;
  }

  public async verify(backupRoot: string): Promise<BackupManifest> {
    if (!isSafeBackupRoot(backupRoot)) throw new Error("Backup root is unsafe.");
    const manifest = await readManifest(backupRoot);
    const databaseEntry = manifest.files.find((file) => file.relativePath === databaseFileName);
    if (!databaseEntry) throw new Error("Backup database entry is missing.");
    const databasePath = assertRelativeFile(backupRoot, databaseEntry.relativePath);
    const digest = await sha256File(databasePath);
    if (digest.sha256 !== databaseEntry.sha256 || digest.sha256 !== manifest.databaseSha256 || digest.bytes !== databaseEntry.bytes) throw new Error("Backup checksum mismatch.");
    const probe = new DatabaseSync(databasePath, { readOnly: true, enableForeignKeyConstraints: true });
    try {
      const schemaVersion = probe.prepare("SELECT value FROM schema_meta WHERE key = ?").get("schema_version") as { value?: unknown } | undefined;
      if (schemaVersion?.value !== manifest.schemaVersion) throw new Error("Backup schema version mismatch.");
      const foreignKeys = probe.prepare("PRAGMA foreign_key_check").all();
      if (foreignKeys.length > 0) throw new Error("Backup foreign key validation failed.");
    } finally {
      probe.close();
    }
    const dryRunPath = `${databasePath}.dry-run-${randomUUID()}`;
    try {
      await writeFile(dryRunPath, await readFile(databasePath), { flag: "wx" });
      const migrationDryRun = new SqliteDatabase({ databasePath: dryRunPath, migrationsPath: this.options.migrationsPath });
      migrationDryRun.close();
    } finally {
      await rm(dryRunPath, { force: true });
    }
    return manifest;
  }

  public async restore(backupRoot: string, destinationRoot: string): Promise<BackupManifest> {
    if (!isSafeBackupRoot(destinationRoot)) throw new Error("Restore destination is unsafe.");
    assertSeparateRoot(this.options.databasePath, destinationRoot);
    const manifest = await this.verify(backupRoot);
    await mkdir(destinationRoot, { recursive: true });
    const restoredPath = join(destinationRoot, databaseFileName);
    const sourcePath = assertRelativeFile(backupRoot, databaseFileName);
    const source = await readFile(sourcePath);
    await writeAtomic(restoredPath, source);
    const restoredDigest = await sha256File(restoredPath);
    if (restoredDigest.sha256 !== manifest.databaseSha256) throw new Error("Restored database checksum mismatch.");
    const restoredManifest = { ...manifest, files: [{ relativePath: databaseFileName, sha256: restoredDigest.sha256, bytes: restoredDigest.bytes }] };
    await writeAtomic(join(destinationRoot, manifestFileName), `${JSON.stringify(restoredManifest, null, 2)}\n`);
    return restoredManifest;
  }
}

export const backupFileName = databaseFileName;
export const backupManifestFileName = manifestFileName;
