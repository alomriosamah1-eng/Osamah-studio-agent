import { invalidRequest, isIpcRequest, type IpcMethod, type IpcRequest, type IpcResponse, type IpcMethodMap } from "./contracts.js";

export type IpcHandler<M extends IpcMethod> = (request: IpcRequest<M>) => Promise<IpcMethodMap[M]["result"]>;

type AnyHandler = (request: IpcRequest) => Promise<unknown>;

export class InMemoryIpcTransport {
  private readonly handlers = new Map<IpcMethod, AnyHandler>();
  private readonly completed = new Set<string>();

  public register<M extends IpcMethod>(method: M, handler: IpcHandler<M>): void {
    if (this.handlers.has(method)) throw new Error(`IPC handler already registered: ${method}`);
    this.handlers.set(method, handler as AnyHandler);
  }

  public async dispatch<M extends IpcMethod>(request: IpcRequest<M>): Promise<IpcResponse<IpcMethodMap[M]["result"]>>;
  public async dispatch(request: unknown): Promise<IpcResponse<unknown>>;
  public async dispatch(request: unknown): Promise<IpcResponse<unknown>> {
    if (!isIpcRequest(request)) return invalidRequest("invalid", "The IPC request does not match protocol v1.");
    if (this.completed.has(request.requestId)) {
      return { protocolVersion: 1, requestId: request.requestId, ok: false, error: { code: "DUPLICATE_REQUEST", message: "The request ID was already completed.", retryable: false } };
    }
    const handler = this.handlers.get(request.method);
    if (!handler) {
      return { protocolVersion: 1, requestId: request.requestId, ok: false, error: { code: "UNKNOWN_METHOD", message: `Unknown IPC method: ${request.method}`, retryable: false } };
    }
    try {
      const result = await handler(request);
      this.completed.add(request.requestId);
      return { protocolVersion: 1, requestId: request.requestId, ok: true, result };
    } catch (error) {
      this.completed.add(request.requestId);
      const message = error instanceof Error ? error.message : "IPC handler failed.";
      return { protocolVersion: 1, requestId: request.requestId, ok: false, error: { code: "INTERNAL_ERROR", message, retryable: false, userAction: "Review the diagnostic log." } };
    }
  }
}
