import { lstat, readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import {
  buildProjectTree,
  normalizeWorkspaceRelativePath,
  ProjectExplorerError,
  type ProjectExplorerPort,
  type ProjectTreeResult,
  type WorkspaceFileContent,
  WorkspaceFileReaderError,
  type WorkspaceFileReaderPort,
  workspaceFileContent,
} from "../application/project-explorer.js";
import type { ResourcePolicy } from "../application/resource-policy.js";

const IGNORED_DIRECTORIES = new Set([".git", "node_modules", ".expo", "dist", "build", "coverage"]);

const isMissing = (error: unknown): boolean => typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
const SENSITIVE_FILE_NAMES = new Set([".env", ".env.local", ".env.production", "id_rsa", "id_ed25519", "credentials.json"]);

export class FilesystemProjectExplorer implements ProjectExplorerPort {
  public constructor(private readonly resourcePolicy: ResourcePolicy) {}

  public async list(rootPath: string): Promise<ProjectTreeResult> {
    const root = resolve(rootPath);
    let rootInfo;
    try {
      rootInfo = await lstat(root);
    } catch (error) {
      if (isMissing(error)) throw new ProjectExplorerError(`Project root does not exist: ${rootPath}`);
      throw error;
    }
    if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new ProjectExplorerError(`Project root is not a directory: ${rootPath}`);

    const relativePaths: string[] = [];
    let truncated = false;
    const maxFiles = this.resourcePolicy.limits.maxPreviewModules;
    const maxDepth = 32;
    const walk = async (directory: string, depth: number): Promise<void> => {
      if (depth > maxDepth) {
        truncated = true;
        return;
      }
      const entries = (await readdir(directory, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name));
      for (const entry of entries) {
        if (entry.isSymbolicLink() || (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name))) continue;
        const absolute = join(directory, entry.name);
        if (entry.isDirectory()) {
          await walk(absolute, depth + 1);
        } else if (entry.isFile()) {
          if (relativePaths.length >= maxFiles) {
            truncated = true;
            return;
          }
          relativePaths.push(relative(root, absolute).split(sep).join("/"));
        }
        if (truncated && relativePaths.length >= maxFiles) return;
      }
    };
    await walk(root, 0);
    const tree = buildProjectTree(relativePaths, maxFiles);
    return { ...tree, truncated: truncated || tree.truncated, warnings: truncated ? [...tree.warnings, `Project tree was bounded at ${maxFiles} files.`].slice(0, 256) : tree.warnings };
  }
}

export class FilesystemWorkspaceFileReader implements WorkspaceFileReaderPort {
  public constructor(private readonly resourcePolicy: ResourcePolicy) {}

  public async readText(rootPath: string, relativePath: string): Promise<WorkspaceFileContent | undefined> {
    const normalizedPath = normalizeWorkspaceRelativePath(relativePath);
    const fileName = normalizedPath.split("/").at(-1)?.toLowerCase();
    if (fileName && SENSITIVE_FILE_NAMES.has(fileName)) return undefined;
    const absolutePath = await this.safeFilePath(rootPath, normalizedPath);
    if (!absolutePath) return undefined;
    try {
      const info = await stat(absolutePath);
      const maxBytes = this.resourcePolicy.limits.maxTextFileBytes;
      if (!info.isFile() || info.size > maxBytes) return undefined;
      const content = await readFile(absolutePath, "utf8");
      if (content.includes("\u0000") || Buffer.byteLength(content, "utf8") > maxBytes) return undefined;
      return workspaceFileContent(normalizedPath, content);
    } catch (error) {
      if (isMissing(error) || (typeof error === "object" && error !== null && "code" in error && error.code === "ELOOP")) return undefined;
      throw new WorkspaceFileReaderError(error instanceof Error ? error.message : "Workspace file could not be read.");
    }
  }

  private async safeFilePath(rootPath: string, normalizedPath: string): Promise<string | undefined> {
    const root = resolve(rootPath);
    let rootInfo;
    try {
      rootInfo = await lstat(root);
    } catch (error) {
      if (isMissing(error)) throw new WorkspaceFileReaderError(`Workspace root does not exist: ${rootPath}`);
      throw error;
    }
    if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new WorkspaceFileReaderError(`Workspace root is not a directory: ${rootPath}`);

    const segments = normalizedPath.split("/");
    let current = root;
    for (const [index, segment] of segments.entries()) {
      current = join(current, segment);
      let info;
      try {
        info = await lstat(current);
      } catch (error) {
        if (isMissing(error)) return undefined;
        throw error;
      }
      if (info.isSymbolicLink()) return undefined;
      const last = index === segments.length - 1;
      if ((!last && !info.isDirectory()) || (last && !info.isFile())) return undefined;
    }
    const prefix = root.endsWith(sep) ? root : `${root}${sep}`;
    if (!current.startsWith(prefix)) throw new WorkspaceFileReaderError(`Workspace file escapes root: ${normalizedPath}`);
    return current;
  }
}
