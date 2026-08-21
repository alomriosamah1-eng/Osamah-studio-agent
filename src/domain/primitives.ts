export type Brand<T, B extends string> = T & { readonly __brand: B };

export type WorkspaceId = Brand<string, "WorkspaceId">;
export type SessionId = Brand<string, "SessionId">;
export type TaskId = Brand<string, "TaskId">;
export type ApprovalId = Brand<string, "ApprovalId">;
export type PreviewSessionId = Brand<string, "PreviewSessionId">;
export type DeviceProfileId = Brand<string, "DeviceProfileId">;

export const workspaceId = (value: string): WorkspaceId => value as WorkspaceId;
export const sessionId = (value: string): SessionId => value as SessionId;
export const taskId = (value: string): TaskId => value as TaskId;
export const approvalId = (value: string): ApprovalId => value as ApprovalId;
export const previewSessionId = (value: string): PreviewSessionId => value as PreviewSessionId;
export const deviceProfileId = (value: string): DeviceProfileId => value as DeviceProfileId;

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const fail = <E>(error: E): Result<never, E> => ({ ok: false, error });

export type RiskTier = "low" | "medium" | "high" | "critical";
export type Platform = "android" | "ios" | "web";
export type Orientation = "portrait" | "landscape";
export type ThemeMode = "light" | "dark";
