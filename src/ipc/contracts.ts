import type { PreviewInput } from "../mobile/preview.js";
import type { PreviewFrame, PreviewScreenshot } from "../mobile/preview.js";
import type { DeviceProfile, PreviewSession } from "../domain/entities.js";
import type { DeviceProfileId, PreviewSessionId } from "../domain/primitives.js";
import type { ProjectPreviewBundle, PreviewRenderNode } from "../mobile/preview-runtime.js";

export type IpcMethod = keyof IpcMethodMap;

export interface IpcMethodMap {
  "health.get": { payload: Record<string, never>; result: { status: "ok" | "degraded"; version: string } };
  "preview.start": { payload: { deviceProfileId: DeviceProfileId; mode?: PreviewSession["mode"] }; result: PreviewSession };
  "preview.input": { payload: { sessionId: PreviewSessionId; input: PreviewInput }; result: PreviewFrame };
  "preview.refresh": { payload: { sessionId: PreviewSessionId; kind?: "fast" | "reload"; bundle?: ProjectPreviewBundle }; result: PreviewFrame };
  "preview.capture": { payload: { sessionId: PreviewSessionId }; result: PreviewScreenshot };
  "preview.inspect": { payload: { sessionId: PreviewSessionId }; result: PreviewInspection };
  "preview.stop": { payload: { sessionId: PreviewSessionId }; result: { stopped: true } };
  "device.get": { payload: { deviceProfileId: DeviceProfileId }; result: DeviceProfile };
}

export interface IpcRequest<M extends IpcMethod = IpcMethod> {
  readonly protocolVersion: 1;
  readonly requestId: string;
  readonly correlationId: string;
  readonly method: M;
  readonly payload: IpcMethodMap[M]["payload"];
}

export type IpcError = {
  readonly code: "INVALID_REQUEST" | "UNKNOWN_METHOD" | "DUPLICATE_REQUEST" | "DOMAIN_ERROR" | "INTERNAL_ERROR";
  readonly message: string;
  readonly retryable: boolean;
  readonly userAction?: string;
};

export type IpcResponse<T> =
  | { readonly protocolVersion: 1; readonly requestId: string; readonly ok: true; readonly result: T }
  | { readonly protocolVersion: 1; readonly requestId: string; readonly ok: false; readonly error: IpcError };

export interface PreviewInspection {
  readonly sessionId: PreviewSessionId;
  readonly state: PreviewSession["status"];
  readonly mode: PreviewSession["mode"];
  readonly nativeFidelity: "compatibility" | "native";
  readonly warnings: readonly string[];
  readonly diagnostics: readonly string[];
  readonly events: readonly { type: string; message: string }[];
  readonly bundle?: { projectId: string; entry: string; sourceHash: string; moduleCount: number; warningCount: number; renderTree?: PreviewRenderNode };
}

export const isIpcRequest = (value: unknown): value is IpcRequest => {
  if (!value || typeof value !== "object") return false;
  const request = value as Record<string, unknown>;
  return request.protocolVersion === 1
    && typeof request.requestId === "string"
    && request.requestId.length > 0
    && typeof request.correlationId === "string"
    && request.correlationId.length > 0
    && typeof request.method === "string"
    && request.payload !== null
    && typeof request.payload === "object";
};

export const invalidRequest = (requestId: string, message: string): IpcResponse<never> => ({
  protocolVersion: 1,
  requestId,
  ok: false,
  error: { code: "INVALID_REQUEST", message, retryable: false, userAction: "Correct the request schema." },
});
