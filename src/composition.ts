import { FoundationUseCases } from "./application/use-cases.js";
import { GeneralProjectDetector } from "./application/mobile-services.js";
import { BoundedAgentRuntime } from "./application/agent-runtime.js";
import { ResourcePolicy } from "./application/resource-policy.js";
import type { ApplicationDependencies } from "./application/ports.js";
import { FixedClock, InMemoryEventBus, InMemoryRepositories, IncrementingIds } from "./infrastructure/in-memory.js";
import { InMemoryLightweightPreviewAdapter } from "./mobile/preview.js";
import { InMemoryEmbeddedSimulatorController } from "./mobile/embedded-controller.js";
import { InMemoryIpcTransport } from "./ipc/in-memory-transport.js";
import { registerEmbeddedSimulatorHandlers } from "./ipc/embedded-handlers.js";
import { FilesystemProjectPreviewService } from "./application/project-preview-service.js";
import { FilesystemProjectScanner } from "./infrastructure/filesystem-project-scanner.js";

export const createFoundation = (): { useCases: FoundationUseCases; dependencies: ApplicationDependencies } => {
  const repositories = new InMemoryRepositories();
  const dependencies: ApplicationDependencies = {
    workspaces: repositories.workspaces,
    sessions: repositories.sessions,
    approvals: repositories.approvals,
    devices: repositories.devices,
    previews: repositories.previews,
    events: new InMemoryEventBus(),
    clock: new FixedClock(),
    ids: new IncrementingIds(),
  };
  return { useCases: new FoundationUseCases(dependencies), dependencies };
};

export const createEmbeddedApplication = () => {
  const foundation = createFoundation();
  const resourcePolicy = new ResourcePolicy("low_memory");
  const agentRuntime = new BoundedAgentRuntime(resourcePolicy);
  const controller = new InMemoryEmbeddedSimulatorController(foundation.useCases, new InMemoryLightweightPreviewAdapter(), resourcePolicy);
  const ipc = new InMemoryIpcTransport();
  const scanner = new FilesystemProjectScanner({ limits: resourcePolicy.limits });
  const projectPreviewService = new FilesystemProjectPreviewService(scanner, resourcePolicy);
  const generalProjectDetector = new GeneralProjectDetector(scanner);
  const defaultProfiles = [
    foundation.useCases.registerDeviceProfile({ id: "pixel-9", name: "Pixel 9", platform: "android", osVersion: "15", width: 1080, height: 2424, dpi: 420 }),
    foundation.useCases.registerDeviceProfile({ id: "iphone-16", name: "iPhone 16", platform: "ios", osVersion: "18", width: 393, height: 852, dpi: 3 }),
    foundation.useCases.registerDeviceProfile({ id: "android-tablet", name: "Android Tablet", platform: "android", osVersion: "15", width: 1600, height: 2560, dpi: 320 }),
  ];
  defaultProfiles.forEach((profile) => controller.registerProfile(profile));
  registerEmbeddedSimulatorHandlers(ipc, controller, projectPreviewService);
  return { ...foundation, controller, ipc, projectPreviewService, generalProjectDetector, resourcePolicy, agentRuntime, defaultProfiles };
};
