import { FoundationUseCases } from "./application/use-cases.js";
import { GeneralProjectDetector } from "./application/mobile-services.js";
import { BoundedAgentRuntime } from "./application/agent-runtime.js";
import { InMemoryApprovalWorkflow } from "./application/approval-workflow.js";
import { ProviderGateway } from "./application/provider-gateway.js";
import { FilesystemProjectContextIndex } from "./application/project-context.js";
import { AgentWorkCycleService } from "./application/agent-work-cycle.js";
import { AgentTaskPreviewService } from "./application/agent-task-preview.js";
import { InMemoryHumanGate } from "./application/human-gate.js";
import { ResourcePolicy } from "./application/resource-policy.js";
import { BoundedAuditRetentionPolicy } from "./application/audit-policy.js";
import { DeterministicPlannerCritic, LlmPlanner, ProviderBackedPlannerCritic } from "./application/planner-critic.js";
import { BoundedProviderConfiguration, BoundedProviderExecutionPolicy, defaultLocalProviderConfig, isLocalProviderId, type LocalProviderConfig, type LocalProviderId } from "./application/provider-policy.js";
import type { ApplicationDependencies } from "./application/ports.js";
import type { ProviderAdapter } from "./application/provider-contracts.js";
import type { EventBus } from "./domain/events.js";
import { FixedClock, InMemoryApprovalStore, InMemoryAuditTrail, InMemoryCheckpointStore, InMemoryEventBus, InMemoryProviderRouteAudit, InMemoryRepositories, IncrementingIds } from "./infrastructure/in-memory.js";
import { createSqliteApplicationStorage, type SqliteApplicationStorage } from "./infrastructure/sqlite.js";
import type { ApprovalStore } from "./application/agent-contracts.js";
import { FileProfileLock, resolveProfilePaths, type ProfileLock, type ProfilePaths } from "./infrastructure/profile-storage.js";
import { GitStatusAdapter } from "./infrastructure/git-status.js";
import { FilesystemPatchAdapter } from "./infrastructure/filesystem-patch.js";
import { InMemoryLightweightPreviewAdapter } from "./mobile/preview.js";
import { InMemoryEmbeddedSimulatorController } from "./mobile/embedded-controller.js";
import { InMemoryIpcTransport } from "./ipc/in-memory-transport.js";
import { registerEmbeddedSimulatorHandlers } from "./ipc/embedded-handlers.js";
import type { ProviderListItem } from "./ipc/contracts.js";
import { FilesystemProjectPreviewService } from "./application/project-preview-service.js";
import { FilesystemProjectScanner } from "./infrastructure/filesystem-project-scanner.js";
import { FilesystemProjectExplorer, FilesystemWorkspaceFileReader } from "./infrastructure/filesystem-project-explorer.js";
import { InMemoryEditorDocumentStore } from "./infrastructure/in-memory-editor-document.js";
import { BoundedTerminalPolicy } from "./application/terminal-policy.js";
import { FilesystemGitReadOnlyAdapter } from "./infrastructure/git-read-only.js";
import { LocalAuditExportProvider } from "./infrastructure/audit-export.js";
import { LocalProviderDoctor } from "./infrastructure/local-provider-doctor.js";
import { InMemorySourceRegistry } from "./application/source-registry.js";
import { InMemoryContentPlanService } from "./application/content-plan.js";
import { InMemoryAssetCatalog } from "./application/asset-catalog.js";
import { InMemoryArtifactAssembly } from "./application/artifact-assembly.js";
import { InMemoryRenderPolicy } from "./application/render-policy.js";
import { InMemoryMemoryCapture } from "./application/memory-capture.js";
import { InMemoryAgentCatalog } from "./application/agent-catalog.js";
import { InMemoryReportDocumentService } from "./application/report-document.js";
import { InMemoryMarkdownExportService } from "./application/markdown-export.js";
import { MarkdownDestinationService, type MarkdownDestinationPort } from "./application/markdown-destination.js";
import { LocalMarkdownDestinationWriter } from "./infrastructure/markdown-destination.js";
import { OpenCodeSdkProviderAdapter, type OpenCodeSdkProviderOptions } from "./infrastructure/opencode-sdk-provider.js";
import { InMemoryApplicationSettings } from "./application/application-settings.js";
import { InMemoryExternalAccountRegistry } from "./application/external-account-registry.js";
import { createStorageSettingsSnapshot, StaticStorageSettings } from "./application/storage-settings.js";
import { InMemorySelfDevelopmentCandidateService } from "./application/self-development.js";
import { InMemoryMemoryConsolidationService } from "./application/memory-consolidation.js";

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
  /** Providers are opt-in; construction never performs health checks or model loading. */
  readonly providers?: readonly ProviderAdapter[];
  /** Execution policy is opt-in and applies only to explicitly configured provider IDs. */
  readonly providerConfigs?: readonly LocalProviderConfig[];
  /** OpenCode SDK is opt-in; construction is inert and performs no health check or server startup. */
  readonly openCode?: OpenCodeSdkProviderOptions;
  /** Markdown destination writes are opt-in and require an explicit safe root. */
  readonly markdownDestinationRoot?: string;
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
  readonly approvalStore: ApprovalStore;
} => {
  const storage = options.storage ?? { kind: "memory" as const };
  if (storage.kind === "memory") return { repositories: new InMemoryRepositories(), events: new InMemoryEventBus(), approvalStore: new InMemoryApprovalStore(), storageKind: "memory" };

  const ids = new IncrementingIds();
  const profilePaths = storage.kind === "sqlite-profile" ? resolveProfilePaths({ userDataDirectory: storage.userDataDirectory, profileId: storage.profileId }) : undefined;
  const databasePath = storage.kind === "sqlite-profile" ? profilePaths!.databasePath : storage.databasePath;
  const migrationsPath = storage.migrationsPath;
  let profileLock: FileProfileLock | undefined;
  try {
    if (profilePaths) profileLock = FileProfileLock.acquire(profilePaths.profileDirectory, profilePaths.lockPath);
    const sqlite = createSqliteApplicationStorage({ databasePath, migrationsPath }, ids);
    return { repositories: sqlite.repositories, events: sqlite.events, approvalStore: sqlite.approvalStore, sqlite, storageKind: "sqlite", profilePaths, profileLock };
  } catch (error) {
    profileLock?.release();
    if (!storage.allowFallback) throw error;
    return {
      repositories: new InMemoryRepositories(),
      events: new InMemoryEventBus(),
      approvalStore: new InMemoryApprovalStore(),
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
  const auditRetention = new BoundedAuditRetentionPolicy(auditTrail, foundation.dependencies.clock);
  const auditExport = new LocalAuditExportProvider({ trail: auditTrail, clock: foundation.dependencies.clock, sourceProfileDirectory: persistence.profilePaths?.profileDirectory });
  const approvalWorkflow = new InMemoryApprovalWorkflow(foundation.dependencies, auditTrail, persistence.approvalStore);
  const humanGate = new InMemoryHumanGate(approvalWorkflow);
  const providerRouteAudit = new InMemoryProviderRouteAudit();
  const configuredProviders: readonly ProviderAdapter[] = [
    ...(options.providers ?? []),
    ...(options.openCode ? [new OpenCodeSdkProviderAdapter(options.openCode)] : []),
  ];
  const providerConfiguration = new BoundedProviderConfiguration({}, options.providerConfigs ?? []);
  const providerExecutionPolicy = new BoundedProviderExecutionPolicy(options.providerConfigs ?? []);
  const providerDoctor = new LocalProviderDoctor(configuredProviders, () => Date.parse(foundation.dependencies.clock.now()));
  const providerGateway = new ProviderGateway(configuredProviders, { audit: providerRouteAudit, executionPolicy: providerExecutionPolicy, now: () => foundation.dependencies.clock.now() });
  for (const manifest of providerGateway.listProviders()) {
    if (!isLocalProviderId(manifest.id) || providerConfiguration.get(manifest.id)) continue;
    providerExecutionPolicy.configure(defaultLocalProviderConfig(manifest.id, manifest.models[0]?.id ?? "unconfigured-model"));
  }
  const configFor = (providerId: LocalProviderId): LocalProviderConfig => {
    const configured = providerConfiguration.get(providerId);
    if (configured) return configured;
    const manifest = providerGateway.listProviders().find((candidate) => candidate.id === providerId);
    return defaultLocalProviderConfig(providerId, manifest?.models[0]?.id ?? "unconfigured-model");
  };
  const providerControls = {
    list: (): readonly ProviderListItem[] => providerGateway.listProviders().map((manifest) => {
      const configured = isLocalProviderId(manifest.id) ? providerConfiguration.get(manifest.id) : undefined;
      return {
        id: manifest.id,
        label: manifest.label,
        privacy: manifest.privacy,
        offline: manifest.offline,
        capabilities: [...manifest.capabilities],
        models: manifest.models.map((model) => ({ id: model.id, capabilities: [...model.capabilities], contextWindow: model.contextWindow, streaming: model.streaming, offline: model.offline })),
        configured: configured !== undefined,
        enabled: configured?.enabled ?? false,
      };
    }),
    configure: (input: LocalProviderConfig): LocalProviderConfig => {
      const configured = providerConfiguration.configure(input);
      providerExecutionPolicy.configure(configured);
      return configured;
    },
    doctor: async (providerId?: LocalProviderId) => {
      const ids = providerId ? [providerId] : providerGateway.listProviders().map((manifest) => manifest.id).filter(isLocalProviderId);
      return Promise.all(ids.map((id) => providerDoctor.check(configFor(id))));
    },
  };
  const agentRuntime = new BoundedAgentRuntime(resourcePolicy, approvalWorkflow);
  const controller = new InMemoryEmbeddedSimulatorController(foundation.useCases, new InMemoryLightweightPreviewAdapter(), resourcePolicy);
  const ipc = new InMemoryIpcTransport();
  const scanner = new FilesystemProjectScanner({ limits: resourcePolicy.limits });
  const projectContextIndex = new FilesystemProjectContextIndex(scanner, new GitStatusAdapter(), resourcePolicy, () => foundation.dependencies.clock.now());
  const projectExplorer = new FilesystemProjectExplorer(resourcePolicy);
  const workspaceFileReader = new FilesystemWorkspaceFileReader(resourcePolicy);
  const editorDocuments = new InMemoryEditorDocumentStore(workspaceFileReader, resourcePolicy, { nextProposalId: () => foundation.dependencies.ids.next("editor-proposal") });
  const terminalPolicy = new BoundedTerminalPolicy(resourcePolicy);
  const gitReadOnly = new FilesystemGitReadOnlyAdapter();
  const checkpointStore = new InMemoryCheckpointStore();
  const projectPatchAdapter = new FilesystemPatchAdapter(resourcePolicy);
  const plannerCritic = new ProviderBackedPlannerCritic(new LlmPlanner({
    providerGateway,
    nextRequestId: () => foundation.dependencies.ids.next("planner"),
  }));
  const taskPreview = new AgentTaskPreviewService(projectContextIndex, new DeterministicPlannerCritic());
  const sourceRegistry = new InMemorySourceRegistry({ nextId: (prefix) => foundation.dependencies.ids.next(prefix), now: () => foundation.dependencies.clock.now() });
  const agentCatalog = new InMemoryAgentCatalog();
  const memoryAgentScope = { get: (agentId: string) => agentCatalog.get(agentId)?.memoryRequirements };
  const contentPlan = new InMemoryContentPlanService(sourceRegistry, { nextId: (prefix) => foundation.dependencies.ids.next(prefix) });
  const assetCatalog = new InMemoryAssetCatalog(sourceRegistry, { nextId: (prefix) => foundation.dependencies.ids.next(prefix) });
  const artifactAssembly = new InMemoryArtifactAssembly(contentPlan, assetCatalog, assetCatalog, sourceRegistry, { nextId: (prefix) => foundation.dependencies.ids.next(prefix) });
  const renderPolicy = new InMemoryRenderPolicy(artifactAssembly);
  const memoryCapture = new InMemoryMemoryCapture(sourceRegistry, { nextId: (prefix) => foundation.dependencies.ids.next(prefix), now: () => foundation.dependencies.clock.now(), persistence: persistence.sqlite?.memoryEntries, agentScope: memoryAgentScope });
  const reportDocument = new InMemoryReportDocumentService(sourceRegistry, contentPlan, artifactAssembly, { nextId: (prefix) => foundation.dependencies.ids.next(prefix), now: () => foundation.dependencies.clock.now() });
  const markdownExport = new InMemoryMarkdownExportService(reportDocument);
  const markdownDestinationPort: MarkdownDestinationPort = options.markdownDestinationRoot
    ? new LocalMarkdownDestinationWriter({ destinationRoot: options.markdownDestinationRoot, sourceProfileDirectory: persistence.profilePaths?.profileDirectory })
    : { write: async () => { throw new Error("Markdown destination root is not configured."); } };
  const markdownDestination = new MarkdownDestinationService({ markdownExport, destination: markdownDestinationPort, authorization: approvalWorkflow, now: () => foundation.dependencies.clock.now() });
  const applicationSettings = new InMemoryApplicationSettings();
  const externalAccounts = new InMemoryExternalAccountRegistry({ nextId: (prefix) => foundation.dependencies.ids.next(prefix), now: () => foundation.dependencies.clock.now() });
  const storageSettings = new StaticStorageSettings(createStorageSettingsSnapshot({ storageKind: persistence.storageKind, profileId: persistence.profilePaths?.profileId, hasProfileLock: persistence.profileLock !== undefined, fallbackReason: persistence.storageFallbackReason }));
  const selfDevelopment = new InMemorySelfDevelopmentCandidateService({ ids: { next: (prefix) => foundation.dependencies.ids.next(prefix) }, clock: { now: () => foundation.dependencies.clock.now() } });
  const memoryConsolidation = new InMemoryMemoryConsolidationService({ memory: memoryCapture, ids: { next: (prefix) => foundation.dependencies.ids.next(prefix) }, clock: { now: () => foundation.dependencies.clock.now() }, persistence: persistence.sqlite?.memoryCandidates });
  const agentWorkCycle = new AgentWorkCycleService({
    runtime: agentRuntime,
    plannerCritic,
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
  registerEmbeddedSimulatorHandlers(ipc, controller, projectPreviewService, { context: projectContextIndex, taskPreview, sourceRegistry, contentPlan, assetCatalog, creativeBrief: assetCatalog, artifactAssembly, renderPolicy, memoryCapture, agentCatalog, reportDocument, markdownExport, markdownDestination, settings: applicationSettings, externalAccounts, storageSettings, selfDevelopment, memoryConsolidation, explorer: projectExplorer, fileReader: workspaceFileReader, editorDocuments, terminalPolicy, gitReadOnly, workCycle: agentWorkCycle, humanGate, providers: providerControls });
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
    projectExplorer,
    workspaceFileReader,
    editorDocuments,
    terminalPolicy,
    gitReadOnly,
    checkpointStore,
    projectPatchAdapter,
    agentWorkCycle,
    plannerCritic,
    taskPreview,
    sourceRegistry,
    contentPlan,
    assetCatalog,
    artifactAssembly,
    renderPolicy,
    memoryCapture,
    agentCatalog,
    reportDocument,
    markdownExport,
    markdownDestination,
    applicationSettings,
    externalAccounts,
    storageSettings,
    selfDevelopment,
    memoryConsolidation,
    resourcePolicy,
    agentRuntime,
    approvalWorkflow,
    humanGate,
    auditTrail,
    auditRetention,
    auditExport,
    providerGateway,
    providerDoctor,
    providerConfiguration,
    providerExecutionPolicy,
    providerRouteAudit,
    defaultProfiles,
    sqlite: persistence.sqlite,
    storageKind: persistence.storageKind,
    storageFallbackReason: persistence.storageFallbackReason,
    profilePaths: persistence.profilePaths,
    close,
  };
};
