import assert from "node:assert/strict";
import test from "node:test";
import { ResourcePolicy } from "./application/resource-policy.js";
import { BoundedTerminalPolicy, TerminalPolicyError, type TerminalCommandRequest } from "./application/terminal-policy.js";

const request = (overrides: Partial<TerminalCommandRequest> = {}): TerminalCommandRequest => ({
  requestId: "terminal-request-1",
  sessionId: "session-1",
  rootPath: "/tmp/project",
  cwd: ".",
  executable: "pwd",
  args: [],
  ...overrides,
});

test("read-only commands require Human Gate without implying execution", () => {
  const policy = new BoundedTerminalPolicy(new ResourcePolicy("low_memory"));
  const decision = policy.inspect(request());
  assert.equal(decision.decision, "approval_required");
  assert.equal(decision.commandClass, "read_only");
  assert.equal(decision.requiresHumanGate, true);
  assert.equal(decision.displayCommand, "pwd");
  assert.equal(decision.timeoutMs, 30_000);
  assert.equal(decision.maxOutputBytes, 64 * 1024);
  assert.match(decision.commandDigest, /^[a-f0-9]{64}$/);
});

test("mutating, toolchain, native, privileged, and unknown commands are denied", () => {
  const policy = new BoundedTerminalPolicy();
  const cases: Array<[string, readonly string[], string]> = [
    ["rm", ["file.txt"], "mutating"],
    ["pnpm", ["test"], "toolchain"],
    ["adb", ["devices"], "native"],
    ["sudo", ["ls"], "privileged"],
    ["custom-command", [], "unknown"],
    ["git", ["status"], "read_only"],
    ["git", ["commit", "-m", "message"], "mutating"],
  ];
  for (const [executable, args, commandClass] of cases) {
    const decision = policy.inspect(request({ executable, args }));
    assert.equal(decision.commandClass, commandClass);
    assert.equal(decision.decision, commandClass === "read_only" ? "approval_required" : "denied");
    assert.equal(decision.requiresHumanGate, commandClass === "read_only");
  }
});

test("display command redacts secret-shaped values and digest remains deterministic", () => {
  const policy = new BoundedTerminalPolicy();
  const redactionFixture = ["sk", "12345678901234567890"].join("-");
  const input = request({ executable: "cat", args: [`--token=${redactionFixture}`, "notes.txt"] });
  const first = policy.inspect(input);
  const second = policy.inspect(input);
  assert.equal(first.commandDigest, second.commandDigest);
  assert.equal(first.displayCommand.includes(redactionFixture), false);
  assert.match(first.displayCommand, /REDACTED/);
  assert.equal(first.commandClass, "read_only");
});

test("shell wrappers and shell syntax fail closed instead of being escaped for execution", () => {
  const policy = new BoundedTerminalPolicy();
  const wrapper = policy.inspect(request({ executable: "sh", args: ["-c", "pwd"] }));
  assert.equal(wrapper.decision, "denied");
  assert.equal(wrapper.commandClass, "unknown");
  assert.throws(() => policy.inspect(request({ executable: "cat", args: ["file;rm -rf ."] })), TerminalPolicyError);
  assert.throws(() => policy.inspect(request({ executable: "cat", args: ["file\u0000.txt"] })), TerminalPolicyError);
});

test("cwd and request fields stay bounded and relative", () => {
  const policy = new BoundedTerminalPolicy();
  assert.throws(() => policy.inspect(request({ cwd: "../outside" })), TerminalPolicyError);
  assert.throws(() => policy.inspect(request({ cwd: "/tmp/project" })), TerminalPolicyError);
  assert.throws(() => policy.inspect(request({ timeoutMs: 500 })), TerminalPolicyError);
  assert.throws(() => policy.inspect(request({ maxOutputBytes: 1024 })), TerminalPolicyError);
  assert.throws(() => policy.inspect(request({ args: Array.from({ length: 65 }, () => "x") })), TerminalPolicyError);
  assert.throws(() => policy.inspect(request({ executable: "./pwd" })), TerminalPolicyError);
});

test("explicit resource bounds are reflected in the decision", () => {
  const policy = new BoundedTerminalPolicy();
  const decision = policy.inspect(request({ timeoutMs: 120_000, maxOutputBytes: 256 * 1024 }));
  assert.equal(decision.timeoutMs, 120_000);
  assert.equal(decision.maxOutputBytes, 256 * 1024);
});
