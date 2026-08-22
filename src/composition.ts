import { FoundationUseCases } from "./application/use-cases.js";
import { GeneralProjectDetector } from "./application/mobile-services.js";
import { BoundedAgentRuntime } from "./application/agent-runtime.js";
import { InMemoryApprovalWorkflow } from "./application/approval-workflow.js";
import { ProviderGateway } from "./application/provider-gateway.js";
import { FilesystemProjectContextIndex } from "./application/project-context.js";
import { AgentWorkCycleService } from "./application/agent-work-cycle.js";
import { InMemoryHumanGate } from "./application/human-gate.js";
import { ResourcePolicy } from "./application/resource-policy.js";
import type { ApplicationDependencies } from "./application/ports.js";
import type { EventBus } from "./domain/events.js";
import { FixedClock, InMemoryAuditTrail, InMemoryCheckpointStore, InMemoryEventBus, InMemoryProviderRouteAudit, InMemoryRepositories, IncrementingIds } from "./infrastructure/in-memory.js";
import { createSqliteApplicationStorage, type SqliteApplicationStorage } from "./infrastructure/sqlite.js";
import { FileProfileLock, resolveProfilePaths, type ProfileLock, type ProfilePaths } from "./infrastructure/profile-storage.js";
import { GitStatusAdapter } from "./infrastructure/git-status.js";
import { FilesystemPatchAdapter } from "./infrastructure/filesystem-patch.js";
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
    }
  | {
      readonly kind: "sqlite-profile";
      readonly userDataDirectory: string;
      readonly profileId?: string;
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
  readonly profilePaths?: ProfilePaths;
  readonly profileLock?: ProfileLock;
} => {
  const storage = options.storage ?? { kind: "memory" as const };
  if (storage.kind === "memory") return { repositories: new InMemoryRepositories(), events: new InMemoryEventBus(), storageKind: "memory" };

  const ids = new IncrementingIds();
  const profilePaths = storage.kind === "sqlite-profile" ? resolveProfilePaths({ userDataDirectory: storage.userDataDirectory, profileId: storage.profileId }) : undefined;
  const databasePath = storage.kind === "sqlite-profile" ? profilePaths!.databasePath : storage.databasePath;
  const migrationsPath = storage.migrationsPath;
  let profileLock: FileProfileLock | undefined;
  try {
    if (profilePaths) profileLock = FileProfileLock.acquire(profilePaths.profileDirectory, profilePaths.lockPath);
    const sqlite = createSqliteApplicationStorage({ databasePath, migrationsPath }, ids);
    return { repositories: sqlite.repositories, events: sqlite.events, sqlite, storageKind: "sqlite", profilePaths, profileLock };
  } catch (error) {
    profileLock?.release();
    if (!storage.allowFallback) throw error;
    return {
      repositories: new InMemoryRepositories(),
      events: new InMemoryEventBus(),
      storageKind: "memory",
      storageFallbackReason: "sqlite_initialization_failed",
      profilePaths,
    };
  }
};

export const createEmbeddedApplication = (options: EmbeddedApplicationOptions = {}) => {
  const persistence = createPersistence(options);
  const foundation = createFoundationFromStorage(persistence.repositories, persistence.events);
  const resourcePolicy = new ResourcePolicy("low_memory");
  const auditTrail = persistence.sqlite?.audit ?? new InMemoryAuditTrail();
  const approvalWorkflow = new InMemoryApprovalWorkflow(foundation.dependencies, auditTrail);
  const humanGate = new InMemoryHumanGate(approvalWorkflow);
  const providerRouteAudit = new InMemoryProviderRouteAudit();
  const providerGateway = new ProviderGateway([], { audit: providerRouteAudit, now: () => foundation.dependencies.clock.now() });
  const agentRuntime = new BoundedAgentRuntime(resourcePolicy, approvalWorkflow);
  const controller = new InMemoryEmbeddedSimulatorController(foundation.useCases, new InMemoryLightweightPreviewAdapter(), resourcePolicy);
  const ipc = new InMemoryIpcTransport();
  const scanner = new FilesystemProjectScanner({ limits: resourcePolicy.limits });
  const projectContextIndex = new FilesystemProjectContextIndex(scanner, new GitStatusAdapter(), resourcePolicy, () => foundation.dependencies.clock.now());
  const checkpointStore = new InMemoryCheckpointStore();
  const projectPatchAdapter = new FilesystemPatchAdapter(resourcePolicy);
  const agentWorkCycle = new AgentWorkCycleService({
    runtime: agentRuntime,
    context: projectContextIndex,
    patches: projectPatchAdapter,
    checkpoints: checkpointStore,
    events: persistence.events,
    now: () => foundation.dependencies.clock.now(),
    nextId: (prefix) => foundation.dependencies.ids.next(prefix),
  });
  const projectPreviewService = new FilesystemProjectPreviewService(scanner, resourcePolicy);
  const generalProjectDetector = new GeneralProjectDetector(scanner);
  const defaultProfiles = [
    foundation.useCases.registerDeviceProfile({ id: "pixel-9", name: "Pixel 9", platform: "android", osVersion: "15", width: 1080, height: 2424, dpi: 420 }),
    foundation.useCases.registerDeviceProfile({ id: "iphone-16", name: "iPhone 16", platform: "ios", osVersion: "18", width: 393, height: 852, dpi: 3 }),
    foundation.useCases.registerDeviceProfile({ id: "android-tablet", name: "Android Tablet", platform: "android", osVersion: "15", width: 1600, height: 2560, dpi: 320 }),
  ];
  defaultProfiles.forEach((profile) => controller.registerProfile(profile));
  registerEmbeddedSimulatorHandlers(ipc, controller, projectPreviewService, { context: projectContextIndex, workCycle: agentWorkCycle, humanGate });
  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    persistence.sqlite?.database.close();
    persistence.profileLock?.release();
  };
  return {
    ...foundation,
    controller,
    ipc,
    projectPreviewService,
    generalProjectDetector,
    projectContextIndex,
    checkpointStore,
    projectPatchAdapter,
    agentWorkCycle,
    resourcePolicy,
    agentRuntime,
    approvalWorkflow,
    humanGate,
    auditTrail,
    providerGateway,
    providerRouteAudit,
    defaultProfiles,
    sqlite: persistence.sqlite,
    storageKind: persistence.storageKind,
    storageFallbackReason: persistence.storageFallbackReason,
    profilePaths: persistence.profilePaths,
    close,
  };
};
