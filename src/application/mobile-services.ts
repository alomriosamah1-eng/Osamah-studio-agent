import { detectMobileProject, getPlatformCapabilityMatrix, type HostPlatform, type MobileProjectDescriptor, type PlatformCapabilityMatrix } from "../domain/mobile.js";
import type { ProjectScanner } from "./ports.js";

export class MobileProjectDetector {
  public constructor(private readonly scanner: ProjectScanner) {}

  public async detect(rootPath: string): Promise<MobileProjectDescriptor> {
    const files = await this.scanner.listRelativeFiles(rootPath);
    const packageJson = await this.scanner.readJson(rootPath, "package.json");
    const dependencies = this.readRecord(packageJson?.dependencies);
    const devDependencies = this.readRecord(packageJson?.devDependencies);
    const main = typeof packageJson?.main === "string" ? packageJson.main : undefined;
    return detectMobileProject({ rootPath, files, packageJson: { dependencies, devDependencies, main } });
  }

  private readRecord(value: unknown): Record<string, string> {
    if (!value || typeof value !== "object") return {};
    return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  }
}

export class PlatformCapabilityService {
  public inspect(host: HostPlatform): PlatformCapabilityMatrix {
    return getPlatformCapabilityMatrix(host);
  }
}
