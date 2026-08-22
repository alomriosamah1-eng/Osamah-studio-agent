import { app, BrowserWindow, dialog, ipcMain, session } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createEmbeddedApplication } from "../composition.js";
import { invalidRequest, isIpcRequest, type IpcEvent } from "../ipc/contracts.js";
import { chooseProjectRoot } from "./root-picker.js";
import { APPROVAL_EVENTS_CHANNEL, DESKTOP_CONTENT_SECURITY_POLICY, DESKTOP_IPC_CHANNEL, isTrustedIpcSender, PROJECT_ROOT_PICKER_CHANNEL } from "./security.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const workspacePath = join(currentDirectory, "../../prototypes/studio/index.html");
const workspaceUrl = pathToFileURL(workspacePath).toString();
const embeddedApplication = createEmbeddedApplication();
if (process.env.OSAMAH_DISABLE_GPU === "1") app.disableHardwareAcceleration();
let mainWindow: BrowserWindow | undefined;
let unsubscribeApprovalEvents: (() => void) | undefined;

const requestIdOf = (value: unknown): string => {
  if (!value || typeof value !== "object") return "unknown";
  const requestId = (value as Record<string, unknown>).requestId;
  return typeof requestId === "string" ? requestId : "unknown";
};

const installContentSecurityPolicy = (): void => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [DESKTOP_CONTENT_SECURITY_POLICY],
      },
    });
  });
};

const registerIpcBridge = (): void => {
  const isTrustedEvent = (event: { readonly sender: { readonly id: number }; readonly senderFrame?: { readonly url: string } | null }): boolean => isTrustedIpcSender({
    senderId: event.sender.id,
    expectedSenderId: mainWindow?.webContents.id ?? -1,
    frameUrl: event.senderFrame?.url ?? "",
    expectedFrameUrl: workspaceUrl,
  });
  ipcMain.handle(DESKTOP_IPC_CHANNEL, async (event, request: unknown) => {
    const requestId = requestIdOf(request);
    if (!isTrustedEvent(event)) return invalidRequest(requestId, "The IPC sender is not trusted.");
    if (!isIpcRequest(request)) return invalidRequest(requestId, "The IPC request does not match protocol v1.");
    return embeddedApplication.ipc.dispatch(request);
  });
  ipcMain.handle(PROJECT_ROOT_PICKER_CHANNEL, async (event) => {
    if (!isTrustedEvent(event)) return { canceled: false as const, error: "INVALID_ROOT" as const, message: "The root picker sender is not trusted." };
    const ownerWindow = mainWindow;
    if (!ownerWindow) return { canceled: false as const, error: "INVALID_ROOT" as const, message: "The desktop window is not ready." };
    if (process.env.OSAMAH_ROOT_PICKER_SMOKE === "1") {
      return chooseProjectRoot({
        showOpenDialog: async () => ({ canceled: false, filePaths: [join(currentDirectory, "../../fixtures/mobile-expo")] }),
      });
    }
    return chooseProjectRoot({
      showOpenDialog: (_options) => dialog.showOpenDialog(ownerWindow, { properties: ["openDirectory"] }),
    });
  });
};

const installApprovalEventStream = (): void => {
  if (unsubscribeApprovalEvents) return;
  unsubscribeApprovalEvents = embeddedApplication.dependencies.events.subscribe((event) => {
    if (event.type !== "ApprovalRequested" && event.type !== "ApprovalResolved") return;
    const ticket = embeddedApplication.humanGate.get(event.approvalId);
    if (!ticket) return;
    const payload: IpcEvent = { type: "approval.changed", ticket };
    mainWindow?.webContents.send(APPROVAL_EVENTS_CHANNEL, payload);
  });
};

const createWindow = (): BrowserWindow => {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 680,
    show: false,
    backgroundColor: "#090d16",
    webPreferences: {
      preload: join(currentDirectory, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedIpcSender({ senderId: window.webContents.id, expectedSenderId: window.webContents.id, frameUrl: url, expectedFrameUrl: workspaceUrl })) {
      event.preventDefault();
    }
  });
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  window.once("ready-to-show", () => {
    window.show();
    console.log("Osamah Studio Agent desktop shell ready.");
  });
  window.webContents.on("console-message", (messageDetails) => {
    if (process.env.OSAMAH_SMOKE !== "1") return;
    const message = messageDetails.message;
    console.log(`DESKTOP_RENDERER_CONSOLE=${message}`);
    if (message === "DESKTOP_IPC_SMOKE=PASS") {
      console.log("Osamah Studio Agent preload and IPC bridge ready.");
      console.log(message);
      setTimeout(() => app.quit(), 250);
    } else if (message === "DESKTOP_IPC_SMOKE=FAIL") {
      console.error("Desktop IPC smoke returned an unsuccessful response.");
      app.exit(1);
    }
  });
  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    if (process.env.OSAMAH_SMOKE === "1") console.error(`DESKTOP_LOAD_FAILED=${errorCode}:${errorDescription}:${validatedURL}`);
  });
  window.webContents.on("render-process-gone", (_event, details) => {
    if (process.env.OSAMAH_SMOKE === "1") console.error(`DESKTOP_RENDERER_GONE=${details.reason}`);
  });
  window.on("closed", () => {
    if (process.env.OSAMAH_SMOKE === "1") console.log("DESKTOP_WINDOW_CLOSED");
  });
  void window.loadFile(workspacePath, process.env.OSAMAH_SMOKE === "1" ? { hash: "osamah-smoke" } : undefined);
  return window;
};

void app.whenReady().then(() => {
  installContentSecurityPolicy();
  registerIpcBridge();
  mainWindow = createWindow();
  installApprovalEventStream();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
  });
}).catch((error: unknown) => {
  console.error("Osamah Studio Agent failed to start.", error);
  app.quit();
});

app.on("before-quit", () => {
  unsubscribeApprovalEvents?.();
  unsubscribeApprovalEvents = undefined;
  embeddedApplication.close();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
