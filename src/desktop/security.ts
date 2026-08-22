export const DESKTOP_IPC_CHANNEL = "osamah:dispatch";

export const DESKTOP_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

export const isAllowedWorkspaceUrl = (value: string, expectedUrl: string): boolean => {
  try {
    const actual = new URL(value);
    const expected = new URL(expectedUrl);
    return actual.protocol === "file:"
      && expected.protocol === "file:"
      && actual.host === expected.host
      && actual.pathname === expected.pathname
      && actual.search === expected.search;
  } catch {
    return false;
  }
};

export const isTrustedIpcSender = (input: {
  senderId: number;
  expectedSenderId: number;
  frameUrl: string;
  expectedFrameUrl: string;
}): boolean => input.senderId === input.expectedSenderId
  && isAllowedWorkspaceUrl(input.frameUrl, input.expectedFrameUrl);
