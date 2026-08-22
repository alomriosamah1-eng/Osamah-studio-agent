const { contextBridge, ipcRenderer } = require("electron");

const DESKTOP_IPC_CHANNEL = "osamah:dispatch";
const PROJECT_ROOT_PICKER_CHANNEL = "osamah:choose-project-root";
const APPROVAL_EVENTS_CHANNEL = "osamah:approval-events";

const isApprovalEvent = (value) => Boolean(value && typeof value === "object" && value.type === "approval.changed" && value.ticket && typeof value.ticket === "object");

contextBridge.exposeInMainWorld("osamah", Object.freeze({
  dispatch: (request) => ipcRenderer.invoke(DESKTOP_IPC_CHANNEL, request),
  chooseProjectRoot: () => ipcRenderer.invoke(PROJECT_ROOT_PICKER_CHANNEL),
  subscribe: (listener) => {
    if (typeof listener !== "function") return () => undefined;
    const wrapped = (_event, payload) => {
      if (isApprovalEvent(payload)) listener(payload);
    };
    ipcRenderer.on(APPROVAL_EVENTS_CHANNEL, wrapped);
    return () => ipcRenderer.removeListener(APPROVAL_EVENTS_CHANNEL, wrapped);
  },
}));
