import {
  approvalId,
  deviceProfileId,
  previewSessionId,
  sessionId,
  workspaceId,
  type ApprovalId,
  type DeviceProfileId,
  type Orientation,
  type Platform,
  type PreviewSessionId,
  type RiskTier,
  type SessionId,
  type ThemeMode,
  type WorkspaceId,
} from "./primitives.js";
import { invalidTransition, validationError, type DomainError } from "./errors.js";

export interface Workspace {
  readonly id: WorkspaceId;
  readonly name: string;
  readonly rootPath: string;
  readonly createdAt: string;
}

export interface AgentSession {
  readonly id: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly status: "created" | "running" | "waiting_approval" | "paused" | "completed" | "failed" | "cancelled";
  readonly createdAt: string;
}

export interface ApprovalRequest {
  readonly id: ApprovalId;
  readonly sessionId: SessionId;
  readonly action: string;
  readonly risk: RiskTier;
  readonly scope: string;
  readonly status: "requested" | "approved" | "denied" | "expired" | "revoked";
  readonly createdAt: string;
}

export interface SafeArea {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface DeviceProfile {
  readonly id: DeviceProfileId;
  readonly name: string;
  readonly platform: Platform;
  readonly osVersion: string;
  readonly width: number;
  readonly height: number;
  readonly dpi: number;
  readonly safeArea: SafeArea;
  readonly statusBarHeight: number;
  readonly navigationBarHeight: number;
  readonly orientation: Orientation;
  readonly theme: ThemeMode;
}

export interface PreviewSession {
  readonly id: PreviewSessionId;
  readonly deviceProfileId: DeviceProfileId;
  readonly mode: "lightweight_web" | "metro" | "android_emulator" | "ios_simulator" | "physical_device";
  readonly status: "created" | "starting" | "ready" | "refreshing" | "reloading" | "stopping" | "stopped" | "failed";
  readonly createdAt: string;
}

const requireText = (value: string, field: string): string => {
  if (!value.trim()) throw validationError(`${field} must not be empty.`);
  return value.trim();
};

export const createWorkspace = (input: { id: string; name: string; rootPath: string; now?: string }): Workspace => ({
  id: workspaceId(requireText(input.id, "workspace id")),
  name: requireText(input.name, "workspace name"),
  rootPath: requireText(input.rootPath, "workspace rootPath"),
  createdAt: input.now ?? new Date().toISOString(),
});

export const createSession = (input: { id: string; workspaceId: WorkspaceId; now?: string }): AgentSession => ({
  id: sessionId(requireText(input.id, "session id")),
  workspaceId: input.workspaceId,
  status: "created",
  createdAt: input.now ?? new Date().toISOString(),
});

export const createApproval = (input: {
  id: string;
  sessionId: SessionId;
  action: string;
  risk: RiskTier;
  scope: string;
  now?: string;
}): ApprovalRequest => ({
  id: approvalId(requireText(input.id, "approval id")),
  sessionId: input.sessionId,
  action: requireText(input.action, "approval action"),
  risk: input.risk,
  scope: requireText(input.scope, "approval scope"),
  status: "requested",
  createdAt: input.now ?? new Date().toISOString(),
});

export const transitionSession = (session: AgentSession, next: AgentSession["status"]): AgentSession => {
  const allowed: Record<AgentSession["status"], AgentSession["status"][]> = {
    created: ["running", "cancelled"],
    running: ["waiting_approval", "paused", "completed", "failed", "cancelled"],
    waiting_approval: ["running", "paused", "cancelled"],
    paused: ["running", "cancelled"],
    completed: [],
    failed: ["running", "cancelled"],
    cancelled: [],
  };
  if (!allowed[session.status].includes(next)) throw invalidTransition(session.status, next);
  return { ...session, status: next };
};

export const resolveApproval = (approval: ApprovalRequest, decision: "approved" | "denied"): ApprovalRequest => {
  if (approval.status !== "requested") throw invalidTransition(approval.status, decision);
  return { ...approval, status: decision };
};

export const createDeviceProfile = (input: {
  id: string;
  name: string;
  platform: Platform;
  osVersion: string;
  width: number;
  height: number;
  dpi: number;
  safeArea?: SafeArea;
  statusBarHeight?: number;
  navigationBarHeight?: number;
  orientation?: Orientation;
  theme?: ThemeMode;
}): DeviceProfile => {
  if (input.width <= 0 || input.height <= 0 || input.dpi <= 0) throw validationError("Device dimensions and dpi must be positive.");
  return {
    id: deviceProfileId(requireText(input.id, "device profile id")),
    name: requireText(input.name, "device profile name"),
    platform: input.platform,
    osVersion: requireText(input.osVersion, "OS version"),
    width: input.width,
    height: input.height,
    dpi: input.dpi,
    safeArea: input.safeArea ?? { top: 0, right: 0, bottom: 0, left: 0 },
    statusBarHeight: input.statusBarHeight ?? 0,
    navigationBarHeight: input.navigationBarHeight ?? 0,
    orientation: input.orientation ?? "portrait",
    theme: input.theme ?? "light",
  };
};

export const createPreviewSession = (input: {
  id: string;
  deviceProfileId: DeviceProfileId;
  mode?: PreviewSession["mode"];
  now?: string;
}): PreviewSession => ({
  id: previewSessionId(requireText(input.id, "preview session id")),
  deviceProfileId: input.deviceProfileId,
  mode: input.mode ?? "lightweight_web",
  status: "created",
  createdAt: input.now ?? new Date().toISOString(),
});

export const transitionPreview = (preview: PreviewSession, next: PreviewSession["status"]): PreviewSession => {
  const allowed: Record<PreviewSession["status"], PreviewSession["status"][]> = {
    created: ["starting", "stopped", "failed"],
    starting: ["ready", "failed", "stopping"],
    ready: ["refreshing", "reloading", "stopping", "failed"],
    refreshing: ["ready", "reloading", "failed"],
    reloading: ["ready", "failed"],
    stopping: ["stopped", "failed"],
    stopped: ["starting"],
    failed: ["starting", "stopped"],
  };
  if (!allowed[preview.status].includes(next)) throw invalidTransition(preview.status, next);
  return { ...preview, status: next };
};

export const isDomainError = (value: unknown): value is DomainError => value instanceof Error && value.name === "DomainError";
