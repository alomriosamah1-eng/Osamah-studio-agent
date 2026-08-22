import type { ProjectPreviewService } from "../application/project-preview-service.js";
import type { InMemoryEmbeddedSimulatorController } from "../mobile/embedded-controller.js";
import type { InMemoryIpcTransport } from "./in-memory-transport.js";

export const registerEmbeddedSimulatorHandlers = (
  transport: InMemoryIpcTransport,
  controller: InMemoryEmbeddedSimulatorController,
  projectPreviewService: ProjectPreviewService,
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
};
