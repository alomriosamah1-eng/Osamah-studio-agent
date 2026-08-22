import type { ProjectScanner } from "./ports.js";
import { buildProjectPreviewBundle, type ProjectPreviewBundle } from "../mobile/preview-runtime.js";

export interface ProjectPreviewService {
  build(input: { projectId: string; rootPath: string; entry?: string }): Promise<ProjectPreviewBundle>;
}

export class FilesystemProjectPreviewService implements ProjectPreviewService {
  public constructor(private readonly scanner: ProjectScanner) {}

  public async build(input: { projectId: string; rootPath: string; entry?: string }): Promise<ProjectPreviewBundle> {
    const relativeFiles = await this.scanner.listRelativeFiles(input.rootPath);
    const manifest = await this.scanner.readJson(input.rootPath, "package.json");
    const entry = input.entry ?? this.selectEntry(manifest, relativeFiles);
    const files: Record<string, string> = {};
    for (const relativePath of relativeFiles) {
      if (!isPreviewSource(relativePath) && relativePath !== "package.json") continue;
      const source = await this.scanner.readText(input.rootPath, relativePath);
      if (source !== undefined) files[relativePath] = source;
    }
    return buildProjectPreviewBundle({ projectId: input.projectId, rootPath: input.rootPath, entry, files });
  }

  private selectEntry(manifest: Record<string, unknown> | undefined, files: readonly string[]): string {
    const candidates = [
      typeof manifest?.main === "string" && isFilePath(manifest.main) ? manifest.main : undefined,
      "app/index.tsx",
      "app/index.ts",
      "src/App.tsx",
      "src/App.ts",
      "index.tsx",
      "index.ts",
    ].filter((value): value is string => Boolean(value));
    return candidates.find((candidate) => files.includes(candidate)) ?? candidates[0] ?? "app/index.tsx";
  }
}

const isFilePath = (value: string): boolean => /\.(tsx?|jsx?|json)$/.test(value) && !value.includes("..") && !value.startsWith("/");
const isPreviewSource = (value: string): boolean => /\.(tsx?|jsx?|json|png|jpe?g|gif|svg|webp)$/i.test(value);
