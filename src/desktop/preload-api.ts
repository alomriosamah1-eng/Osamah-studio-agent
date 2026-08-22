import type { IpcMethod, IpcMethodMap, IpcRequest, IpcResponse } from "../ipc/contracts.js";
import type { RootPickerResult } from "./root-picker.js";

export interface OsamahPreloadApi {
  dispatch<M extends IpcMethod>(
    request: IpcRequest<M>,
  ): Promise<IpcResponse<IpcMethodMap[M]["result"]>>;
  chooseProjectRoot(): Promise<RootPickerResult>;
}

export type TypedIpcDispatch = OsamahPreloadApi["dispatch"];
