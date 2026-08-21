export type ErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "INVALID_TRANSITION"
  | "POLICY_DENIED"
  | "CAPABILITY_UNAVAILABLE"
  | "CONFLICT"
  | "CANCELLED";

export class DomainError extends Error {
  public readonly retryable: boolean;
  public readonly userAction: string;

  public constructor(
    public readonly code: ErrorCode,
    message: string,
    options?: { retryable?: boolean; userAction?: string },
  ) {
    super(message);
    this.name = "DomainError";
    this.retryable = options?.retryable ?? false;
    this.userAction = options?.userAction ?? "Review the task and try again.";
  }
}

export const validationError = (message: string): DomainError =>
  new DomainError("VALIDATION", message, { userAction: "Correct the input." });

export const invalidTransition = (from: string, to: string): DomainError =>
  new DomainError("INVALID_TRANSITION", `Transition ${from} -> ${to} is not allowed.`, {
    userAction: "Inspect the current state and choose a valid next action.",
  });

export const policyDenied = (message: string): DomainError =>
  new DomainError("POLICY_DENIED", message, { userAction: "Approve the action or reduce its scope." });
