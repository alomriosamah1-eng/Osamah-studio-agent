import type { InMemoryEmbeddedSimulatorController } from "../mobile/embedded-controller.js";
import type { InMemoryIpcTransport } from "./in-memory-transport.js";

export const registerEmbeddedSimulatorHandlers = (
  transport: InMemoryIpcTransport,
  controller: InMemoryEmbeddedSimulatorController,
): void => {
  transport.register("health.get", async () => ({ status: "ok", version: "0.1.0-foundation" }));
  transport.register("device.get", async (request) => {
    const profile = controller.getProfile(request.payload.deviceProfileId);
    if (!profile) throw new Error(`Device profile ${request.payload.deviceProfileId} was not found.`);
    return profile;
  });
  transport.register("preview.start", (request) => controller.start(request.payload));
  transport.register("preview.input", (request) => controller.sendInput(request.payload.sessionId, request.payload.input));
  transport.register("preview.refresh", (request) => controller.refresh(request.payload.sessionId, request.payload.kind, request.payload.bundle));
  transport.register("preview.capture", (request) => controller.capture(request.payload.sessionId));
  transport.register("preview.inspect", async (request) => controller.inspect(request.payload.sessionId));
  transport.register("preview.stop", async (request) => {
    await controller.stop(request.payload.sessionId);
    return { stopped: true as const };
  });
};
