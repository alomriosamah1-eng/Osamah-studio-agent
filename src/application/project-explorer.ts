import { createHash } from "node:crypto";

export interface ProjectTreeNode {
  readonly name: string;
  readonly relativePath: string;
  readonly kind: "directory" | "file";
  readonly extension?: string;
  readonly children?: readonly ProjectTreeNode[];
}

export interface ProjectTreeResult {
  readonly root: ProjectTreeNode;
  readonly fileCount: number;
  readonly truncated: boolean;
  readonly warnings: readonly string[];
}

export interface ProjectExplorerPort {
  list(rootPath: string): Promise<ProjectTreeResult>;
}

export interface WorkspaceFileContent {
  readonly relativePath: string;
  readonly content: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly truncated: false;
}

export interface WorkspaceFileReaderPort {
  readText(rootPath: string, relativePath: string): Promise<WorkspaceFileContent | undefined>;
}

export class ProjectExplorerError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ProjectExplorerError";
  }
}

export class WorkspaceFileReaderError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "WorkspaceFileReaderError";
  }
}

interface MutableTreeNode {
  readonly name: string;
  readonly relativePath: string;
  kind: "directory" | "file";
  extension?: string;
  readonly children: Map<string, MutableTreeNode>;
}

const extensionOf = (relativePath: string): string | undefined => {
  const name = relativePath.split("/").at(-1) ?? relativePath;
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot).toLowerCase() : undefined;
};

const createDirectory = (name: string, relativePath: string): MutableTreeNode => ({ name, relativePath, kind: "directory", children: new Map() });

const toImmutable = (node: MutableTreeNode): ProjectTreeNode => {
  const children = [...node.children.values()].sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === "directory" ? -1 : 1;
    return left.name.localeCompare(right.name);
  }).map(toImmutable);
  return {
    name: node.name,
    relativePath: node.relativePath,
    kind: node.kind,
    ...(node.extension ? { extension: node.extension } : {}),
    ...(node.kind === "directory" ? { children } : {}),
  };
};

const safeRelativePath = (value: string): string | undefined => {
  const normalized = value.replaceAll("\\", "/");
  if (!normalized || normalized.startsWith("/") || normalized.includes("\u0000")) return undefined;
  const segments = normalized.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) return undefined;
  return segments.join("/");
};

export const buildProjectTree = (relativePaths: readonly string[], maxFiles: number): ProjectTreeResult => {
  const boundedMaxFiles = Math.max(1, Math.min(4_096, Math.floor(maxFiles)));
  const root = createDirectory("Project", "");
  const warnings: string[] = [];
  const seen = new Set<string>();
  let fileCount = 0;
  let truncated = false;
  let nodeCount = 1;
  const maxNodes = Math.max(256, boundedMaxFiles * 8);

  for (const candidate of [...relativePaths].sort()) {
    const relativePath = safeRelativePath(candidate);
    if (!relativePath || seen.has(relativePath)) {
      if (relativePath === undefined) warnings.push(`Skipped unsafe project entry: ${candidate}`);
      continue;
    }
    seen.add(relativePath);
    if (fileCount >= boundedMaxFiles || nodeCount >= maxNodes) {
      truncated = true;
      continue;
    }
    const segments = relativePath.split("/");
    let parent = root;
    let currentPath = "";
    let rejected = false;
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index]!;
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const isFile = index === segments.length - 1;
      const existing = parent.children.get(segment);
      if (existing) {
        if (isFile && existing.kind === "directory") {
          warnings.push(`Skipped conflicting project entry: ${relativePath}`);
          rejected = true;
          break;
        }
        if (!isFile && existing.kind === "file") {
          warnings.push(`Skipped conflicting project entry: ${relativePath}`);
          rejected = true;
          break;
        }
        parent = existing;
        continue;
      }
      if (nodeCount >= maxNodes) {
        truncated = true;
        rejected = true;
        break;
      }
      const child: MutableTreeNode = isFile
        ? { name: segment, relativePath: currentPath, kind: "file", extension: extensionOf(currentPath), children: new Map() }
        : createDirectory(segment, currentPath);
      parent.children.set(segment, child);
      nodeCount += 1;
      parent = child;
    }
    if (!rejected) fileCount += 1;
  }

  return { root: toImmutable(root), fileCount, truncated, warnings: warnings.slice(0, 256) };
};

export const workspaceFileContent = (relativePath: string, content: string): WorkspaceFileContent => ({
  relativePath,
  content,
  bytes: Buffer.byteLength(content, "utf8"),
  sha256: createHash("sha256").update(content, "utf8").digest("hex"),
  truncated: false,
});

export const normalizeWorkspaceRelativePath = (value: string): string => {
  const normalized = safeRelativePath(value);
  if (!normalized) throw new WorkspaceFileReaderError(`Unsafe workspace file path: ${value}`);
  return normalized;
};
