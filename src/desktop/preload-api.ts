import type { IpcMethod, IpcMethodMap, IpcRequest, IpcResponse } from "../ipc/contracts.js";

export interface OsamahPreloadApi {
  dispatch<M extends IpcMethod>(
    request: IpcRequest<M>,
  ): Promise<IpcResponse<IpcMethodMap[M]["result"]>>;
}

export type TypedIpcDispatch = OsamahPreloadApi["dispatch"];
