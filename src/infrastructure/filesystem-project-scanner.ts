import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import type { ProjectScanner } from "../application/ports.js";

const MAX_FILES = 2_000;
const MAX_TEXT_BYTES = 1_500_000;
const IGNORED = new Set([".git", "node_modules", ".expo", "dist", "build", "coverage"]);

export class FilesystemProjectScanner implements ProjectScanner {
  public async listRelativeFiles(rootPath: string): Promise<readonly string[]> {
    const root = await this.assertRoot(rootPath);
    const files: string[] = [];
    const walk = async (directory: string): Promise<void> => {
      if (files.length > MAX_FILES) throw new Error(`Project exceeds the preview file limit of ${MAX_FILES}.`);
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (IGNORED.has(entry.name)) continue;
        const absolute = join(directory, entry.name);
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) await walk(absolute);
        else if (entry.isFile()) files.push(relative(root, absolute).split(sep).join("/"));
      }
    };
    await walk(root);
    return files.sort();
  }

  public async readText(rootPath: string, relativePath: string): Promise<string | undefined> {
    const absolute = await this.safePath(rootPath, relativePath);
    try {
      const info = await stat(absolute);
      if (!info.isFile() || info.size > MAX_TEXT_BYTES) return undefined;
      return await readFile(absolute, "utf8");
    } catch (error) {
      if (isMissing(error)) return undefined;
      throw error;
    }
  }

  public async readJson(rootPath: string, relativePath: string): Promise<Record<string, unknown> | undefined> {
    const text = await this.readText(rootPath, relativePath);
    if (text === undefined) return undefined;
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Expected object JSON at ${relativePath}.`);
    return value as Record<string, unknown>;
  }

  private async assertRoot(rootPath: string): Promise<string> {
    const root = resolve(rootPath);
    const info = await stat(root);
    if (!info.isDirectory()) throw new Error(`Project root is not a directory: ${rootPath}`);
    return root;
  }

  private async safePath(rootPath: string, relativePath: string): Promise<string> {
    if (!relativePath || relativePath.includes("\0") || relativePath.startsWith("/") || relativePath.startsWith("\\")) throw new Error(`Unsafe project path: ${relativePath}`);
    const root = await this.assertRoot(rootPath);
    const candidate = resolve(root, relativePath);
    const prefix = root.endsWith(sep) ? root : `${root}${sep}`;
    if (candidate !== root && !candidate.startsWith(prefix)) throw new Error(`Project path escapes root: ${relativePath}`);
    return candidate;
  }
}

const isMissing = (error: unknown): boolean => typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
