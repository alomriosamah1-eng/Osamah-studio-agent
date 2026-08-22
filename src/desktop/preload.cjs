const { contextBridge, ipcRenderer } = require("electron");

const DESKTOP_IPC_CHANNEL = "osamah:dispatch";

contextBridge.exposeInMainWorld("osamah", Object.freeze({
  dispatch: (request) => ipcRenderer.invoke(DESKTOP_IPC_CHANNEL, request),
}));
