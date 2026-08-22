import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import type { PatchOperation, PatchPort, PatchProposal, PatchValidation } from "../application/agent-work-cycle.js";
import type { ResourcePolicy } from "../application/resource-policy.js";

const sha256 = (content: string): string => createHash("sha256").update(content, "utf8").digest("hex");

export class FilesystemPatchAdapter implements PatchPort {
  public constructor(private readonly resourcePolicy: ResourcePolicy) {}

  public async preview(rootPath: string, patch: PatchProposal): Promise<PatchValidation> {
    const root = await this.assertRoot(rootPath);
    const seen = new Set<string>();
    let bytes = 0;
    const files: string[] = [];
    for (const operation of patch.operations) {
      if (seen.has(operation.relativePath)) return { valid: false, files, bytes, reason: `Duplicate patch path: ${operation.relativePath}.` };
      seen.add(operation.relativePath);
      const target = await this.safePath(root, operation.relativePath);
      const contentBytes = Buffer.byteLength(operation.content, "utf8");
      if (contentBytes > 512 * 1024) return { valid: false, files, bytes, reason: `Patch file exceeds 512KB: ${operation.relativePath}.` };
      bytes += contentBytes;
      if (bytes > this.resourcePolicy.limits.maxPreviewSourceBytes) return { valid: false, files, bytes, reason: "Patch source budget exceeded." };
      const existing = await this.readExisting(target);
      if (operation.mode === "create" && existing !== undefined) return { valid: false, files, bytes, reason: `Create target already exists: ${operation.relativePath}.` };
      if (operation.mode === "update" && existing === undefined) return { valid: false, files, bytes, reason: `Update target does not exist: ${operation.relativePath}.` };
      if (operation.expectedSha256 && (existing === undefined || sha256(existing) !== operation.expectedSha256)) {
        return { valid: false, files, bytes, reason: `Patch conflict at ${operation.relativePath}: expected source hash does not match.` };
      }
      files.push(operation.relativePath);
    }
    return { valid: true, files: files.sort(), bytes };
  }

  public async apply(rootPath: string, patch: PatchProposal, validation: PatchValidation, _signal?: AbortSignal): Promise<void> {
    if (!validation.valid) throw new Error(validation.reason ?? "Cannot apply an invalid patch.");
    const current = await this.preview(rootPath, patch);
    if (!current.valid || current.bytes !== validation.bytes || current.files.join("\n") !== validation.files.join("\n")) {
      throw new Error(current.reason ?? "Patch changed before application.");
    }
    const root = await this.assertRoot(rootPath);
    const temporaryFiles: string[] = [];
    try {
      for (const operation of patch.operations) {
        const target = await this.safePath(root, operation.relativePath);
        await mkdir(dirname(target), { recursive: true });
        const temporary = `${target}.osamah-tmp-${randomUUID()}`;
        await writeFile(temporary, operation.content, { encoding: "utf8", flag: "wx" });
        temporaryFiles.push(temporary);
      }
      for (let index = 0; index < patch.operations.length; index += 1) {
        const operation = patch.operations[index];
        const temporary = temporaryFiles[index];
        if (!operation || !temporary) throw new Error("Patch staging failed.");
        const target = await this.safePath(root, operation.relativePath);
        await rename(temporary, target);
      }
    } finally {
      await Promise.all(temporaryFiles.map((temporary) => rm(temporary, { force: true }).catch(() => undefined)));
    }
  }

  private async assertRoot(rootPath: string): Promise<string> {
    const root = await realpath(resolve(rootPath));
    const info = await stat(root);
    if (!info.isDirectory()) throw new Error("Patch root is not a directory.");
    return root;
  }

  private async safePath(root: string, relativePath: string): Promise<string> {
    if (!relativePath || relativePath.includes("\0") || relativePath.includes("\\") || relativePath.startsWith("/")) throw new Error(`Unsafe patch path: ${relativePath}`);
    const candidate = resolve(root, relativePath);
    const prefix = root.endsWith(sep) ? root : `${root}${sep}`;
    if (candidate === root || !candidate.startsWith(prefix)) throw new Error(`Patch path escapes root: ${relativePath}`);
    const targetInfo = await lstat(candidate).catch(() => undefined);
    if (targetInfo?.isSymbolicLink()) throw new Error(`Symlink patch target is not allowed: ${relativePath}`);
    const parent = await realpath(dirname(candidate)).catch(() => root);
    if (parent !== root && !parent.startsWith(prefix)) throw new Error(`Patch parent escapes root: ${relativePath}`);
    return candidate;
  }

  private async readExisting(target: string): Promise<string | undefined> {
    try {
      const info = await lstat(target);
      if (!info.isFile() || info.isSymbolicLink()) throw new Error("Patch target must be a regular file.");
      return await readFile(target, "utf8");
    } catch (error) {
      if (isMissing(error)) return undefined;
      throw error;
    }
  }
}

const isMissing = (error: unknown): boolean => typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
