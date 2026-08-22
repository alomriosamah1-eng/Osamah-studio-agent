import type { PreviewInput } from "../mobile/preview.js";
import type { PreviewFrame, PreviewScreenshot } from "../mobile/preview.js";
import type { DeviceProfile, PreviewSession } from "../domain/entities.js";
import type { DeviceProfileId, PreviewSessionId } from "../domain/primitives.js";
import type { ProjectPreviewBundle, PreviewRenderNode } from "../mobile/preview-runtime.js";
import type { AgentPlan, PatchProposal, WorkCycleResult, WorkCycleSnapshot } from "../application/agent-work-cycle.js";
import type { ProjectContextSnapshot } from "../application/project-context.js";

export type IpcMethod = keyof IpcMethodMap;

export interface PreviewProjectOpenResult {
  readonly session: PreviewSession;
  readonly bundle: {
    readonly projectId: string;
    readonly entry: string;
    readonly sourceHash: string;
    readonly moduleCount: number;
    readonly warningCount: number;
  };
}

export interface IpcMethodMap {
  "health.get": { payload: Record<string, never>; result: { status: "ok" | "degraded"; version: string } };
  "preview.start": { payload: { deviceProfileId: DeviceProfileId; mode?: PreviewSession["mode"] }; result: PreviewSession };
  "preview.openProject": {
    payload: { projectId: string; rootPath: string; entry?: string; deviceProfileId: DeviceProfileId; mode?: PreviewSession["mode"] };
    result: PreviewProjectOpenResult;
  };
  "preview.input": { payload: { sessionId: PreviewSessionId; input: PreviewInput }; result: PreviewFrame };
  "preview.refresh": { payload: { sessionId: PreviewSessionId; kind?: "fast" | "reload"; bundle?: ProjectPreviewBundle }; result: PreviewFrame };
  "preview.capture": { payload: { sessionId: PreviewSessionId }; result: PreviewScreenshot };
  "preview.inspect": { payload: { sessionId: PreviewSessionId }; result: PreviewInspection };
  "preview.stop": { payload: { sessionId: PreviewSessionId }; result: { stopped: true } };
  "device.get": { payload: { deviceProfileId: DeviceProfileId }; result: DeviceProfile };
  "context.index": { payload: { rootPath: string }; result: ProjectContextSnapshot };
  "workCycle.start": {
    payload: {
      cycleId: string;
      sessionId: string;
      rootPath: string;
      goal: string;
      constraints: readonly string[];
      targetedPaths: readonly string[];
      plan: AgentPlan;
      patch: PatchProposal;
      approvalId?: string;
      timeoutMs?: number;
    };
    result: WorkCycleResult;
  };
  "workCycle.inspect": { payload: { cycleId: string }; result: WorkCycleSnapshot | undefined };
  "workCycle.cancel": { payload: { cycleId: string }; result: { cancelled: boolean; cycle?: WorkCycleSnapshot } };
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

const isString = (value: unknown, max = 4096): value is string => typeof value === "string" && value.length > 0 && value.length <= max && !value.includes("\u0000");
const isStringArray = (value: unknown, maxItems: number, maxItemLength = 512): value is readonly string[] => Array.isArray(value) && value.length <= maxItems && value.every((item) => isString(item, maxItemLength));
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

const isAgentPlanPayload = (value: unknown): value is AgentPlan => {
  if (!isRecord(value) || !isString(value.summary, 2048) || !Array.isArray(value.steps) || value.steps.length > 16) return false;
  return value.steps.every((step) => isRecord(step) && isString(step.id, 128) && isString(step.title, 256) && isString(step.description, 2048));
};

const isPatchProposalPayload = (value: unknown): value is PatchProposal => {
  if (!isRecord(value) || !isString(value.proposalId, 256) || !Array.isArray(value.operations) || value.operations.length > 16) return false;
  return value.operations.every((operation) => isRecord(operation)
    && isString(operation.relativePath, 512)
    && (operation.mode === "create" || operation.mode === "update")
    && typeof operation.content === "string"
    && operation.content.length <= 512 * 1024
    && (operation.expectedSha256 === undefined || (typeof operation.expectedSha256 === "string" && /^[a-f0-9]{64}$/.test(operation.expectedSha256))));
};

const isWorkCycleStartPayload = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  return isString(value.cycleId, 256)
    && isString(value.sessionId, 256)
    && isString(value.rootPath, 4096)
    && isString(value.goal, 4096)
    && isStringArray(value.constraints, 32)
    && isStringArray(value.targetedPaths, 24)
    && isAgentPlanPayload(value.plan)
    && isPatchProposalPayload(value.patch)
    && (value.approvalId === undefined || isString(value.approvalId, 256))
    && (value.timeoutMs === undefined || (typeof value.timeoutMs === "number" && Number.isInteger(value.timeoutMs) && value.timeoutMs > 0 && value.timeoutMs <= 120_000));
};

const isWorkCycleIdPayload = (value: unknown): boolean => isRecord(value) && isString(value.cycleId, 256);

const isMethodPayload = (method: string, payload: unknown): boolean => {
  if (!isRecord(payload)) return false;
  if (method === "context.index") return isString(payload.rootPath, 4096);
  if (method === "workCycle.start") return isWorkCycleStartPayload(payload);
  if (method === "workCycle.inspect" || method === "workCycle.cancel") return isWorkCycleIdPayload(payload);
  return true;
};

export const isIpcRequest = (value: unknown): value is IpcRequest => {
  if (!isRecord(value)) return false;
  return value.protocolVersion === 1
    && isString(value.requestId, 256)
    && isString(value.correlationId, 256)
    && typeof value.method === "string"
    && isMethodPayload(value.method, value.payload);
};

export const invalidRequest = (requestId: string, message: string): IpcResponse<never> => ({
  protocolVersion: 1,
  requestId,
  ok: false,
  error: { code: "INVALID_REQUEST", message, retryable: false, userAction: "Correct the request schema." },
});
