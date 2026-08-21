import type { DeviceProfile, PreviewSession } from "../domain/entities.js";
import type { DeviceProfileId, PreviewSessionId } from "../domain/primitives.js";
import type { FoundationUseCases } from "../application/use-cases.js";
import type { PreviewInput, PreviewFrame, PreviewScreenshot, LightweightPreviewAdapter } from "./preview.js";
import type { PreviewInspection } from "../ipc/contracts.js";

export interface EmbeddedSimulatorController {
  start(input: { deviceProfileId: DeviceProfileId; mode?: PreviewSession["mode"] }): Promise<PreviewSession>;
  sendInput(sessionId: PreviewSessionId, input: PreviewInput): Promise<PreviewFrame>;
  refresh(sessionId: PreviewSessionId, kind?: "fast" | "reload"): Promise<PreviewFrame>;
  capture(sessionId: PreviewSessionId): Promise<PreviewScreenshot>;
  inspect(sessionId: PreviewSessionId): PreviewInspection;
  stop(sessionId: PreviewSessionId): Promise<void>;
}

export class InMemoryEmbeddedSimulatorController implements EmbeddedSimulatorController {
  private readonly profiles = new Map<DeviceProfileId, DeviceProfile>();
  private readonly sessions = new Map<PreviewSessionId, PreviewSession>();
  private readonly frames = new Map<PreviewSessionId, PreviewFrame>();
  private readonly profileIds = new Map<PreviewSessionId, DeviceProfileId>();

  public constructor(
    private readonly useCases: FoundationUseCases,
    private readonly adapter: LightweightPreviewAdapter,
  ) {}

  public registerProfile(profile: DeviceProfile): void {
    this.profiles.set(profile.id, profile);
  }

  public getProfile(id: DeviceProfileId): DeviceProfile | undefined {
    return this.profiles.get(id);
  }

  public async start(input: { deviceProfileId: DeviceProfileId; mode?: PreviewSession["mode"] }): Promise<PreviewSession> {
    const profile = this.profiles.get(input.deviceProfileId);
    if (!profile) throw new Error(`Device profile ${input.deviceProfileId} was not registered in the embedded controller.`);
    const session = this.useCases.createPreview(input);
    this.useCases.transitionPreview(session.id, "starting");
    const frame = await this.adapter.start({ ...session, status: "starting" }, profile);
    this.frames.set(session.id, frame);
    this.profileIds.set(session.id, profile.id);
    const ready = this.useCases.transitionPreview(session.id, "ready");
    this.sessions.set(ready.id, ready);
    return ready;
  }

  public async sendInput(sessionId: PreviewSessionId, input: PreviewInput): Promise<PreviewFrame> {
    const session = this.requireSession(sessionId);
    if (session.status !== "ready" && session.status !== "refreshing" && session.status !== "reloading") throw new Error(`Preview ${sessionId} is not ready for input.`);
    const frame = await this.adapter.sendInput(sessionId, input);
    this.frames.set(sessionId, frame);
    return frame;
  }

  public async refresh(sessionId: PreviewSessionId, kind: "fast" | "reload" = "fast"): Promise<PreviewFrame> {
    const session = this.requireSession(sessionId);
    this.useCases.transitionPreview(sessionId, kind === "fast" ? "refreshing" : "reloading");
    const profileId = this.profileIds.get(sessionId);
    const profile = profileId ? this.profiles.get(profileId) : undefined;
    if (!profile) {
      this.sessions.set(sessionId, this.useCases.transitionPreview(sessionId, "failed"));
      throw new Error("The embedded controller cannot refresh without a registered profile.");
    }
    const refreshed = await this.adapter.start({ ...session, status: kind === "fast" ? "refreshing" : "reloading" }, profile);
    this.frames.set(sessionId, refreshed);
    this.sessions.set(sessionId, this.useCases.transitionPreview(sessionId, "ready"));
    return refreshed;
  }

  public async capture(sessionId: PreviewSessionId): Promise<PreviewScreenshot> {
    this.requireSession(sessionId);
    return this.adapter.capture(sessionId);
  }

  public inspect(sessionId: PreviewSessionId): PreviewInspection {
    const session = this.requireSession(sessionId);
    return {
      sessionId,
      state: session.status,
      mode: session.mode,
      nativeFidelity: session.mode === "lightweight_web" ? "compatibility" : "native",
      warnings: session.mode === "lightweight_web" ? ["Native modules and OS sensors are not simulated by this transport."] : [],
    };
  }

  public async stop(sessionId: PreviewSessionId): Promise<void> {
    const session = this.requireSession(sessionId);
    if (session.status !== "stopped") this.useCases.transitionPreview(sessionId, "stopping");
    await this.adapter.stop(sessionId);
    this.useCases.transitionPreview(sessionId, "stopped");
    this.sessions.set(sessionId, { ...session, status: "stopped" });
    this.frames.delete(sessionId);
    this.profileIds.delete(sessionId);
  }

  private requireSession(id: PreviewSessionId): PreviewSession {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Embedded preview session ${id} was not found.`);
    return session;
  }

  private requireFrame(id: PreviewSessionId): PreviewFrame {
    const frame = this.frames.get(id);
    if (!frame) throw new Error(`Embedded preview frame ${id} was not found.`);
    return frame;
  }
}
