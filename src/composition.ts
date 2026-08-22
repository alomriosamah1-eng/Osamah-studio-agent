import { FoundationUseCases } from "./application/use-cases.js";
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
  const controller = new InMemoryEmbeddedSimulatorController(foundation.useCases, new InMemoryLightweightPreviewAdapter());
  const ipc = new InMemoryIpcTransport();
  const projectPreviewService = new FilesystemProjectPreviewService(new FilesystemProjectScanner());
  registerEmbeddedSimulatorHandlers(ipc, controller, projectPreviewService);
  return { ...foundation, controller, ipc, projectPreviewService };
};
