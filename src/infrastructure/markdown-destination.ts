import { createHash, randomUUID } from "node:crypto";
import { link, lstat, mkdir, rm, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { MarkdownDestinationWriteInput, MarkdownDestinationManifest, MarkdownDestinationPort } from "../application/markdown-destination.js";

const maxMarkdownBytes = 256 * 1024;
const maxRelativePathLength = 512;
const safeReportId = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,255}$/u;

const isWithin = (parent: string, child: string): boolean => {
  const pathFromParent = relative(resolve(parent), resolve(child));
  return pathFromParent === "" || (!pathFromParent.startsWith(`..${sep}`) && pathFromParent !== ".." && !pathFromParent.includes(`..${sep}`));
};

const assertSeparateRoot = (sourceProfileDirectory: string | undefined, destinationRoot: string): void => {
  if (!sourceProfileDirectory) return;
  if (isWithin(sourceProfileDirectory, destinationRoot) || isWithin(destinationRoot, sourceProfileDirectory)) {
    throw new Error("Markdown destination must be separate from the live profile directory.");
  }
};

const validateRelativeMarkdownPath = (value: string): string => {
  if (typeof value !== "string" || value.length < 1 || value.length > maxRelativePathLength || value.includes("\u0000") || value.includes("\\") || value.startsWith("/") || value.startsWith("~") || value.includes(":")) {
    throw new Error("Markdown destination must be a safe relative path.");
  }
  const segments = value.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) throw new Error("Markdown destination must not contain traversal segments.");
  if (!/\.md$/iu.test(value)) throw new Error("Markdown destination must end with .md.");
  return value;
};

const assertSafeDestinationRoot = (root: string): string => {
  if (typeof root !== "string" || !isAbsolute(root)) throw new Error("Markdown destination root must be absolute.");
  const resolved = resolve(root);
  if (resolved === sep || resolved.length <= 1) throw new Error("Markdown destination root is unsafe.");
  return resolved;
};

const pathExists = async (path: string): Promise<boolean> => {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
};

const assertNoSymlinkRoot = async (root: string): Promise<void> => {
  try {
    const info = await lstat(root);
    if (info.isSymbolicLink()) throw new Error("Markdown destination root must not be a symbolic link.");
    if (!info.isDirectory()) throw new Error("Markdown destination root must be a directory.");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
};

const assertNoSymlinkParents = async (root: string, relativePath: string): Promise<void> => {
  let current = root;
  for (const segment of relativePath.split("/").slice(0, -1)) {
    current = join(current, segment);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink()) throw new Error("Markdown destination contains a symbolic-link parent.");
      if (!info.isDirectory()) throw new Error("Markdown destination parent is not a directory.");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
  }
};

const writeFileNoOverwrite = async (path: string, content: string): Promise<void> => {
  const temporaryPath = `${path}.tmp-${randomUUID()}`;
  try {
    await writeFile(temporaryPath, content, { encoding: "utf8", flag: "wx" });
    await link(temporaryPath, path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("Markdown destination already exists.");
    throw error;
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }
};

const validateInput = (input: MarkdownDestinationWriteInput): void => {
  if (!safeReportId.test(input.reportId) || input.reportId.length > 256) throw new Error("reportId is invalid.");
  validateRelativeMarkdownPath(input.relativePath);
  if (typeof input.content !== "string" || input.content.includes("\u0000") || Buffer.byteLength(input.content, "utf8") > maxMarkdownBytes) throw new Error("Markdown content exceeds bounded limits.");
  if (input.reviewState !== "approved") throw new Error("Only locally approved reports may be written.");
  if (input.redactionState !== "clean" && input.redactionState !== "redacted") throw new Error("Markdown redaction state is invalid.");
  if (typeof input.createdAt !== "string" || input.createdAt.length < 1 || input.createdAt.length > 128 || !Number.isFinite(Date.parse(input.createdAt))) throw new Error("createdAt is invalid.");
  if (input.warnings.length > 64 || input.warnings.some((warning) => typeof warning !== "string" || warning.length > 512 || warning.includes("\u0000"))) throw new Error("Markdown warnings exceed bounded limits.");
};

export interface LocalMarkdownDestinationOptions {
  readonly destinationRoot: string;
  readonly sourceProfileDirectory?: string;
}

export class LocalMarkdownDestinationWriter implements MarkdownDestinationPort {
  private readonly destinationRoot: string;

  public constructor(private readonly options: LocalMarkdownDestinationOptions) {
    this.destinationRoot = assertSafeDestinationRoot(options.destinationRoot);
    assertSeparateRoot(options.sourceProfileDirectory, this.destinationRoot);
  }

  public async write(input: MarkdownDestinationWriteInput): Promise<MarkdownDestinationManifest> {
    validateInput(input);
    const relativePath = validateRelativeMarkdownPath(input.relativePath);
    const targetPath = resolve(this.destinationRoot, relativePath);
    const manifestRelativePath = `${relativePath}.manifest.json`;
    const manifestPath = resolve(this.destinationRoot, manifestRelativePath);
    if (!isWithin(this.destinationRoot, targetPath) || !isWithin(this.destinationRoot, manifestPath)) throw new Error("Markdown destination escaped its root.");

    await assertNoSymlinkRoot(this.destinationRoot);
    await mkdir(this.destinationRoot, { recursive: true });
    await assertNoSymlinkRoot(this.destinationRoot);
    await assertNoSymlinkParents(this.destinationRoot, relativePath);
    await assertNoSymlinkParents(this.destinationRoot, manifestRelativePath);
    if (await pathExists(targetPath) || await pathExists(manifestPath)) throw new Error("Markdown destination already exists.");

    const bytes = Buffer.byteLength(input.content, "utf8");
    const sha256 = createHash("sha256").update(input.content, "utf8").digest("hex");
    const manifest: MarkdownDestinationManifest = {
      formatVersion: 1,
      createdAt: input.createdAt,
      reportId: input.reportId,
      relativePath,
      manifestRelativePath,
      bytes,
      sha256,
      reviewState: input.reviewState,
      redactionState: input.redactionState,
      warnings: [...new Set(input.warnings)].slice(0, 64),
      overwritten: false,
    };

    let artifactWritten = false;
    let manifestWritten = false;
    try {
      await mkdir(dirname(targetPath), { recursive: true });
      await writeFileNoOverwrite(targetPath, input.content);
      artifactWritten = true;
      await writeFileNoOverwrite(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      manifestWritten = true;
      return manifest;
    } catch (error) {
      if (manifestWritten) await rm(manifestPath, { force: true }).catch(() => undefined);
      if (artifactWritten) await rm(targetPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }
}
