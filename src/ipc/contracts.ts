import type { PreviewInput } from "../mobile/preview.js";
import type { PreviewFrame, PreviewScreenshot } from "../mobile/preview.js";
import type { DeviceProfile, PreviewSession } from "../domain/entities.js";
import type { DeviceProfileId, PreviewSessionId } from "../domain/primitives.js";
import type { ProjectPreviewBundle, PreviewRenderNode } from "../mobile/preview-runtime.js";
import type { AgentPlan, PatchProposal, WorkCycleResult, WorkCycleSnapshot } from "../application/agent-work-cycle.js";
import type { ProjectContextSnapshot } from "../application/project-context.js";
import type { ProjectTreeResult, WorkspaceFileContent } from "../application/project-explorer.js";
import type { DocumentSnapshot, EditProposal } from "../application/editor-document.js";
import type { TerminalCommandRequest, TerminalPolicyDecision } from "../application/terminal-policy.js";
import type { GitDiffResult, GitReadOnlyPort, GitStatusSnapshot } from "../application/git-read-only.js";
import type { ApprovalTicket } from "../application/agent-contracts.js";
import type { LocalProviderConfig, LocalProviderId, ProviderDoctorReport } from "../application/provider-policy.js";

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

export interface ProviderListItem {
  readonly id: string;
  readonly label: string;
  readonly privacy: "local" | "remote";
  readonly offline: boolean;
  readonly capabilities: readonly string[];
  readonly models: readonly { readonly id: string; readonly capabilities: readonly string[]; readonly contextWindow: number; readonly streaming: boolean; readonly offline: boolean }[];
  readonly configured: boolean;
  readonly enabled: boolean;
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
  "project.tree": { payload: { rootPath: string }; result: ProjectTreeResult };
  "file.openText": { payload: { rootPath: string; relativePath: string }; result: WorkspaceFileContent | undefined };
  "editor.open": { payload: { rootPath: string; relativePath: string }; result: DocumentSnapshot | undefined };
  "editor.propose": { payload: { rootPath: string; relativePath: string; content: string; expectedSha256: string }; result: EditProposal };
  "terminal.inspect": { payload: TerminalCommandRequest; result: TerminalPolicyDecision };
  "git.status": { payload: { rootPath: string }; result: GitStatusSnapshot };
  "git.diff": { payload: { rootPath: string; relativePath?: string }; result: GitDiffResult };
  "workCycle.start": {
    payload: {
      cycleId: string;
      sessionId: string;
      rootPath: string;
      goal: string;
      constraints: readonly string[];
      targetedPaths: readonly string[];
      plan?: AgentPlan;
      patch: PatchProposal;
      providerId?: string;
      modelId?: string;
      offlineMode?: boolean;
      approvalId?: string;
      timeoutMs?: number;
    };
    result: WorkCycleResult;
  };
  "workCycle.inspect": { payload: { cycleId: string }; result: WorkCycleSnapshot | undefined };
  "workCycle.cancel": { payload: { cycleId: string }; result: { cancelled: boolean; cycle?: WorkCycleSnapshot } };
  "approval.listPending": { payload: { limit?: number }; result: readonly ApprovalTicket[] };
  "approval.decide": { payload: { approvalId: string; decision: "approved" | "denied" }; result: ApprovalTicket };
  "provider.list": { payload: Record<string, never>; result: readonly ProviderListItem[] };
  "provider.configure": { payload: LocalProviderConfig; result: LocalProviderConfig };
  "provider.doctor": { payload: { providerId?: LocalProviderId }; result: readonly ProviderDoctorReport[] };
}

export interface HumanGateEvent {
  readonly type: "approval.changed";
  readonly ticket: ApprovalTicket;
}

export type IpcEvent = HumanGateEvent;

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

const isApprovalTicketPayload = (value: unknown): value is ApprovalTicket => {
  if (!isRecord(value) || !isString(value.approvalId, 256) || !isString(value.correlationId, 256) || !isString(value.createdAt, 128)) return false;
  if (value.status !== "requested" && value.status !== "approved" && value.status !== "denied") return false;
  if (value.resolvedAt !== undefined && !isString(value.resolvedAt, 128)) return false;
  if (!isRecord(value.action) || !isString(value.action.actionId, 256) || !isString(value.action.sessionId, 256) || !isString(value.action.scope, 512)) return false;
  if (!["filesystem.read", "filesystem.write", "terminal.exec", "git.commit", "github.push", "mcp.tool", "browser.submit", "media.publish", "provider.invoke"].includes(value.action.kind as string)) return false;
  if (!["low", "medium", "high", "critical"].includes(value.action.risk as string)) return false;
  return value.action.idempotencyKey === undefined || isString(value.action.idempotencyKey, 256);
};

export const isIpcEvent = (value: unknown): value is IpcEvent => isRecord(value)
  && value.type === "approval.changed"
  && isApprovalTicketPayload(value.ticket);

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
    && (value.plan === undefined || isAgentPlanPayload(value.plan))
    && isPatchProposalPayload(value.patch)
    && (value.providerId === undefined || isString(value.providerId, 256))
    && (value.modelId === undefined || isString(value.modelId, 256))
    && (value.offlineMode === undefined || typeof value.offlineMode === "boolean")
    && (value.approvalId === undefined || isString(value.approvalId, 256))
    && (value.timeoutMs === undefined || (typeof value.timeoutMs === "number" && Number.isInteger(value.timeoutMs) && value.timeoutMs > 0 && value.timeoutMs <= 120_000));
};

const isProjectTreePayload = (value: unknown): boolean => isRecord(value) && isString(value.rootPath, 4096);
const isFileOpenTextPayload = (value: unknown): boolean => isRecord(value) && isString(value.rootPath, 4096) && isString(value.relativePath, 512);
const isEditorOpenPayload = isFileOpenTextPayload;
const isEditorProposePayload = (value: unknown): boolean => isRecord(value)
  && isString(value.rootPath, 4096)
  && isString(value.relativePath, 512)
  && typeof value.content === "string" && value.content.length <= 1_500_000 && !value.content.includes("\u0000")
  && typeof value.expectedSha256 === "string" && /^[a-f0-9]{64}$/i.test(value.expectedSha256);
const isTerminalInspectPayload = (value: unknown): value is TerminalCommandRequest => isRecord(value)
  && isString(value.requestId, 256)
  && isString(value.sessionId, 256)
  && isString(value.rootPath, 4096)
  && isString(value.cwd, 512)
  && isString(value.executable, 128)
  && isStringArray(value.args, 64, 4096)
  && (value.timeoutMs === undefined || (typeof value.timeoutMs === "number" && Number.isInteger(value.timeoutMs) && value.timeoutMs >= 1_000 && value.timeoutMs <= 120_000))
  && (value.maxOutputBytes === undefined || (typeof value.maxOutputBytes === "number" && Number.isInteger(value.maxOutputBytes) && value.maxOutputBytes >= 4 * 1024 && value.maxOutputBytes <= 256 * 1024));
const isGitStatusPayload = (value: unknown): boolean => isRecord(value) && isString(value.rootPath, 4096);
const isGitDiffPayload = (value: unknown): boolean => isRecord(value)
  && isString(value.rootPath, 4096)
  && (value.relativePath === undefined || isString(value.relativePath, 512));
const isWorkCycleIdPayload = (value: unknown): boolean => isRecord(value) && isString(value.cycleId, 256);
const isApprovalListPayload = (value: unknown): boolean => isRecord(value) && (value.limit === undefined || (typeof value.limit === "number" && Number.isInteger(value.limit) && value.limit > 0 && value.limit <= 64));
const isApprovalDecisionPayload = (value: unknown): boolean => isRecord(value) && isString(value.approvalId, 256) && (value.decision === "approved" || value.decision === "denied");
const isLocalProviderIdPayload = (value: unknown): value is LocalProviderId => value === "ollama" || value === "llama.cpp";
const isProviderConfigPayload = (value: unknown): value is LocalProviderConfig => isRecord(value)
  && isLocalProviderIdPayload(value.providerId)
  && typeof value.enabled === "boolean"
  && isString(value.baseUrl, 256)
  && isString(value.modelId, 256)
  && typeof value.timeoutMs === "number" && Number.isInteger(value.timeoutMs) && value.timeoutMs > 0 && value.timeoutMs <= 120_000
  && typeof value.maxInputChars === "number" && Number.isInteger(value.maxInputChars) && value.maxInputChars > 0 && value.maxInputChars <= 128 * 1024
  && typeof value.maxOutputChars === "number" && Number.isInteger(value.maxOutputChars) && value.maxOutputChars > 0 && value.maxOutputChars <= 256 * 1024
  && value.maxConcurrent === 1
  && typeof value.maxRequestsPerWindow === "number" && Number.isInteger(value.maxRequestsPerWindow) && value.maxRequestsPerWindow > 0 && value.maxRequestsPerWindow <= 64
  && typeof value.quotaWindowMs === "number" && Number.isInteger(value.quotaWindowMs) && value.quotaWindowMs >= 1_000 && value.quotaWindowMs <= 60 * 60 * 1000
  && typeof value.circuitFailureThreshold === "number" && Number.isInteger(value.circuitFailureThreshold) && value.circuitFailureThreshold > 0 && value.circuitFailureThreshold <= 8
  && typeof value.circuitCooldownMs === "number" && Number.isInteger(value.circuitCooldownMs) && value.circuitCooldownMs >= 1_000 && value.circuitCooldownMs <= 10 * 60 * 1000;
const isProviderListPayload = (value: unknown): boolean => isRecord(value) && Object.keys(value).length === 0;
const isProviderDoctorPayload = (value: unknown): boolean => isRecord(value) && (value.providerId === undefined || isLocalProviderIdPayload(value.providerId));

const isMethodPayload = (method: string, payload: unknown): boolean => {
  if (!isRecord(payload)) return false;
  if (method === "context.index") return isString(payload.rootPath, 4096);
  if (method === "project.tree") return isProjectTreePayload(payload);
  if (method === "file.openText") return isFileOpenTextPayload(payload);
  if (method === "editor.open") return isEditorOpenPayload(payload);
  if (method === "editor.propose") return isEditorProposePayload(payload);
  if (method === "terminal.inspect") return isTerminalInspectPayload(payload);
  if (method === "git.status") return isGitStatusPayload(payload);
  if (method === "git.diff") return isGitDiffPayload(payload);
  if (method === "workCycle.start") return isWorkCycleStartPayload(payload);
  if (method === "workCycle.inspect" || method === "workCycle.cancel") return isWorkCycleIdPayload(payload);
  if (method === "approval.listPending") return isApprovalListPayload(payload);
  if (method === "approval.decide") return isApprovalDecisionPayload(payload);
  if (method === "provider.list") return isProviderListPayload(payload);
  if (method === "provider.configure") return isProviderConfigPayload(payload);
  if (method === "provider.doctor") return isProviderDoctorPayload(payload);
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
