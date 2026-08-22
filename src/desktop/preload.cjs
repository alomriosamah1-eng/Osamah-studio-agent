const { contextBridge, ipcRenderer } = require("electron");

const DESKTOP_IPC_CHANNEL = "osamah:dispatch";
const PROJECT_ROOT_PICKER_CHANNEL = "osamah:choose-project-root";

contextBridge.exposeInMainWorld("osamah", Object.freeze({
  dispatch: (request) => ipcRenderer.invoke(DESKTOP_IPC_CHANNEL, request),
  chooseProjectRoot: () => ipcRenderer.invoke(PROJECT_ROOT_PICKER_CHANNEL),
}));
