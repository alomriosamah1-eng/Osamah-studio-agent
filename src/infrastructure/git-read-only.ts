import { lstat, realpath } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isAbsolute, resolve } from "node:path";
import type { GitChange, GitDiffResult, GitReadOnlyPort, GitStatusSnapshot } from "../application/git-read-only.js";
import { GitReadOnlyError } from "../application/git-read-only.js";

const execFileAsync = promisify(execFile);
const conflictCodes = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]);
const shellMetaCharacters = /[;&|<>`$(){}!\n\r\u0000]/u;

export interface GitReadOnlyAdapterOptions {
  readonly timeoutMs?: number;
  readonly statusMaxBytes?: number;
  readonly diffMaxBytes?: number;
  readonly maxEntries?: number;
}

const boundedInteger = (value: number | undefined, fallback: number, min: number, max: number, field: string): number => {
  const candidate = value ?? fallback;
  if (!Number.isInteger(candidate) || candidate < min || candidate > max) throw new GitReadOnlyError(`${field} is outside the bounded Git policy.`);
  return candidate;
};

const clipUtf8 = (value: string, maxBytes: number): { readonly text: string; readonly bytes: number; readonly truncated: boolean } => {
  const buffer = Buffer.from(value, "utf8");
  if (buffer.byteLength <= maxBytes) return { text: value, bytes: buffer.byteLength, truncated: false };
  const clipped = buffer.subarray(0, maxBytes).toString("utf8");
  return { text: `${clipped}\n[git output truncated by policy]\n`, bytes: Buffer.byteLength(`${clipped}\n[git output truncated by policy]\n`, "utf8"), truncated: true };
};

const validateRootInput = (rootPath: string): string => {
  if (typeof rootPath !== "string" || rootPath.length === 0 || rootPath.length > 4096 || rootPath.includes("\u0000") || rootPath.includes("\n") || rootPath.includes("\r")) throw new GitReadOnlyError("rootPath is invalid.");
  return rootPath;
};

const validateRelativePath = (relativePath: string): string => {
  if (typeof relativePath !== "string" || relativePath.length === 0 || relativePath.length > 512 || relativePath.includes("\u0000") || relativePath.includes("\n") || relativePath.includes("\r")) throw new GitReadOnlyError("relativePath is invalid.");
  if (isAbsolute(relativePath) || relativePath.startsWith("\\") || relativePath.startsWith("-") || relativePath.includes("\\") || relativePath.split("/").some((part) => part === "..") || shellMetaCharacters.test(relativePath)) throw new GitReadOnlyError("relativePath must remain a safe relative path.");
  return relativePath;
};

const parseAheadBehind = (branchLine: string): { readonly branch?: string; readonly upstream?: string; readonly ahead: number; readonly behind: number } => {
  const value = branchLine.slice(3);
  const tracking = value.match(/^(.*?)\.\.\.(.*?)\s+\[(.*?)\]$/u);
  if (!tracking) return { branch: value === "HEAD (no branch)" ? undefined : value, ahead: 0, behind: 0 };
  const counts = tracking[3] ?? "";
  const ahead = Number(counts.match(/ahead (\d+)/u)?.[1] ?? 0);
  const behind = Number(counts.match(/behind (\d+)/u)?.[1] ?? 0);
  return { branch: tracking[1] || undefined, upstream: tracking[2] || undefined, ahead, behind };
};

const parseStatus = (stdout: string, maxEntries: number): GitStatusSnapshot => {
  const lines = stdout.split(/\r?\n/u).filter(Boolean);
  const branchLine = lines.find((line) => line.startsWith("## "));
  const branchState = branchLine ? parseAheadBehind(branchLine) : { ahead: 0, behind: 0 };
  const staged: GitChange[] = [];
  const unstaged: GitChange[] = [];
  const untracked: string[] = [];
  const conflicted: string[] = [];
  let entryCount = 0;
  let truncated = false;
  for (const line of lines) {
    if (line.startsWith("## ")) continue;
    if (entryCount >= maxEntries) {
      truncated = true;
      break;
    }
    const code = line.slice(0, 2);
    const path = line.slice(3);
    if (!path) continue;
    entryCount += 1;
    if (code === "??") {
      untracked.push(path);
      continue;
    }
    if (code[0] && code[0] !== " ") staged.push({ path, status: code, staged: true });
    if (code[1] && code[1] !== " ") unstaged.push({ path, status: code, staged: false });
    if (conflictCodes.has(code)) conflicted.push(path);
  }
  return {
    isRepository: true,
    ...branchState,
    staged,
    unstaged,
    untracked,
    conflicted,
    ...(truncated ? { truncated: true } : {}),
  };
};

export class FilesystemGitReadOnlyAdapter implements GitReadOnlyPort {
  private readonly timeoutMs: number;
  private readonly statusMaxBytes: number;
  private readonly diffMaxBytes: number;
  private readonly maxEntries: number;

  public constructor(options: GitReadOnlyAdapterOptions = {}) {
    this.timeoutMs = boundedInteger(options.timeoutMs, 1_500, 250, 10_000, "timeoutMs");
    this.statusMaxBytes = boundedInteger(options.statusMaxBytes, 256 * 1024, 4 * 1024, 256 * 1024, "statusMaxBytes");
    this.diffMaxBytes = boundedInteger(options.diffMaxBytes, 128 * 1024, 4 * 1024, 128 * 1024, "diffMaxBytes");
    this.maxEntries = boundedInteger(options.maxEntries, 256, 1, 256, "maxEntries");
  }

  public async status(rootPath: string): Promise<GitStatusSnapshot> {
    const canonicalRoot = await this.canonicalRoot(rootPath);
    if (!canonicalRoot) return this.unavailableStatus();
    try {
      const { stdout } = await this.runGit(canonicalRoot, ["status", "--porcelain=v1", "--branch", "--untracked-files=normal"], this.statusMaxBytes);
      const clipped = clipUtf8(stdout, this.statusMaxBytes);
      const parsed = parseStatus(clipped.text, this.maxEntries);
      return clipped.truncated ? { ...parsed, truncated: true } : parsed;
    } catch {
      return this.unavailableStatus();
    }
  }

  public async diff(rootPath: string, relativePath?: string): Promise<GitDiffResult> {
    const canonicalRoot = await this.canonicalRoot(rootPath);
    if (!canonicalRoot) return { ...(relativePath ? { relativePath } : {}), patch: "", bytes: 0, truncated: false, rawUnavailable: true };
    const safePath = relativePath === undefined ? undefined : validateRelativePath(relativePath);
    const args = ["diff", "--no-ext-diff", "--no-color", "--no-renames", "--", ...(safePath ? [safePath] : [])];
    try {
      const { stdout } = await this.runGit(canonicalRoot, args, Math.max(this.diffMaxBytes + 1, 256 * 1024));
      const clipped = clipUtf8(stdout, this.diffMaxBytes);
      return { ...(safePath ? { relativePath: safePath } : {}), patch: clipped.text, bytes: clipped.bytes, truncated: clipped.truncated };
    } catch {
      return { ...(safePath ? { relativePath: safePath } : {}), patch: "", bytes: 0, truncated: false, rawUnavailable: true };
    }
  }

  private async canonicalRoot(rootPath: string): Promise<string | undefined> {
    const input = validateRootInput(rootPath);
    try {
      const rootStat = await lstat(input);
      if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) return undefined;
      return await realpath(input);
    } catch {
      return undefined;
    }
  }

  private async runGit(canonicalRoot: string, args: readonly string[], maxBuffer: number): Promise<{ readonly stdout: string }> {
    const result = await execFileAsync("git", ["-C", canonicalRoot, ...args], {
      shell: false,
      timeout: this.timeoutMs,
      maxBuffer,
      windowsHide: true,
    });
    return { stdout: result.stdout as string };
  }

  private unavailableStatus(): GitStatusSnapshot {
    return { isRepository: false, ahead: 0, behind: 0, staged: [], unstaged: [], untracked: [], conflicted: [], rawUnavailable: true };
  }
}

export const isPathWithinRoot = (rootPath: string, relativePath: string): boolean => resolve(rootPath, relativePath).startsWith(`${resolve(rootPath)}/`);
