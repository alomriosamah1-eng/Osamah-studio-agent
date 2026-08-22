export type ProjectKind = "react_native" | "react" | "web" | "node" | "python" | "go" | "java" | "rust" | "generic";
export type PreviewCapability = "lightweight_web" | "none";

export interface ProjectClassification {
  readonly kind: ProjectKind;
  readonly preview: PreviewCapability;
  readonly confidence: "high" | "medium" | "low";
  readonly reasons: readonly string[];
}

export interface ProjectClassificationInput {
  readonly files: readonly string[];
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
}

export const classifyProject = (input: ProjectClassificationInput): ProjectClassification => {
  const dependencies = { ...(input.dependencies ?? {}), ...(input.devDependencies ?? {}) };
  const files = new Set(input.files);
  const hasReactNative = "react-native" in dependencies || "expo" in dependencies || files.has("app.json") || files.has("app.config.js") || files.has("app.config.ts");
  const hasReact = "react" in dependencies || "react-dom" in dependencies || input.files.some((file) => /\.(jsx|tsx)$/.test(file));
  const hasWebEntry = files.has("index.html") || files.has("vite.config.ts") || files.has("vite.config.js") || files.has("webpack.config.js");
  const hasNode = "node" in dependencies || files.has("package.json") && input.files.some((file) => /(^|\/)(server|api|backend)\//.test(file));
  const hasPython = input.files.some((file) => file === "pyproject.toml" || file === "requirements.txt" || file.endsWith(".py"));
  const hasGo = files.has("go.mod") || input.files.some((file) => file.endsWith(".go"));
  const hasJava = files.has("pom.xml") || files.has("build.gradle") || input.files.some((file) => file.endsWith(".java"));
  const hasRust = files.has("Cargo.toml") || input.files.some((file) => file.endsWith(".rs"));

  if (hasReactNative) return { kind: "react_native", preview: "lightweight_web", confidence: "high", reasons: ["React Native or Expo dependency/configuration detected.", "Use Web compatibility preview; native transport is optional."] };
  if (hasReact) return { kind: "react", preview: "lightweight_web", confidence: "high", reasons: ["React dependency or JSX/TSX source detected.", "Use lightweight Web preview when an entry is available."] };
  if (hasWebEntry) return { kind: "web", preview: "lightweight_web", confidence: "medium", reasons: ["Web entry or bundler configuration detected."] };
  if (hasPython) return { kind: "python", preview: "none", confidence: "medium", reasons: ["Python project markers detected.", "Keep project available to editor and agents without starting a preview process."] };
  if (hasGo) return { kind: "go", preview: "none", confidence: "medium", reasons: ["Go module/source detected."] };
  if (hasJava) return { kind: "java", preview: "none", confidence: "medium", reasons: ["Java build/source detected."] };
  if (hasRust) return { kind: "rust", preview: "none", confidence: "medium", reasons: ["Rust Cargo/source detected."] };
  if (hasNode) return { kind: "node", preview: "none", confidence: "low", reasons: ["Node project markers detected without a recognized UI preview."] };
  return { kind: "generic", preview: "none", confidence: "low", reasons: ["No recognized preview target; keep the project in general Workspace mode."] };
};
