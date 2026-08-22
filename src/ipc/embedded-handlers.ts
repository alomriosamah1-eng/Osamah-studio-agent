import type { AgentWorkCycleService } from "../application/agent-work-cycle.js";
import type { HumanGatePort } from "../application/human-gate.js";
import type { LocalProviderConfig, LocalProviderId, ProviderDoctorReport } from "../application/provider-policy.js";
import type { ProviderListItem } from "./contracts.js";
import type { FilesystemProjectContextIndex } from "../application/project-context.js";
import type { ProjectPreviewService } from "../application/project-preview-service.js";
import type { InMemoryEmbeddedSimulatorController } from "../mobile/embedded-controller.js";
import type { InMemoryIpcTransport } from "./in-memory-transport.js";

export interface AgentIpcDependencies {
  readonly context: Pick<FilesystemProjectContextIndex, "build">;
  readonly workCycle: Pick<AgentWorkCycleService, "start" | "inspect" | "cancel">;
  readonly humanGate: Pick<HumanGatePort, "listPending" | "decide">;
  readonly providers: {
    readonly list: () => readonly ProviderListItem[];
    readonly configure: (config: LocalProviderConfig) => LocalProviderConfig;
    readonly doctor: (providerId?: LocalProviderId) => Promise<readonly ProviderDoctorReport[]>;
  };
}

export const registerEmbeddedSimulatorHandlers = (
  transport: InMemoryIpcTransport,
  controller: InMemoryEmbeddedSimulatorController,
  projectPreviewService: ProjectPreviewService,
  agentDependencies?: AgentIpcDependencies,
): void => {
  transport.register("health.get", async () => ({ status: "ok", version: "0.4.0-presentation-renderer" }));
  transport.register("device.get", async (request) => {
    const profile = controller.getProfile(request.payload.deviceProfileId);
    if (!profile) throw new Error(`Device profile ${request.payload.deviceProfileId} was not found.`);
    return profile;
  });
  transport.register("preview.start", (request) => controller.start(request.payload));
  transport.register("preview.openProject", async (request) => {
    const bundle = await projectPreviewService.build({
      projectId: request.payload.projectId,
      rootPath: request.payload.rootPath,
      entry: request.payload.entry,
    });
    const session = await controller.start({
      deviceProfileId: request.payload.deviceProfileId,
      mode: request.payload.mode,
      bundle,
    });
    return {
      session,
      bundle: {
        projectId: bundle.projectId,
        entry: bundle.entry,
        sourceHash: bundle.sourceHash,
        moduleCount: bundle.modules.length,
        warningCount: bundle.warnings.length,
      },
    };
  });
  transport.register("preview.input", (request) => controller.sendInput(request.payload.sessionId, request.payload.input));
  transport.register("preview.refresh", (request) => controller.refresh(request.payload.sessionId, request.payload.kind, request.payload.bundle));
  transport.register("preview.capture", (request) => controller.capture(request.payload.sessionId));
  transport.register("preview.inspect", async (request) => controller.inspect(request.payload.sessionId));
  transport.register("preview.stop", async (request) => {
    await controller.stop(request.payload.sessionId);
    return { stopped: true as const };
  });
  if (agentDependencies) {
    transport.register("context.index", (request) => agentDependencies.context.build(request.payload.rootPath));
    transport.register("workCycle.start", (request) => agentDependencies.workCycle.start(request.payload));
    transport.register("workCycle.inspect", (request) => Promise.resolve(agentDependencies.workCycle.inspect(request.payload.cycleId)));
    transport.register("workCycle.cancel", (request) => Promise.resolve(agentDependencies.workCycle.cancel(request.payload.cycleId)));
    transport.register("approval.listPending", (request) => Promise.resolve(agentDependencies.humanGate.listPending(request.payload.limit)));
    transport.register("approval.decide", (request) => Promise.resolve(agentDependencies.humanGate.decide(request.payload.approvalId, request.payload.decision)));
    transport.register("provider.list", async () => agentDependencies.providers.list());
    transport.register("provider.configure", async (request) => agentDependencies.providers.configure(request.payload));
    transport.register("provider.doctor", async (request) => agentDependencies.providers.doctor(request.payload.providerId));
  }
};
