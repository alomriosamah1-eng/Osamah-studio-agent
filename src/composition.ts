import { FoundationUseCases } from "./application/use-cases.js";
import { GeneralProjectDetector } from "./application/mobile-services.js";
import { BoundedAgentRuntime } from "./application/agent-runtime.js";
import { ResourcePolicy } from "./application/resource-policy.js";
import type { ApplicationDependencies } from "./application/ports.js";
import type { EventBus } from "./domain/events.js";
import { FixedClock, InMemoryEventBus, InMemoryRepositories, IncrementingIds } from "./infrastructure/in-memory.js";
import { createSqliteApplicationStorage, type SqliteApplicationStorage } from "./infrastructure/sqlite.js";
import { InMemoryLightweightPreviewAdapter } from "./mobile/preview.js";
import { InMemoryEmbeddedSimulatorController } from "./mobile/embedded-controller.js";
import { InMemoryIpcTransport } from "./ipc/in-memory-transport.js";
import { registerEmbeddedSimulatorHandlers } from "./ipc/embedded-handlers.js";
import { FilesystemProjectPreviewService } from "./application/project-preview-service.js";
import { FilesystemProjectScanner } from "./infrastructure/filesystem-project-scanner.js";

export type EmbeddedApplicationStorageOptions =
  | { readonly kind: "memory" }
  | {
      readonly kind: "sqlite";
      readonly databasePath: string;
      readonly migrationsPath: string;
      readonly allowFallback?: boolean;
    };

export interface EmbeddedApplicationOptions {
  readonly storage?: EmbeddedApplicationStorageOptions;
}

type RepositoryBundle = Pick<ApplicationDependencies, "workspaces" | "sessions" | "approvals" | "devices" | "previews">;

const createFoundationFromStorage = (storage: RepositoryBundle, events: EventBus): { useCases: FoundationUseCases; dependencies: ApplicationDependencies } => {
  const dependencies: ApplicationDependencies = {
    workspaces: storage.workspaces,
    sessions: storage.sessions,
    approvals: storage.approvals,
    devices: storage.devices,
    previews: storage.previews,
    events,
    clock: new FixedClock(),
    ids: new IncrementingIds(),
  };
  return { useCases: new FoundationUseCases(dependencies), dependencies };
};

export const createFoundation = (): { useCases: FoundationUseCases; dependencies: ApplicationDependencies } => createFoundationFromStorage(new InMemoryRepositories(), new InMemoryEventBus());

const createPersistence = (options: EmbeddedApplicationOptions): {
  readonly repositories: RepositoryBundle;
  readonly events: EventBus;
  readonly sqlite?: SqliteApplicationStorage;
  readonly storageKind: "memory" | "sqlite";
  readonly storageFallbackReason?: "sqlite_initialization_failed";
} => {
  const storage = options.storage ?? { kind: "memory" as const };
  if (storage.kind === "memory") return { repositories: new InMemoryRepositories(), events: new InMemoryEventBus(), storageKind: "memory" };

  const ids = new IncrementingIds();
  try {
    const sqlite = createSqliteApplicationStorage({ databasePath: storage.databasePath, migrationsPath: storage.migrationsPath }, ids);
    return { repositories: sqlite.repositories, events: sqlite.events, sqlite, storageKind: "sqlite" };
  } catch (error) {
    if (!storage.allowFallback) throw error;
    return {
      repositories: new InMemoryRepositories(),
      events: new InMemoryEventBus(),
      storageKind: "memory",
      storageFallbackReason: "sqlite_initialization_failed",
    };
  }
};

export const createEmbeddedApplication = (options: EmbeddedApplicationOptions = {}) => {
  const persistence = createPersistence(options);
  const foundation = createFoundationFromStorage(persistence.repositories, persistence.events);
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
  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    persistence.sqlite?.database.close();
  };
  return {
    ...foundation,
    controller,
    ipc,
    projectPreviewService,
    generalProjectDetector,
    resourcePolicy,
    agentRuntime,
    defaultProfiles,
    sqlite: persistence.sqlite,
    storageKind: persistence.storageKind,
    storageFallbackReason: persistence.storageFallbackReason,
    close,
  };
};
