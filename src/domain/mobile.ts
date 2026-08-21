import type { Platform } from "./primitives.js";

export type MobileProjectKind = "expo" | "react-native" | "unknown";
export type HostPlatform = "windows" | "linux" | "macos" | "unknown";

export interface MobileProjectDescriptor {
  readonly kind: MobileProjectKind;
  readonly rootPath: string;
  readonly hasPackageJson: boolean;
  readonly hasExpoConfig: boolean;
  readonly hasMetroConfig: boolean;
  readonly hasAndroidFolder: boolean;
  readonly hasIosFolder: boolean;
  readonly supportsWeb: boolean;
  readonly confidence: "high" | "medium" | "low";
}

export interface PlatformCapabilityMatrix {
  readonly host: HostPlatform;
  readonly lightweightPreview: boolean;
  readonly androidNativeSimulator: "available-if-toolchain" | "unsupported";
  readonly iosNativeSimulator: "available-if-toolchain" | "unsupported";
  readonly remoteBuild: "available-if-configured" | "unsupported";
  readonly physicalDevice: "available-if-toolchain" | "unsupported";
  readonly notes: readonly string[];
}

export const detectMobileProject = (input: {
  rootPath: string;
  files: readonly string[];
  packageJson?: { readonly dependencies?: Record<string, string>; readonly devDependencies?: Record<string, string>; readonly main?: string };
}): MobileProjectDescriptor => {
  const dependencies = { ...(input.packageJson?.dependencies ?? {}), ...(input.packageJson?.devDependencies ?? {}) };
  const hasPackageJson = input.files.some((file) => file === "package.json");
  const hasExpoConfig = input.files.some((file) => /^(app\.json|app\.config\.(js|ts))$/.test(file)) || "expo" in dependencies;
  const hasMetroConfig = input.files.some((file) => /^metro\.config\.(js|cjs|mjs|ts)$/.test(file));
  const hasAndroidFolder = input.files.some((file) => file === "android" || file.startsWith("android/"));
  const hasIosFolder = input.files.some((file) => file === "ios" || file.startsWith("ios/"));
  const isExpo = "expo" in dependencies || hasExpoConfig;
  const isReactNative = "react-native" in dependencies || hasAndroidFolder || hasIosFolder;
  const supportsWeb = "react-native-web" in dependencies || "expo" in dependencies || input.files.some((file) => file === "webpack.config.js" || file === "vite.config.ts");
  return {
    kind: isExpo ? "expo" : isReactNative ? "react-native" : "unknown",
    rootPath: input.rootPath,
    hasPackageJson,
    hasExpoConfig,
    hasMetroConfig,
    hasAndroidFolder,
    hasIosFolder,
    supportsWeb,
    confidence: isExpo || isReactNative ? "high" : hasPackageJson ? "medium" : "low",
  };
};

export const getPlatformCapabilityMatrix = (host: HostPlatform): PlatformCapabilityMatrix => ({
  host,
  lightweightPreview: true,
  androidNativeSimulator: host === "unknown" ? "unsupported" : "available-if-toolchain",
  iosNativeSimulator: host === "macos" ? "available-if-toolchain" : "unsupported",
  remoteBuild: host === "unknown" ? "unsupported" : "available-if-configured",
  physicalDevice: host === "unknown" ? "unsupported" : "available-if-toolchain",
  notes: host === "macos"
    ? ["iOS Simulator requires Xcode and installed simulator runtimes.", "Android Emulator still requires Android SDK/AVD and acceleration."]
    : ["Lightweight preview remains available.", "iOS native simulator is unavailable on this host; use macOS, remote build, or physical-device workflow."]
});

export const platformForDevice = (kind: "expo" | "react-native" | "unknown"): Platform | undefined => kind === "unknown" ? undefined : "web";
