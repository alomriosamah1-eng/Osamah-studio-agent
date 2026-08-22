import type { PreviewInput } from "./preview.js";

export type CompatibilityClass = "supported" | "web_compatible" | "native_only" | "blocked";

export interface CompatibilityWarning {
  readonly importId: string;
  readonly classification: Exclude<CompatibilityClass, "supported">;
  readonly message: string;
}

export interface PreviewModule {
  readonly id: string;
  readonly source: string;
  readonly dependencies: readonly string[];
  readonly format: "tsx" | "ts" | "json" | "asset";
}

export interface PreviewAsset {
  readonly id: string;
  readonly relativePath: string;
  readonly mimeType: string;
}

export interface PreviewRenderNode {
  readonly type: "view" | "text" | "card" | "status";
  readonly text?: string;
  readonly props?: Readonly<Record<string, string>>;
  readonly children?: readonly PreviewRenderNode[];
}

export interface ProjectPreviewBundle {
  readonly projectId: string;
  readonly entry: string;
  readonly sourceHash: string;
  readonly modules: readonly PreviewModule[];
  readonly assets: readonly PreviewAsset[];
  readonly warnings: readonly CompatibilityWarning[];
  readonly capabilities: readonly string[];
  readonly root: PreviewRenderNode;
}

export interface ProjectPreviewInput {
  readonly projectId: string;
  readonly rootPath: string;
  readonly entry: string;
  readonly files: Readonly<Record<string, string>>;
}

export interface PreviewRuntimeEvent {
  readonly type: "bundle_loaded" | "input_received" | "refresh_started" | "refresh_completed" | "warning" | "error";
  readonly message: string;
  readonly sourceHash?: string;
}

export interface PreviewRuntimeSnapshot {
  readonly status: "created" | "loading" | "ready" | "refreshing" | "reloading" | "failed" | "stopped";
  readonly bundle?: ProjectPreviewBundle;
  readonly events: readonly PreviewRuntimeEvent[];
  readonly diagnostics: readonly string[];
}

const MAX_PREVIEW_FILES = 2_000;
const MAX_PREVIEW_SOURCE_BYTES = 24 * 1024 * 1024;
const MAX_PREVIEW_MODULES = 256;
const MAX_PREVIEW_ASSETS = 128;
const MAX_PREVIEW_WARNINGS = 256;
const utf8Encoder = new TextEncoder();

const blockedImports = new Set(["fs", "node:fs", "child_process", "node:child_process", "net", "node:net"]);
const nativeOnlyImports = new Set(["react-native-mmkv", "react-native-vision-camera", "react-native-maps"]);
const webCompatibleImports = new Set(["react", "react-native", "react-native-web", "expo", "expo-router"]);

export const buildProjectPreviewBundle = (input: ProjectPreviewInput): ProjectPreviewBundle => {
  const normalizedEntry = normalizePath(input.entry);
  const fileEntries = Object.entries(input.files);
  if (fileEntries.length > MAX_PREVIEW_FILES) throw new Error(`Preview file budget exceeded: ${fileEntries.length} > ${MAX_PREVIEW_FILES}.`);
  const sourceBytes = fileEntries.reduce((total, [, source]) => total + utf8Encoder.encode(source).byteLength, 0);
  if (sourceBytes > MAX_PREVIEW_SOURCE_BYTES) throw new Error(`Preview source budget exceeded: ${sourceBytes} > ${MAX_PREVIEW_SOURCE_BYTES} bytes.`);
  const entrySource = input.files[normalizedEntry];
  if (entrySource === undefined) throw new Error(`Preview entry was not found: ${normalizedEntry}`);
  const visited = new Set<string>();
  const modules: PreviewModule[] = [];
  const warnings: CompatibilityWarning[] = [];
  const assets: PreviewAsset[] = [];

  const visit = (path: string): void => {
    const normalized = normalizePath(path);
    if (visited.has(normalized)) return;
    const source = input.files[normalized];
    if (source === undefined) {
      warnings.push({ importId: normalized, classification: "native_only", message: `Preview module is missing: ${normalized}` });
      return;
    }
    visited.add(normalized);
    const dependencies = extractImports(source);
    modules.push({ id: normalized, source, dependencies, format: fileFormat(normalized) });
    if (modules.length > MAX_PREVIEW_MODULES) throw new Error(`Preview module budget exceeded: ${modules.length} > ${MAX_PREVIEW_MODULES}.`);
    for (const dependency of dependencies) {
      const classification = classifyImport(dependency);
      if (classification === "blocked") {
        warnings.push({ importId: dependency, classification, message: `Blocked import cannot execute in preview: ${dependency}` });
      } else if (classification === "native_only") {
        warnings.push({ importId: dependency, classification, message: `Native-only import requires a native transport: ${dependency}` });
      }
      if (warnings.length > MAX_PREVIEW_WARNINGS) throw new Error(`Preview warning budget exceeded: ${warnings.length} > ${MAX_PREVIEW_WARNINGS}.`);
      if (dependency.startsWith(".")) visit(resolveRelative(normalized, dependency, input.files));
    }
  };

  visit(normalizedEntry);
  for (const path of Object.keys(input.files)) {
    if (/\.(png|jpe?g|gif|svg|webp)$/i.test(path)) {
      assets.push({ id: path, relativePath: path, mimeType: mimeType(path) });
      if (assets.length > MAX_PREVIEW_ASSETS) throw new Error(`Preview asset budget exceeded: ${assets.length} > ${MAX_PREVIEW_ASSETS}.`);
    }
  }
  if (warnings.some((warning) => warning.classification === "blocked")) throw new Error(warnings.find((warning) => warning.classification === "blocked")?.message ?? "Blocked preview import.");
  const sourceHash = stableHash(Object.entries(input.files).sort(([a], [b]) => a.localeCompare(b)).map(([path, source]) => `${path}\0${source}`).join("\n"));
  return {
    projectId: input.projectId,
    entry: normalizedEntry,
    sourceHash,
    modules,
    assets,
    warnings,
    capabilities: ["view", "text", "card", "status", "tap", "scroll", "screenshot"],
    root: renderFixtureTree(entrySource, input.projectId),
  };
};

export class FixturePreviewRuntime {
  private snapshot: PreviewRuntimeSnapshot = { status: "created", events: [], diagnostics: [] };

  public load(bundle: ProjectPreviewBundle): PreviewRuntimeSnapshot {
    const events: PreviewRuntimeEvent[] = [{ type: "bundle_loaded", message: `Bundle loaded: ${bundle.entry}`, sourceHash: bundle.sourceHash }];
    for (const warning of bundle.warnings) events.push({ type: "warning", message: warning.message });
    this.snapshot = { status: "ready", bundle, events, diagnostics: bundle.warnings.map((warning) => warning.message) };
    return this.snapshot;
  }

  public input(input: PreviewInput): PreviewRuntimeSnapshot {
    if (this.snapshot.status !== "ready" || !this.snapshot.bundle) throw new Error("Preview runtime is not ready.");
    this.snapshot = { ...this.snapshot, events: [...this.snapshot.events, { type: "input_received", message: input.type }] };
    return this.snapshot;
  }

  public refresh(bundle: ProjectPreviewBundle, kind: "fast" | "reload" = "fast"): PreviewRuntimeSnapshot {
    if (!this.snapshot.bundle) return this.load(bundle);
    const events = [...this.snapshot.events, { type: "refresh_started", message: kind, sourceHash: bundle.sourceHash } satisfies PreviewRuntimeEvent];
    this.snapshot = { ...this.snapshot, status: kind === "fast" ? "refreshing" : "reloading", events };
    this.snapshot = { ...this.snapshot, status: "ready", bundle, events: [...events, { type: "refresh_completed", message: `${kind} refresh completed`, sourceHash: bundle.sourceHash }] };
    return this.snapshot;
  }

  public stop(): PreviewRuntimeSnapshot {
    this.snapshot = { ...this.snapshot, status: "stopped" };
    return this.snapshot;
  }

  public inspect(): PreviewRuntimeSnapshot { return this.snapshot; }
}

const normalizePath = (path: string): string => {
  const normalized = path.replaceAll("\\", "/");
  if (normalized.startsWith("/")) throw new Error(`Unsafe preview path: ${path}`);
  const parts: string[] = [];
  for (const part of normalized.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (parts.length === 0) throw new Error(`Unsafe preview path: ${path}`);
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join("/");
};

const extractImports = (source: string): string[] => {
  const imports = new Set<string>();
  const pattern = /(?:from\s*["']([^"']+)["']|import\s*["']([^"']+)["'])/g;
  for (const match of source.matchAll(pattern)) {
    const value = match[1] ?? match[2];
    if (value) imports.add(value);
  }
  return [...imports];
};

const classifyImport = (value: string): CompatibilityClass => {
  if (blockedImports.has(value)) return "blocked";
  if (nativeOnlyImports.has(value)) return "native_only";
  if (webCompatibleImports.has(value)) return "web_compatible";
  if (value.startsWith(".")) return "supported";
  return "native_only";
};

const resolveRelative = (from: string, dependency: string, files: Readonly<Record<string, string>>): string => {
  const base = from.includes("/") ? from.slice(0, from.lastIndexOf("/")) : "";
  const candidate = normalizePath(`${base}/${dependency}`);
  const candidates = [candidate, `${candidate}.tsx`, `${candidate}.ts`, `${candidate}.jsx`, `${candidate}.js`, `${candidate}/index.tsx`, `${candidate}/index.ts`];
  return candidates.find((path) => Object.prototype.hasOwnProperty.call(files, path)) ?? candidate;
};

const fileFormat = (path: string): PreviewModule["format"] => path.endsWith(".json") ? "json" : path.endsWith(".ts") && !path.endsWith(".tsx") ? "ts" : path.match(/\.(png|jpe?g|gif|svg|webp)$/i) ? "asset" : "tsx";
const mimeType = (path: string): string => path.endsWith(".svg") ? "image/svg+xml" : path.endsWith(".png") ? "image/png" : path.endsWith(".jpg") || path.endsWith(".jpeg") ? "image/jpeg" : "application/octet-stream";

const renderFixtureTree = (source: string, projectId: string): PreviewRenderNode => {
  const textMatches = [...source.matchAll(/<Text[^>]*>([^<]+)</g)].map((match) => match[1]?.trim()).filter((text): text is string => Boolean(text));
  const title = textMatches[0] ?? "Embedded project preview";
  const body = textMatches[1] ?? `Project ${projectId} is running in compatibility mode.`;
  return { type: "view", props: { role: "screen", projectId }, children: [
    { type: "text", text: title, props: { role: "heading" } },
    { type: "text", text: body, props: { role: "paragraph" } },
    { type: "card", text: "Preview session", props: { status: "ready" } },
    { type: "status", text: "embedded_web", props: { nativeFidelity: "compatibility" } },
  ] };
};

const stableHash = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};
