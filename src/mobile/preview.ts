import type { DeviceProfile, PreviewSession } from "../domain/entities.js";
import type { Orientation, PreviewSessionId } from "../domain/primitives.js";

export type PreviewInput =
  | { readonly type: "tap"; readonly x: number; readonly y: number }
  | { readonly type: "long_press"; readonly x: number; readonly y: number; readonly durationMs: number }
  | { readonly type: "swipe"; readonly fromX: number; readonly fromY: number; readonly toX: number; readonly toY: number; readonly durationMs: number }
  | { readonly type: "scroll"; readonly deltaX: number; readonly deltaY: number }
  | { readonly type: "drag"; readonly fromX: number; readonly fromY: number; readonly toX: number; readonly toY: number }
  | { readonly type: "keyboard"; readonly text: string }
  | { readonly type: "copy"; readonly text: string }
  | { readonly type: "paste" }
  | { readonly type: "back" | "home" | "reload" | "screenshot" }
  | { readonly type: "rotate"; readonly orientation: Orientation }
  | { readonly type: "zoom"; readonly scale: number };

export interface PreviewFrame {
  readonly sessionId: PreviewSessionId;
  readonly platform: DeviceProfile["platform"];
  readonly cssWidth: number;
  readonly cssHeight: number;
  readonly dpi: number;
  readonly safeArea: DeviceProfile["safeArea"];
  readonly orientation: Orientation;
  readonly theme: DeviceProfile["theme"];
}

export interface PreviewScreenshot {
  readonly sessionId: PreviewSessionId;
  readonly capturedAt: string;
  readonly frame: PreviewFrame;
  readonly mimeType: "image/png" | "image/jpeg";
  readonly dataUrl: string;
}

export interface LightweightPreviewAdapter {
  start(session: PreviewSession, profile: DeviceProfile): Promise<PreviewFrame>;
  sendInput(sessionId: PreviewSessionId, input: PreviewInput): Promise<PreviewFrame>;
  capture(sessionId: PreviewSessionId): Promise<PreviewScreenshot>;
  stop(sessionId: PreviewSessionId): Promise<void>;
}

export class InMemoryLightweightPreviewAdapter implements LightweightPreviewAdapter {
  private readonly frames = new Map<PreviewSessionId, PreviewFrame>();
  private readonly sessions = new Map<PreviewSessionId, PreviewSession>();

  public async start(session: PreviewSession, profile: DeviceProfile): Promise<PreviewFrame> {
    const frame = this.frameFor(session.id, profile, profile.orientation);
    this.sessions.set(session.id, session);
    this.frames.set(session.id, frame);
    return frame;
  }

  public async sendInput(sessionId: PreviewSessionId, input: PreviewInput): Promise<PreviewFrame> {
    const current = this.frames.get(sessionId);
    if (!current) throw new Error(`Preview ${sessionId} is not running.`);
    if (input.type === "rotate") {
      const rotated: PreviewFrame = {
        ...current,
        orientation: input.orientation,
        cssWidth: input.orientation === current.orientation ? current.cssWidth : current.cssHeight,
        cssHeight: input.orientation === current.orientation ? current.cssHeight : current.cssWidth,
      };
      this.frames.set(sessionId, rotated);
      return rotated;
    }
    return current;
  }

  public async capture(sessionId: PreviewSessionId): Promise<PreviewScreenshot> {
    const frame = this.frames.get(sessionId);
    if (!frame) throw new Error(`Preview ${sessionId} is not running.`);
    return {
      sessionId,
      capturedAt: new Date().toISOString(),
      frame,
      mimeType: "image/png",
      dataUrl: "data:image/png;base64,PREVIEW_PLACEHOLDER",
    };
  }

  public async stop(sessionId: PreviewSessionId): Promise<void> {
    this.frames.delete(sessionId);
    this.sessions.delete(sessionId);
  }

  private frameFor(sessionId: PreviewSessionId, profile: DeviceProfile, orientation: Orientation): PreviewFrame {
    const landscape = orientation === "landscape";
    return {
      sessionId,
      platform: profile.platform,
      cssWidth: landscape ? profile.height : profile.width,
      cssHeight: landscape ? profile.width : profile.height,
      dpi: profile.dpi,
      safeArea: profile.safeArea,
      orientation,
      theme: profile.theme,
    };
  }
}
