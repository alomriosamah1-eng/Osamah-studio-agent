import { createHash } from "node:crypto";
import type { ProjectScanner } from "./ports.js";
import type { ResourcePolicy } from "./resource-policy.js";

export interface ProjectManifestSummary {
  readonly relativePath: string;
  readonly kind: "package.json" | "pyproject.toml" | "Cargo.toml" | "go.mod" | "pom.xml" | "unknown";
  readonly name?: string;
  readonly version?: string;
  readonly packageManager?: string;
  readonly dependencyNames: readonly string[];
}

export interface ProjectFileEntry {
  readonly relativePath: string;
  readonly extension: string;
}

export interface GitStatusSummary {
  readonly isRepository: boolean;
  readonly branch?: string;
  readonly stagedCount: number;
  readonly unstagedCount: number;
  readonly untrackedCount: number;
  readonly conflictedCount: number;
  readonly rawUnavailable?: boolean;
}

export interface ProjectContextSnapshot {
  readonly rootPath: string;
  readonly generatedAt: string;
  readonly files: readonly ProjectFileEntry[];
  readonly manifests: readonly ProjectManifestSummary[];
  readonly git: GitStatusSummary;
  readonly truncated: boolean;
  readonly warnings: readonly string[];
}

export interface TargetedContextFile {
  readonly relativePath: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly content: string;
}

export interface ProjectContextLimits {
  readonly maxIndexedFiles: number;
  readonly maxTargetedFiles: number;
  readonly maxTargetedBytes: number;
  readonly maxFileBytes: number;
}

export interface GitStatusPort {
  read(rootPath: string): Promise<GitStatusSummary>;
}

const manifestKinds = new Map<string, ProjectManifestSummary["kind"]>([
  ["package.json", "package.json"],
  ["pyproject.toml", "pyproject.toml"],
  ["Cargo.toml", "Cargo.toml"],
  ["go.mod", "go.mod"],
  ["pom.xml", "pom.xml"],
]);

const extensionOf = (relativePath: string): string => {
  const name = relativePath.split("/").pop() ?? relativePath;
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot).toLowerCase() : "";
};

const toManifestSummary = (relativePath: string, value: Record<string, unknown>): ProjectManifestSummary => {
  const dependencies = new Set<string>();
  for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
    const candidate = value[field];
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    for (const name of Object.keys(candidate as Record<string, unknown>)) dependencies.add(name);
  }
  const text = (field: string): string | undefined => typeof value[field] === "string" ? value[field] as string : undefined;
  return {
    relativePath,
    kind: "package.json",
    name: text("name"),
    version: text("version"),
    packageManager: text("packageManager"),
    dependencyNames: [...dependencies].sort().slice(0, 256),
  };
};

export class ProjectContextError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ProjectContextError";
  }
}

export class FilesystemProjectContextIndex {
  private readonly limits: ProjectContextLimits;

  public constructor(
    private readonly scanner: ProjectScanner,
    private readonly git: GitStatusPort,
    private readonly resourcePolicy: ResourcePolicy,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {
    this.limits = {
      maxIndexedFiles: Math.max(1, Math.min(128, resourcePolicy.limits.maxPreviewModules)),
      maxTargetedFiles: Math.max(1, Math.min(24, resourcePolicy.limits.maxPreviewWarnings)),
      maxTargetedBytes: Math.min(2 * 1024 * 1024, resourcePolicy.limits.maxPreviewSourceBytes),
      maxFileBytes: Math.min(512 * 1024, resourcePolicy.limits.maxTextFileBytes),
    };
  }

  public limitsSnapshot(): ProjectContextLimits {
    return { ...this.limits };
  }

  public async build(rootPath: string): Promise<ProjectContextSnapshot> {
    const allFiles = await this.scanner.listRelativeFiles(rootPath);
    const files = allFiles.slice(0, this.limits.maxIndexedFiles).map((relativePath) => ({ relativePath, extension: extensionOf(relativePath) }));
    const manifests: ProjectManifestSummary[] = [];
    const warnings: string[] = [];
    for (const relativePath of allFiles) {
      const kind = manifestKinds.get(relativePath.split("/").pop() ?? "");
      if (!kind) continue;
      if (kind === "package.json") {
        try {
          const value = await this.scanner.readJson(rootPath, relativePath);
          if (value) manifests.push(toManifestSummary(relativePath, value));
        } catch {
          warnings.push(`Manifest could not be parsed: ${relativePath}`);
        }
      } else {
        manifests.push({ relativePath, kind, dependencyNames: [] });
      }
    }
    const git = await this.git.read(rootPath);
    return {
      rootPath,
      generatedAt: this.now(),
      files,
      manifests: manifests.slice(0, 16),
      git,
      truncated: allFiles.length > this.limits.maxIndexedFiles,
      warnings: warnings.slice(0, this.resourcePolicy.limits.maxPreviewWarnings),
    };
  }

  public async readTargeted(rootPath: string, relativePaths: readonly string[]): Promise<readonly TargetedContextFile[]> {
    const uniquePaths = [...new Set(relativePaths)].slice(0, this.limits.maxTargetedFiles);
    const result: TargetedContextFile[] = [];
    let totalBytes = 0;
    for (const relativePath of uniquePaths) {
      const content = await this.scanner.readText(rootPath, relativePath);
      if (content === undefined) continue;
      const bytes = Buffer.byteLength(content, "utf8");
      if (bytes > this.limits.maxFileBytes || totalBytes + bytes > this.limits.maxTargetedBytes) {
        throw new ProjectContextError(`Targeted context budget exceeded at ${relativePath}.`);
      }
      totalBytes += bytes;
      result.push({ relativePath, bytes, sha256: createHash("sha256").update(content, "utf8").digest("hex"), content });
    }
    return result;
  }
}
