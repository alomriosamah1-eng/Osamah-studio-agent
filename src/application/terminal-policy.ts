import { createHash } from "node:crypto";
import type { ResourcePolicy } from "./resource-policy.js";

export type TerminalCommandClass = "read_only" | "mutating" | "toolchain" | "native" | "privileged" | "unknown";
export type TerminalDecision = "denied" | "approval_required";

export interface TerminalCommandRequest {
  readonly requestId: string;
  readonly sessionId: string;
  readonly rootPath: string;
  readonly cwd: string;
  readonly executable: string;
  readonly args: readonly string[];
  readonly timeoutMs?: number;
  readonly maxOutputBytes?: number;
}

export interface TerminalPolicyDecision {
  readonly decision: TerminalDecision;
  readonly commandClass: TerminalCommandClass;
  readonly commandDigest: string;
  readonly displayCommand: string;
  readonly cwd: string;
  readonly timeoutMs: number;
  readonly maxOutputBytes: number;
  readonly reason: string;
  readonly requiresHumanGate: boolean;
}

export interface TerminalPolicyPort {
  inspect(request: TerminalCommandRequest): TerminalPolicyDecision;
}

export class TerminalPolicyError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "TerminalPolicyError";
  }
}

const maxRequestIdLength = 256;
const maxSessionIdLength = 256;
const maxRootPathLength = 4_096;
const maxCwdLength = 512;
const maxExecutableLength = 128;
const maxArgumentLength = 4_096;
const maxArguments = 64;
const minTimeoutMs = 1_000;
const maxTimeoutMs = 120_000;
const minOutputBytes = 4 * 1024;
const maxOutputBytes = 256 * 1024;
const shellWrappers = new Set(["sh", "bash", "zsh", "fish", "dash", "ksh", "cmd", "powershell", "pwsh"]);
const toolchains = new Set(["node", "nodejs", "npm", "npx", "pnpm", "yarn", "bun", "deno", "python", "python3", "pip", "pip3", "cargo", "rustc", "go", "make", "cmake", "gradle", "mvn", "javac"]);
const nativeCommands = new Set(["adb", "xcodebuild", "pod", "emulator", "avdmanager", "fastboot", "simctl"]);
const privilegedCommands = new Set(["sudo", "doas", "pkexec", "su"]);
const mutatingCommands = new Set(["rm", "rmdir", "mv", "cp", "mkdir", "touch", "chmod", "chown", "ln", "dd", "truncate", "kill", "pkill", "git-reset", "git-checkout"]);
const readOnlyCommands = new Set(["pwd", "ls", "dir", "find", "cat", "head", "tail", "grep", "rg", "sed", "awk", "file", "stat", "wc", "which", "whereis"]);
const shellMetaCharacters = /[;&|<>`$(){}!\n\r\u0000]/;
const secretArgument = /(?:token|secret|password|passwd|api[-_]?key|authorization|private[-_]?key)\s*(?:=|:)\s*[^\s,;]+/gi;
const secretValue = /(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_-]{12,}|AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/g;

const requiredText = (value: unknown, field: string, maxLength: number): string => {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength || value.includes("\u0000") || value.includes("\n") || value.includes("\r")) throw new TerminalPolicyError(`${field} is invalid.`);
  return value;
};

const boundedTimeout = (value: number | undefined): number => {
  if (value === undefined) return 30_000;
  if (!Number.isInteger(value) || value < minTimeoutMs || value > maxTimeoutMs) throw new TerminalPolicyError("timeoutMs is outside the bounded terminal policy.");
  return value;
};

const boundedOutput = (value: number | undefined): number => {
  if (value === undefined) return 64 * 1024;
  if (!Number.isInteger(value) || value < minOutputBytes || value > maxOutputBytes) throw new TerminalPolicyError("maxOutputBytes is outside the bounded terminal policy.");
  return value;
};

const normalizeCwd = (value: string): string => {
  const cwd = requiredText(value, "cwd", maxCwdLength).trim();
  if (!cwd || cwd.startsWith("/") || cwd.startsWith("\\") || cwd.split(/[\\/]/u).some((part) => part === "..") || cwd.includes("\\")) throw new TerminalPolicyError("cwd must be a safe relative path.");
  return cwd;
};

const normalizeExecutable = (value: string): string => {
  const executable = requiredText(value, "executable", maxExecutableLength).trim().toLowerCase();
  if (!executable || executable.includes("/") || executable.includes("\\") || shellMetaCharacters.test(executable)) throw new TerminalPolicyError("executable must be a single allowlisted command name.");
  return executable;
};

const normalizeArgs = (values: readonly string[]): readonly string[] => {
  if (!Array.isArray(values) || values.length > maxArguments) throw new TerminalPolicyError("args exceed the bounded terminal policy.");
  return values.map((value, index) => {
    const argument = requiredText(value, `args[${index}]`, maxArgumentLength);
    if (shellMetaCharacters.test(argument)) throw new TerminalPolicyError(`args[${index}] contains shell syntax.`);
    return argument;
  });
};

const safeDisplayValue = (value: string): string => value
  .replace(secretArgument, (_match, key: string) => `${key}=[REDACTED]`)
  .replace(secretValue, "[REDACTED]");

const quoteForDisplay = (value: string): string => {
  const safe = safeDisplayValue(value);
  return /^[A-Za-z0-9_./:-]+$/u.test(safe) ? safe : `'${safe.replaceAll("'", "'\\''")}'`;
};

const displayCommand = (executable: string, args: readonly string[]): string => [executable, ...args].map(quoteForDisplay).join(" ").slice(0, 12_000);

const classify = (executable: string, args: readonly string[]): TerminalCommandClass => {
  if (shellWrappers.has(executable)) return "unknown";
  if (privilegedCommands.has(executable)) return "privileged";
  if (nativeCommands.has(executable)) return "native";
  if (toolchains.has(executable)) return "toolchain";
  if (mutatingCommands.has(executable)) return "mutating";
  if (executable === "git") {
    const subcommand = args[0]?.toLowerCase();
    return subcommand === "status" || subcommand === "diff" || subcommand === "log" || subcommand === "show" ? "read_only" : "mutating";
  }
  if (readOnlyCommands.has(executable)) return "read_only";
  return "unknown";
};

const digestRequest = (request: Pick<TerminalCommandRequest, "rootPath" | "cwd" | "executable" | "args" | "timeoutMs" | "maxOutputBytes">, commandClass: TerminalCommandClass): string => createHash("sha256").update(JSON.stringify({
  rootPath: request.rootPath,
  cwd: request.cwd,
  executable: request.executable,
  args: request.args,
  timeoutMs: request.timeoutMs,
  maxOutputBytes: request.maxOutputBytes,
  commandClass,
}), "utf8").digest("hex");

export class BoundedTerminalPolicy implements TerminalPolicyPort {
  public constructor(private readonly resourcePolicy?: Pick<ResourcePolicy, "profile">) {}

  public inspect(input: TerminalCommandRequest): TerminalPolicyDecision {
    const requestId = requiredText(input.requestId, "requestId", maxRequestIdLength);
    const sessionId = requiredText(input.sessionId, "sessionId", maxSessionIdLength);
    const rootPath = requiredText(input.rootPath, "rootPath", maxRootPathLength);
    const cwd = normalizeCwd(input.cwd);
    const executable = normalizeExecutable(input.executable);
    const args = normalizeArgs(input.args);
    const timeoutMs = boundedTimeout(input.timeoutMs);
    const maxOutputBytesValue = boundedOutput(input.maxOutputBytes);
    const commandClass = classify(executable, args);
    const commandDigest = digestRequest({ rootPath, cwd, executable, args, timeoutMs, maxOutputBytes: maxOutputBytesValue }, commandClass);
    const display = displayCommand(executable, args);
    const profile = this.resourcePolicy?.profile ?? "low_memory";
    if (commandClass === "read_only") {
      return {
        decision: "approval_required",
        commandClass,
        commandDigest,
        displayCommand: display,
        cwd,
        timeoutMs,
        maxOutputBytes: maxOutputBytesValue,
        reason: `Read-only terminal command requires explicit Human Gate approval in ${profile} profile.`,
        requiresHumanGate: true,
      };
    }
    return {
      decision: "denied",
      commandClass,
      commandDigest,
      displayCommand: display,
      cwd,
      timeoutMs,
      maxOutputBytes: maxOutputBytesValue,
      reason: `${commandClass === "unknown" ? "Unknown" : commandClass} terminal commands are denied; no process was started.`,
      requiresHumanGate: false,
    };
  }
}
