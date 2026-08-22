import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEmbeddedApplication, createFoundation } from "./composition.js";
import { FilesystemProjectPreviewService } from "./application/project-preview-service.js";
import { FilesystemProjectScanner } from "./infrastructure/filesystem-project-scanner.js";
import { resolve } from "node:path";
import { InMemoryLightweightPreviewAdapter } from "./mobile/preview.js";
import { InMemoryEmbeddedSimulatorController } from "./mobile/embedded-controller.js";
import { InMemoryIpcTransport } from "./ipc/in-memory-transport.js";
import { registerEmbeddedSimulatorHandlers } from "./ipc/embedded-handlers.js";
import { buildProjectPreviewBundle } from "./mobile/preview-runtime.js";
import type { PreviewSession } from "./domain/entities.js";
import { isIpcEvent } from "./ipc/contracts.js";
import type { PreviewInspection, IpcResponse, PreviewProjectOpenResult } from "./ipc/contracts.js";
import type { ProjectTreeResult, WorkspaceFileContent } from "./application/project-explorer.js";
import type { DocumentSnapshot, EditProposal } from "./application/editor-document.js";
import type { ProjectContextSnapshot } from "./application/project-context.js";
import type { GitDiffResult, GitStatusSnapshot } from "./application/git-read-only.js";
import type { WorkCycleResult } from "./application/agent-work-cycle.js";
import type { AgentTaskPreviewResult } from "./application/agent-task-preview.js";
import type { ArtifactDraft } from "./application/artifact-assembly.js";
import type { RenderPolicyPreview } from "./application/render-policy.js";
import type { MemoryEntry } from "./application/memory-capture.js";
import type { ExternalAccountRecord } from "./application/external-account-registry.js";
import type { CitationRecord, ProvenanceLink, SourceRecord } from "./application/source-registry.js";
import { defaultLocalProviderConfig } from "./application/provider-policy.js";
import { OllamaProviderAdapter } from "./infrastructure/local-http-provider.js";
import { FixtureProviderAdapter } from "./infrastructure/fixture-provider.js";
import type { ProviderManifest } from "./application/provider-contracts.js";

const setup = () => {
  const { useCases } = createFoundation();
  const profile = useCases.registerDeviceProfile({ id: "ipc-pixel", name: "IPC Pixel", platform: "android", osVersion: "15", width: 1080, height: 2424, dpi: 420 });
  const controller = new InMemoryEmbeddedSimulatorController(useCases, new InMemoryLightweightPreviewAdapter());
  controller.registerProfile(profile);
  const transport = new InMemoryIpcTransport();
  const projectPreviewService = new FilesystemProjectPreviewService(new FilesystemProjectScanner());
  registerEmbeddedSimulatorHandlers(transport, controller, projectPreviewService);
  return { profile, transport };
};

test("typed IPC starts and inspects embedded preview", async () => {
  const { profile, transport } = setup();
  const health = await transport.dispatch({ protocolVersion: 1, requestId: "health-1", correlationId: "c-1", method: "health.get", payload: {} });
  assert.equal(health.ok, true);
  const bundle = buildProjectPreviewBundle({ projectId: "ipc-fixture", rootPath: "/fixtures", entry: "app/index.tsx", files: {
    "app/index.tsx": `import { Text } from "react-native"; export default function App() { return <Text>IPC content</Text>; }`,
  } });
  const started = await transport.dispatch({ protocolVersion: 1, requestId: "start-1", correlationId: "c-1", method: "preview.start", payload: { deviceProfileId: profile.id, bundle } } as const) as IpcResponse<PreviewSession>;
  assert.equal(started.ok, true);
  if (!started.ok) return;
  const sessionId = started.result.id;
  const inspected = await transport.dispatch({ protocolVersion: 1, requestId: "inspect-1", correlationId: "c-1", method: "preview.inspect", payload: { sessionId } } as const) as IpcResponse<PreviewInspection>;
  assert.equal(inspected.ok, true);
  if (inspected.ok) {
    assert.equal(inspected.result.nativeFidelity, "compatibility");
    assert.equal(inspected.result.bundle?.sourceHash, bundle.sourceHash);
  }
  const refreshed = await transport.dispatch({ protocolVersion: 1, requestId: "refresh-1", correlationId: "c-1", method: "preview.refresh", payload: { sessionId, kind: "fast", bundle } } as const);
  assert.equal(refreshed.ok, true);
});

test("typed IPC opens a filesystem project and starts the embedded preview", async () => {
  const { profile, transport } = setup();
  const opened = await transport.dispatch({
    protocolVersion: 1,
    requestId: "open-project-1",
    correlationId: "c-project-1",
    method: "preview.openProject",
    payload: {
      projectId: "filesystem-ipc-fixture",
      rootPath: resolve("fixtures/mobile-expo"),
      deviceProfileId: profile.id,
      mode: "lightweight_web",
    },
  } as const) as IpcResponse<PreviewProjectOpenResult>;
  assert.equal(opened.ok, true);
  if (!opened.ok) return;
  assert.equal(opened.result.session.status, "ready");
  assert.equal(opened.result.bundle.projectId, "filesystem-ipc-fixture");
  assert.equal(opened.result.bundle.entry, "app/index.tsx");
  assert.equal(opened.result.bundle.moduleCount, 2);

  const inspected = await transport.dispatch({
    protocolVersion: 1,
    requestId: "inspect-project-1",
    correlationId: "c-project-1",
    method: "preview.inspect",
    payload: { sessionId: opened.result.session.id },
  } as const) as IpcResponse<PreviewInspection>;
  assert.equal(inspected.ok, true);
  if (inspected.ok) assert.equal(inspected.result.bundle?.projectId, "filesystem-ipc-fixture");
});

test("typed IPC registers and lists production sources without network or filesystem mutation", async () => {
  const root = await mkdtemp(join(tmpdir(), "osamah-ipc-source-"));
  const app = createEmbeddedApplication();
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => { fetchCalls += 1; throw new Error("fetch must not be called"); }) as typeof fetch;
  try {
    await writeFile(join(root, "brief.md"), "local brief\n");
    const registered = await app.ipc.dispatch({ protocolVersion: 1, requestId: "source-register-1", correlationId: "source-1", method: "production.source.register", payload: { kind: "workspace_document", locator: "workspace://brief.md", title: "Brief", contentType: "text/markdown", bytes: 12, sha256: "a".repeat(64), verificationState: "content_validated" } } as const) as IpcResponse<SourceRecord>;
    assert.equal(registered.ok, true);
    if (!registered.ok) return;
    assert.equal(registered.result.locator, "workspace://brief.md");
    const listed = await app.ipc.dispatch({ protocolVersion: 1, requestId: "source-list-1", correlationId: "source-1", method: "production.source.list", payload: { limit: 8 } } as const) as IpcResponse<readonly SourceRecord[]>;
    assert.equal(listed.ok, true);
    if (!listed.ok) return;
    assert.equal(listed.result.length, 1);
    const citation = await app.ipc.dispatch({ protocolVersion: 1, requestId: "citation-add-1", correlationId: "source-1", method: "production.citation.add", payload: { sourceId: registered.result.sourceId, label: "Brief line", span: { start: 0, end: 11 }, quotePreview: "local brief", verificationState: "unverified" } } as const) as IpcResponse<CitationRecord>;
    assert.equal(citation.ok, true);
    if (!citation.ok) return;
    const citations = await app.ipc.dispatch({ protocolVersion: 1, requestId: "citation-list-1", correlationId: "source-1", method: "production.citation.list", payload: { sourceId: registered.result.sourceId, limit: 8 } } as const) as IpcResponse<readonly CitationRecord[]>;
    assert.equal(citations.ok, true);
    const link = await app.ipc.dispatch({ protocolVersion: 1, requestId: "provenance-list-1", correlationId: "source-1", method: "production.provenance.list", payload: { entityId: registered.result.sourceId, limit: 8 } } as const) as IpcResponse<readonly ProvenanceLink[]>;
    assert.equal(link.ok, true);
    assert.equal(fetchCalls, 0);
    assert.equal(await readFile(join(root, "brief.md"), "utf8"), "local brief\n");
    const malformed = await app.ipc.dispatch({ protocolVersion: 1, requestId: "source-malformed-1", correlationId: "source-1", method: "production.source.register", payload: { kind: "user_url", locator: "https://example.test", verificationState: "content_validated" } } as const);
    assert.equal(malformed.ok, false);
    const unsafeQuote = await app.ipc.dispatch({ protocolVersion: 1, requestId: "citation-unsafe-1", correlationId: "source-1", method: "production.citation.add", payload: { sourceId: registered.result.sourceId, label: "bad\u0000label" } } as const);
    assert.equal(unsafeQuote.ok, false);
  } finally {
    globalThis.fetch = originalFetch;
    app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("typed IPC registers external account metadata without network, secrets, or provider calls", async () => {
  const app = createEmbeddedApplication();
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => { fetchCalls += 1; throw new Error("fetch must not be called"); }) as typeof fetch;
  try {
    const registered = await app.ipc.dispatch({ protocolVersion: 1, requestId: "account-register-1", correlationId: "account-1", method: "external.account.register", payload: { providerId: "GitHub", label: "Work", owner: "Osamah", scopes: ["repo:read"], resourceScope: "workspace:demo" } } as const) as IpcResponse<ExternalAccountRecord>;
    assert.equal(registered.ok, true);
    if (!registered.ok) return;
    assert.equal(registered.result.providerId, "github");
    assert.equal(registered.result.status, "disconnected");
    assert.equal(registered.result.consentState, "required");
    assert.equal(registered.result.verificationState, "unknown");
    assert.equal("token" in registered.result, false);
    const listed = await app.ipc.dispatch({ protocolVersion: 1, requestId: "account-list-1", correlationId: "account-1", method: "external.account.list", payload: { limit: 8 } } as const) as IpcResponse<readonly ExternalAccountRecord[]>;
    assert.equal(listed.ok, true);
    if (!listed.ok) return;
    assert.equal(listed.result.length, 1);
    assert.equal(fetchCalls, 0);
    const malformed = await app.ipc.dispatch({ protocolVersion: 1, requestId: "account-malformed-1", correlationId: "account-1", method: "external.account.register", payload: { providerId: "github", label: "Bad", owner: "Osamah", token: "secret-shaped" } } as const);
    assert.equal(malformed.ok, false);
    const invalidExpiry = await app.ipc.dispatch({ protocolVersion: 1, requestId: "account-expiry-1", correlationId: "account-1", method: "external.account.register", payload: { providerId: "github", label: "Bad expiry", owner: "Osamah", expiresAt: "not-a-date" } } as const);
    assert.equal(invalidExpiry.ok, false);
  } finally {
    globalThis.fetch = originalFetch;
    app.close();
  }
});

test("typed IPC builds a review-only content plan and preserves citation integrity", async () => {
  const app = createEmbeddedApplication();
  try {
    const created = await app.ipc.dispatch({ protocolVersion: 1, requestId: "plan-create-1", correlationId: "plan-1", method: "production.plan.create", payload: { brief: "Prepare a bounded content review" } } as const) as IpcResponse<import("./application/content-plan.js").ContentPlan>;
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const section = await app.ipc.dispatch({ protocolVersion: 1, requestId: "plan-section-1", correlationId: "plan-1", method: "production.plan.section.add", payload: { planId: created.result.planId, title: "Findings" } } as const) as IpcResponse<import("./application/content-plan.js").ContentPlan>;
    assert.equal(section.ok, true);
    if (!section.ok) return;
    const claim = await app.ipc.dispatch({ protocolVersion: 1, requestId: "plan-claim-1", correlationId: "plan-1", method: "production.plan.claim.add", payload: { planId: created.result.planId, sectionId: section.result.sections[0]!.sectionId, text: "This claim needs a citation.", confidence: 0.5 } } as const) as IpcResponse<import("./application/content-plan.js").ContentPlan>;
    assert.equal(claim.ok, true);
    if (!claim.ok) return;
    assert.equal(claim.result.integrity.unresolvedClaims, 1);
    const source = await app.ipc.dispatch({ protocolVersion: 1, requestId: "plan-source-1", correlationId: "plan-1", method: "production.source.register", payload: { kind: "user_url", locator: "https://example.test/plan", verificationState: "metadata_validated" } } as const) as IpcResponse<SourceRecord>;
    assert.equal(source.ok, true);
    if (!source.ok) return;
    const citation = await app.ipc.dispatch({ protocolVersion: 1, requestId: "plan-citation-1", correlationId: "plan-1", method: "production.citation.add", payload: { sourceId: source.result.sourceId, label: "Plan evidence", verificationState: "unverified" } } as const) as IpcResponse<CitationRecord>;
    assert.equal(citation.ok, true);
    if (!citation.ok) return;
    const attached = await app.ipc.dispatch({ protocolVersion: 1, requestId: "plan-attach-1", correlationId: "plan-1", method: "production.plan.citation.attach", payload: { planId: created.result.planId, claimId: claim.result.claims[0]!.claimId, citationId: citation.result.citationId } } as const) as IpcResponse<import("./application/content-plan.js").ContentPlan>;
    assert.equal(attached.ok, true);
    if (attached.ok) {
      assert.equal(attached.result.integrity.supportedClaims, 1);
      assert.equal(attached.result.claims[0]?.verificationState, "supported");
      assert.ok(attached.result.integrity.warnings.includes("citation_or_source_unverified"));
    }
    const stored = await app.ipc.dispatch({ protocolVersion: 1, requestId: "plan-get-1", correlationId: "plan-1", method: "production.plan.get", payload: { planId: created.result.planId } } as const) as IpcResponse<import("./application/content-plan.js").ContentPlan | undefined>;
    assert.equal(stored.ok, true);
    const malformed = await app.ipc.dispatch({ protocolVersion: 1, requestId: "plan-malformed-1", correlationId: "plan-1", method: "production.plan.create", payload: { brief: "line\nbreak" } } as const);
    assert.equal(malformed.ok, false);
  } finally {
    app.close();
  }
});

test("typed IPC lists a bounded project tree and opens text through the safe reader", async () => {
  const root = await mkdtemp(join(tmpdir(), "osamah-ipc-explorer-"));
  const app = createEmbeddedApplication();
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src", "app.ts"), "export const value = 1;\n");
    await writeFile(join(root, "binary.bin"), Buffer.from([0, 1, 2]));
    const tree = await app.ipc.dispatch({ protocolVersion: 1, requestId: "tree-1", correlationId: "explorer-1", method: "project.tree", payload: { rootPath: root } } as const) as IpcResponse<ProjectTreeResult>;
    assert.equal(tree.ok, true);
    if (!tree.ok) return;
    assert.equal(tree.result.fileCount, 2);
    assert.equal(tree.result.root.children?.[0]?.name, "src");
    const opened = await app.ipc.dispatch({ protocolVersion: 1, requestId: "file-1", correlationId: "explorer-1", method: "file.openText", payload: { rootPath: root, relativePath: "src/app.ts" } } as const) as IpcResponse<WorkspaceFileContent | undefined>;
    assert.equal(opened.ok, true);
    if (opened.ok) {
      assert.equal(opened.result?.content, "export const value = 1;\n");
      assert.equal(opened.result?.relativePath, "src/app.ts");
    }
    const traversal = await app.ipc.dispatch({ protocolVersion: 1, requestId: "file-traversal-1", correlationId: "explorer-1", method: "file.openText", payload: { rootPath: root, relativePath: "../secret.txt" } } as const);
    assert.equal(traversal.ok, false);
    const malformed = await app.ipc.dispatch({ protocolVersion: 1, requestId: "file-malformed-1", correlationId: "explorer-1", method: "file.openText", payload: { rootPath: root, relativePath: "" } } as const);
    assert.equal(malformed.ok, false);
  } finally {
    app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("typed IPC opens and proposes editor documents without mutating the filesystem", async () => {
  const root = await mkdtemp(join(tmpdir(), "osamah-ipc-editor-"));
  const app = createEmbeddedApplication();
  try {
    await writeFile(join(root, "app.ts"), "const value = 1;\n");
    const opened = await app.ipc.dispatch({ protocolVersion: 1, requestId: "editor-open-1", correlationId: "editor-1", method: "editor.open", payload: { rootPath: root, relativePath: "app.ts" } } as const) as IpcResponse<DocumentSnapshot | undefined>;
    assert.equal(opened.ok, true);
    if (!opened.ok || opened.result === undefined) return;
    assert.equal(opened.result.content, "const value = 1;\n");
    assert.equal(opened.result.revision, 1);
    const proposed = await app.ipc.dispatch({ protocolVersion: 1, requestId: "editor-propose-1", correlationId: "editor-1", method: "editor.propose", payload: { rootPath: root, relativePath: "app.ts", content: "const value = 2;\n", expectedSha256: opened.result.sha256 } } as const) as IpcResponse<EditProposal>;
    assert.equal(proposed.ok, true);
    if (proposed.ok) {
      assert.equal(proposed.result.before, "const value = 1;\n");
      assert.equal(proposed.result.after, "const value = 2;\n");
      assert.equal(proposed.result.diffTruncated, false);
    }
    assert.equal(await readFile(join(root, "app.ts"), "utf8"), "const value = 1;\n");
    const stale = await app.ipc.dispatch({ protocolVersion: 1, requestId: "editor-stale-1", correlationId: "editor-1", method: "editor.propose", payload: { rootPath: root, relativePath: "app.ts", content: "const value = 3;\n", expectedSha256: "0".repeat(64) } } as const);
    assert.equal(stale.ok, false);
    const invalid = await app.ipc.dispatch({ protocolVersion: 1, requestId: "editor-invalid-1", correlationId: "editor-1", method: "editor.propose", payload: { rootPath: root, relativePath: "app.ts", content: "bad\u0000content", expectedSha256: opened.result.sha256 } } as const);
    assert.equal(invalid.ok, false);
  } finally {
    app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("typed IPC rejects project entries that escape the selected root", async () => {
  const { profile, transport } = setup();
  const blocked = await transport.dispatch({
    protocolVersion: 1,
    requestId: "open-project-unsafe-1",
    correlationId: "c-project-unsafe-1",
    method: "preview.openProject",
    payload: {
      projectId: "unsafe-fixture",
      rootPath: resolve("fixtures/mobile-expo"),
      entry: "../package.json",
      deviceProfileId: profile.id,
    },
  } as const) as IpcResponse<PreviewProjectOpenResult>;
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.match(blocked.error.message, /Unsafe preview path/);
});

test("typed IPC inspects terminal commands without starting a process", async () => {
  const app = createEmbeddedApplication();
  try {
    const readOnly = await app.ipc.dispatch({
      protocolVersion: 1,
      requestId: "terminal-inspect-1",
      correlationId: "terminal-1",
      method: "terminal.inspect",
      payload: { requestId: "terminal-request-1", sessionId: "terminal-session-1", rootPath: "/tmp/project", cwd: ".", executable: "pwd", args: [] },
    } as const) as IpcResponse<import("./application/terminal-policy.js").TerminalPolicyDecision>;
    assert.equal(readOnly.ok, true);
    if (readOnly.ok) {
      assert.equal(readOnly.result.decision, "approval_required");
      assert.equal(readOnly.result.commandClass, "read_only");
      assert.equal(readOnly.result.requiresHumanGate, true);
    }
    const denied = await app.ipc.dispatch({
      protocolVersion: 1,
      requestId: "terminal-inspect-2",
      correlationId: "terminal-1",
      method: "terminal.inspect",
      payload: { requestId: "terminal-request-2", sessionId: "terminal-session-1", rootPath: "/tmp/project", cwd: ".", executable: "pnpm", args: ["test"] },
    } as const) as IpcResponse<import("./application/terminal-policy.js").TerminalPolicyDecision>;
    assert.equal(denied.ok, true);
    if (denied.ok) {
      assert.equal(denied.result.decision, "denied");
      assert.equal(denied.result.commandClass, "toolchain");
    }
    const malformed = await app.ipc.dispatch({
      protocolVersion: 1,
      requestId: "terminal-inspect-3",
      correlationId: "terminal-1",
      method: "terminal.inspect",
      payload: { requestId: "terminal-request-3", sessionId: "terminal-session-1", rootPath: "/tmp/project", cwd: "../outside", executable: "pwd", args: [] },
    } as const);
    assert.equal(malformed.ok, false);
  } finally {
    app.close();
  }
});

test("typed IPC exposes read-only Git status and diff without mutations", async () => {
  const root = resolve(".");
  const app = createEmbeddedApplication();
  try {
    const status = await app.ipc.dispatch({ protocolVersion: 1, requestId: "git-status-1", correlationId: "git-1", method: "git.status", payload: { rootPath: root } } as const) as IpcResponse<GitStatusSnapshot>;
    assert.equal(status.ok, true);
    if (!status.ok) return;
    assert.equal(status.result.isRepository, true);
    assert.equal(typeof status.result.branch, "string");
    assert.ok(status.result.staged.length >= 0);
    assert.ok(status.result.unstaged.length >= 0);
    assert.ok(status.result.untracked.length >= 0);
    const diff = await app.ipc.dispatch({ protocolVersion: 1, requestId: "git-diff-1", correlationId: "git-1", method: "git.diff", payload: { rootPath: root, relativePath: "package.json" } } as const) as IpcResponse<GitDiffResult>;
    assert.equal(diff.ok, true);
    if (diff.ok) {
      assert.equal(diff.result.relativePath, "package.json");
      assert.equal(typeof diff.result.patch, "string");
      assert.ok(diff.result.bytes <= 128 * 1024 + 128);
    }
    const traversal = await app.ipc.dispatch({ protocolVersion: 1, requestId: "git-diff-2", correlationId: "git-1", method: "git.diff", payload: { rootPath: root, relativePath: "../outside" } } as const);
    assert.equal(traversal.ok, false);
    const malformed = await app.ipc.dispatch({ protocolVersion: 1, requestId: "git-diff-3", correlationId: "git-1", method: "git.diff", payload: { rootPath: root, relativePath: "-p" } } as const);
    assert.equal(malformed.ok, false);
  } finally {
    app.close();
  }
});

test("typed IPC exposes project context and a full guarded work cycle", async () => {
  const root = await mkdtemp(join(tmpdir(), "osamah-ipc-cycle-"));
  const app = createEmbeddedApplication();
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "package.json"), JSON.stringify({ name: "ipc-cycle-fixture", version: "1.0.0" }));
    await writeFile(join(root, "src", "example.ts"), "export const value = 1;\n");
    const context = await app.ipc.dispatch({ protocolVersion: 1, requestId: "context-1", correlationId: "ipc-cycle", method: "context.index", payload: { rootPath: root } } as const) as IpcResponse<ProjectContextSnapshot>;
    assert.equal(context.ok, true);
    if (context.ok) assert.equal(context.result.manifests[0]?.name, "ipc-cycle-fixture");

    const startPayload = {
      cycleId: "ipc-cycle-1",
      sessionId: "ipc-session-1",
      rootPath: root,
      goal: "Update the file through IPC.",
      constraints: ["Do not execute scripts."],
      targetedPaths: ["src/example.ts"],
      plan: { summary: "Update the file through IPC.", steps: [{ id: "read", title: "Read", description: "Read the selected file." }] },
      patch: { proposalId: "ipc-patch-1", operations: [{ relativePath: "src/example.ts", mode: "update" as const, content: "export const value = 2;\n" }] },
    };
    const waiting = await app.ipc.dispatch({ protocolVersion: 1, requestId: "cycle-start-1", correlationId: "ipc-cycle", method: "workCycle.start", payload: startPayload } as const) as IpcResponse<WorkCycleResult>;
    assert.equal(waiting.ok, true);
    if (!waiting.ok) return;
    assert.equal(waiting.result.cycle.stage, "waiting_approval");
    assert.ok(waiting.result.cycle.approvalId);
    const pendingApprovals = await app.ipc.dispatch({ protocolVersion: 1, requestId: "approval-list-1", correlationId: "ipc-cycle", method: "approval.listPending", payload: { limit: 10 } } as const);
    assert.equal(pendingApprovals.ok, true);
    if (pendingApprovals.ok) assert.equal(pendingApprovals.result.length, 1);
    const decision = await app.ipc.dispatch({ protocolVersion: 1, requestId: "approval-decide-1", correlationId: "ipc-cycle", method: "approval.decide", payload: { approvalId: waiting.result.cycle.approvalId, decision: "approved" } } as const);
    assert.equal(decision.ok, true);
    if (decision.ok) assert.equal(decision.result.status, "approved");
    const resumed = await app.ipc.dispatch({ protocolVersion: 1, requestId: "cycle-start-2", correlationId: "ipc-cycle", method: "workCycle.start", payload: { ...startPayload, approvalId: waiting.result.cycle.approvalId } } as const) as IpcResponse<WorkCycleResult>;
    assert.equal(resumed.ok, true);
    if (!resumed.ok) return;
    assert.equal(resumed.result.cycle.stage, "applied");
    assert.equal(await readFile(join(root, "src", "example.ts"), "utf8"), "export const value = 2;\n");
    const inspected = await app.ipc.dispatch({ protocolVersion: 1, requestId: "cycle-inspect-1", correlationId: "ipc-cycle", method: "workCycle.inspect", payload: { cycleId: "ipc-cycle-1" } } as const);
    assert.equal(inspected.ok, true);
    const cancelled = await app.ipc.dispatch({ protocolVersion: 1, requestId: "cycle-cancel-1", correlationId: "ipc-cycle", method: "workCycle.cancel", payload: { cycleId: "ipc-cycle-1" } } as const);
    assert.equal(cancelled.ok, true);
    if (cancelled.ok) assert.equal(cancelled.result.cancelled, false);
  } finally {
    app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("typed IPC starts a plan-less WorkCycle with provider/model selection and preserves Human Gate", async () => {
  const root = await mkdtemp(join(tmpdir(), "osamah-ipc-provider-planner-"));
  await writeFile(join(root, "app.ts"), "export const value = 1;\n");
  const manifest: ProviderManifest = {
    id: "ollama",
    label: "Ollama fixture",
    transport: "fixture",
    privacy: "local",
    offline: true,
    capabilities: ["text", "structured_output"],
    models: [{ id: "fixture-model", capabilities: ["text", "structured_output"], contextWindow: 4096, streaming: false, offline: true, estimatedLatencyMs: 1 }],
  };
  const provider = new FixtureProviderAdapter({
    manifest,
    responseText: JSON.stringify({ summary: "IPC generated plan", steps: [{ id: "review", title: "Review", description: "Review bounded context." }] }),
  });
  const app = createEmbeddedApplication({ providers: [provider], providerConfigs: [{ ...defaultLocalProviderConfig("ollama", "fixture-model"), enabled: true }] });
  try {
    const response = await app.ipc.dispatch({
      protocolVersion: 1,
      requestId: "provider-cycle-start-1",
      correlationId: "provider-cycle",
      method: "workCycle.start",
      payload: {
        cycleId: "provider-cycle-1",
        sessionId: "provider-session-1",
        rootPath: root,
        goal: "Update safely through the selected provider",
        constraints: ["Do not execute scripts."],
        targetedPaths: ["app.ts"],
        providerId: "ollama",
        modelId: "fixture-model",
        offlineMode: true,
        patch: { proposalId: "provider-cycle-patch", operations: [{ relativePath: "app.ts", mode: "update" as const, content: "export const value = 2;\n" }] },
      },
    } as const) as IpcResponse<WorkCycleResult>;
    assert.equal(response.ok, true);
    if (!response.ok) return;
    assert.equal(response.result.cycle.stage, "waiting_approval");
    assert.equal(response.result.cycle.providerId, "ollama");
    assert.equal(response.result.cycle.modelId, "fixture-model");
    assert.equal(response.result.plan.summary, "IPC generated plan");
    assert.equal(provider.requests.length, 1);
    assert.equal(app.humanGate.listPending(10).length, 1);
    assert.equal(await readFile(join(root, "app.ts"), "utf8"), "export const value = 1;\n");
  } finally {
    app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("typed IPC can cancel a waiting work cycle before approval", async () => {
  const root = await mkdtemp(join(tmpdir(), "osamah-ipc-cancel-"));
  const app = createEmbeddedApplication();
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src", "example.ts"), "export const value = 1;\n");
    const waiting = await app.ipc.dispatch({ protocolVersion: 1, requestId: "cancel-start-1", correlationId: "ipc-cancel", method: "workCycle.start", payload: {
      cycleId: "ipc-cancel-1", sessionId: "ipc-session-1", rootPath: root, goal: "Cancel this patch", constraints: [], targetedPaths: ["src/example.ts"],
      plan: { summary: "Cancel this patch", steps: [{ id: "inspect", title: "Inspect", description: "Review the selected file before approval." }] }, patch: { proposalId: "ipc-cancel-patch", operations: [{ relativePath: "src/example.ts", mode: "update" as const, content: "cancelled\n" }] },
    } } as const) as IpcResponse<WorkCycleResult>;
    assert.equal(waiting.ok, true);
    const cancelled = await app.ipc.dispatch({ protocolVersion: 1, requestId: "cancel-1", correlationId: "ipc-cancel", method: "workCycle.cancel", payload: { cycleId: "ipc-cancel-1" } } as const);
    assert.equal(cancelled.ok, true);
    if (cancelled.ok) {
      assert.equal(cancelled.result.cancelled, true);
      assert.equal(cancelled.result.cycle?.stage, "cancelled");
    }
    assert.equal(await readFile(join(root, "src", "example.ts"), "utf8"), "export const value = 1;\n");
  } finally {
    app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("typed approval events accept safe ticket payloads and reject malformed payloads", () => {
  const ticket = {
    approvalId: "approval-event",
    correlationId: "correlation-event",
    action: { actionId: "action-event", sessionId: "session-event", kind: "filesystem.write" as const, risk: "high" as const, scope: "src/app.ts", idempotencyKey: "idem-event" },
    status: "requested" as const,
    createdAt: "2026-08-22T10:10:00.000Z",
  };
  assert.equal(isIpcEvent({ type: "approval.changed", ticket }), true);
  assert.equal(isIpcEvent({ type: "approval.changed", ticket: { ...ticket, action: { ...ticket.action, scope: "" } } }), false);
  assert.equal(isIpcEvent({ type: "approval.changed", ticket: { ...ticket, status: "expired" } }), false);
  assert.equal(isIpcEvent({ type: "approval.changed", ticket: { ...ticket, action: { ...ticket.action, kind: "terminal.unknown" } } }), false);
});

test("typed IPC lists providers, configures disabled local providers, and runs explicit doctor", async () => {
  let fetchCalls = 0;
  const app = createEmbeddedApplication({ providers: [new OllamaProviderAdapter({
    baseUrl: "http://127.0.0.1:11434",
    modelId: "local-model",
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response(JSON.stringify({ models: [] }), { status: 200 });
    },
  })] });
  try {
    const listed = await app.ipc.dispatch({ protocolVersion: 1, requestId: "provider-list-1", correlationId: "provider-ui", method: "provider.list", payload: {} } as const);
    assert.equal(listed.ok, true);
    if (listed.ok) {
      assert.equal(listed.result.length, 1);
      assert.equal(listed.result[0]?.id, "ollama");
      assert.equal(listed.result[0]?.configured, false);
    }
    const configured = await app.ipc.dispatch({ protocolVersion: 1, requestId: "provider-config-1", correlationId: "provider-ui", method: "provider.configure", payload: defaultLocalProviderConfig("ollama", "local-model") } as const);
    assert.equal(configured.ok, true);
    const doctor = await app.ipc.dispatch({ protocolVersion: 1, requestId: "provider-doctor-1", correlationId: "provider-ui", method: "provider.doctor", payload: { providerId: "ollama" } } as const);
    assert.equal(doctor.ok, true);
    if (doctor.ok) assert.equal(doctor.result[0]?.status, "disabled");
    assert.equal(fetchCalls, 0);
    const malformed = await app.ipc.dispatch({ protocolVersion: 1, requestId: "provider-invalid-1", correlationId: "provider-ui", method: "provider.configure", payload: { ...defaultLocalProviderConfig("ollama", "local-model"), maxConcurrent: 2 } } as const);
    assert.equal(malformed.ok, false);
    if (!malformed.ok) assert.equal(malformed.error.code, "INVALID_REQUEST");
  } finally {
    app.close();
  }
});

test("typed IPC rejects malformed, unknown, and duplicate requests", async () => {
  const { transport } = setup();
  const malformed = await transport.dispatch({ method: "health.get" });
  assert.equal(malformed.ok, false);
  if (!malformed.ok) assert.equal(malformed.error.code, "INVALID_REQUEST");
  const unknown = await transport.dispatch({ protocolVersion: 1, requestId: "unknown-1", correlationId: "c-2", method: "preview.unknown", payload: {} });
  assert.equal(unknown.ok, false);
  if (!unknown.ok) assert.equal(unknown.error.code, "UNKNOWN_METHOD");
  const malformedContext = await transport.dispatch({ protocolVersion: 1, requestId: "context-invalid-1", correlationId: "c-2", method: "context.index", payload: {} });
  assert.equal(malformedContext.ok, false);
  if (!malformedContext.ok) assert.equal(malformedContext.error.code, "INVALID_REQUEST");
  const malformedCycle = await transport.dispatch({ protocolVersion: 1, requestId: "cycle-invalid-1", correlationId: "c-2", method: "workCycle.start", payload: { cycleId: "missing-fields" } });
  assert.equal(malformedCycle.ok, false);
  if (!malformedCycle.ok) assert.equal(malformedCycle.error.code, "INVALID_REQUEST");
  const malformedApproval = await transport.dispatch({ protocolVersion: 1, requestId: "approval-invalid-1", correlationId: "c-2", method: "approval.decide", payload: { approvalId: "approval-1", decision: "unknown" } });
  assert.equal(malformedApproval.ok, false);
  if (!malformedApproval.ok) assert.equal(malformedApproval.error.code, "INVALID_REQUEST");
  const malformedProvider = await transport.dispatch({ protocolVersion: 1, requestId: "provider-invalid-1", correlationId: "c-2", method: "provider.configure", payload: { providerId: "ollama", enabled: true } });
  assert.equal(malformedProvider.ok, false);
  if (!malformedProvider.ok) assert.equal(malformedProvider.error.code, "INVALID_REQUEST");
  const first = await transport.dispatch({ protocolVersion: 1, requestId: "health-duplicate", correlationId: "c-3", method: "health.get", payload: {} });
  assert.equal(first.ok, true);
  const duplicate = await transport.dispatch({ protocolVersion: 1, requestId: "health-duplicate", correlationId: "c-3", method: "health.get", payload: {} });
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) assert.equal(duplicate.error.code, "DUPLICATE_REQUEST");
});

test("typed IPC previews context and task plan without mutation or approval ticket", async () => {
  const root = await mkdtemp(join(tmpdir(), "osamah-ipc-task-preview-"));
  const app = createEmbeddedApplication();
  try {
    await writeFile(join(root, "app.ts"), "export const value = 1;\n");
    const before = await readFile(join(root, "app.ts"), "utf8");
    const preview = await app.ipc.dispatch({
      protocolVersion: 1,
      requestId: "task-preview-1",
      correlationId: "task-preview-correlation",
      method: "task.preview",
      payload: { rootPath: root, goal: "Review the local app", constraints: ["Do not execute scripts."], targetedPaths: ["app.ts"], offlineMode: true },
    } as const) as IpcResponse<AgentTaskPreviewResult>;
    assert.equal(preview.ok, true);
    if (!preview.ok) return;
    assert.equal(preview.result.safeToProceed, true);
    assert.equal(preview.result.targetedFiles[0]?.relativePath, "app.ts");
    assert.equal(preview.result.plan.steps.some((step) => step.id === "verify"), true);
    assert.equal((await readFile(join(root, "app.ts"), "utf8")), before);
    const pending = await app.ipc.dispatch({ protocolVersion: 1, requestId: "task-preview-approval-list", correlationId: "task-preview-approval", method: "approval.listPending", payload: { limit: 8 } } as const);
    assert.equal(pending.ok, true);
    if (pending.ok) assert.equal(pending.result.length, 0);
  } finally {
    app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("typed IPC rejects malformed task.preview paths before application access", async () => {
  const app = createEmbeddedApplication();
  try {
    const malformed = await app.ipc.dispatch({
      protocolVersion: 1,
      requestId: "task-preview-malformed",
      correlationId: "task-preview-malformed-correlation",
      method: "task.preview",
      payload: { rootPath: "/tmp/project", goal: "Review", constraints: [], targetedPaths: ["../secret"] },
    } as const);
    assert.equal(malformed.ok, false);
    if (!malformed.ok) assert.equal(malformed.error.code, "INVALID_REQUEST");
  } finally {
    app.close();
  }
});

test("typed IPC captures and searches review-only memory without provider or approval", async () => {
  const app = createEmbeddedApplication();
  try {
    const captured = await app.ipc.dispatch({ protocolVersion: 1, requestId: "memory-capture-1", correlationId: "memory-ipc", method: "brain.memory.capture", payload: { kind: "learning", title: "Offline learning", content: "providerAccess=never and local search only", tags: ["offline", "review"], providerAccess: "never", visibility: "private", retention: "session" } } as const) as IpcResponse<MemoryEntry>;
    assert.equal(captured.ok, true);
    if (!captured.ok) return;
    assert.equal(captured.result.state, "review_required");
    assert.equal(captured.result.providerAccess, "never");
    assert.match(captured.result.content, /providerAccess=never/);
    const searched = await app.ipc.dispatch({ protocolVersion: 1, requestId: "memory-search-1", correlationId: "memory-ipc", method: "brain.memory.searchLocal", payload: { query: "local search", limit: 8 } } as const) as IpcResponse<readonly MemoryEntry[]>;
    assert.equal(searched.ok, true);
    if (searched.ok) assert.equal(searched.result[0]?.entryId, captured.result.entryId);
    const listed = await app.ipc.dispatch({ protocolVersion: 1, requestId: "memory-list-1", correlationId: "memory-ipc", method: "brain.memory.list", payload: { limit: 8 } } as const) as IpcResponse<readonly MemoryEntry[]>;
    assert.equal(listed.ok, true);
    if (listed.ok) assert.equal(listed.result.length, 1);
    const malformed = await app.ipc.dispatch({ protocolVersion: 1, requestId: "memory-invalid-1", correlationId: "memory-ipc", method: "brain.memory.capture", payload: { kind: "note", title: "Bad", content: "bad", providerAccess: "send_now", embed: true } } as const);
    assert.equal(malformed.ok, false);
    if (!malformed.ok) assert.equal(malformed.error.code, "INVALID_REQUEST");
    assert.equal(app.humanGate.listPending(8).length, 0);
  } finally {
    app.close();
  }
});

test("typed IPC reviews memory explicitly and keeps confirmed entries local-only", async () => {
  const app = createEmbeddedApplication();
  try {
    const captured = await app.ipc.dispatch({ protocolVersion: 1, requestId: "memory-review-capture", correlationId: "memory-review-ipc", method: "brain.memory.capture", payload: { kind: "note", title: "Reviewable note", content: "This needs explicit human confirmation.", providerAccess: "never", visibility: "private", retention: "session" } } as const) as IpcResponse<MemoryEntry>;
    assert.equal(captured.ok, true);
    if (!captured.ok) return;
    const queue = await app.ipc.dispatch({ protocolVersion: 1, requestId: "memory-review-queue", correlationId: "memory-review-ipc", method: "brain.memory.listForReview", payload: { limit: 8 } } as const) as IpcResponse<readonly MemoryEntry[]>;
    assert.equal(queue.ok, true);
    if (queue.ok) assert.equal(queue.result.some((entry) => entry.entryId === captured.result.entryId), true);
    const confirmed = await app.ipc.dispatch({ protocolVersion: 1, requestId: "memory-review-confirm", correlationId: "memory-review-ipc", method: "brain.memory.review", payload: { entryId: captured.result.entryId, decision: "confirm", reason: "Confirmed locally by the user." } } as const) as IpcResponse<MemoryEntry>;
    assert.equal(confirmed.ok, true);
    if (confirmed.ok) {
      assert.equal(confirmed.result.state, "confirmed");
      assert.equal(confirmed.result.providerAccess, "never");
      assert.ok(confirmed.result.warnings.includes("user_confirmed_not_externally_verified"));
    }
    const after = await app.ipc.dispatch({ protocolVersion: 1, requestId: "memory-review-after", correlationId: "memory-review-ipc", method: "brain.memory.listForReview", payload: { limit: 8 } } as const) as IpcResponse<readonly MemoryEntry[]>;
    assert.equal(after.ok, true);
    if (after.ok) assert.equal(after.result.some((entry) => entry.entryId === captured.result.entryId), false);
    const malformed = await app.ipc.dispatch({ protocolVersion: 1, requestId: "memory-review-invalid", correlationId: "memory-review-ipc", method: "brain.memory.review", payload: { entryId: captured.result.entryId, decision: "confirm", reason: "valid", send: true } } as const);
    assert.equal(malformed.ok, false);
    if (!malformed.ok) assert.equal(malformed.error.code, "INVALID_REQUEST");
    assert.equal(app.humanGate.listPending(8).length, 0);
  } finally {
    app.close();
  }
});

test("typed IPC exposes the bounded agent catalog without execution or approval", async () => {
  const app = createEmbeddedApplication();
  try {
    const listed = await app.ipc.dispatch({ protocolVersion: 1, requestId: "agent-catalog-list", correlationId: "agent-catalog", method: "agent.catalog.list", payload: { limit: 64 } } as const);
    assert.equal(listed.ok, true);
    if (listed.ok) {
      assert.equal(listed.result.length, 46);
      assert.equal(listed.result.find((definition) => definition.agentId === "api-architect")?.executionStatus, "bounded_capability");
    }
    const definition = await app.ipc.dispatch({ protocolVersion: 1, requestId: "agent-definition-get", correlationId: "agent-catalog", method: "agent.definition.get", payload: { agentId: "security" } } as const);
    assert.equal(definition.ok, true);
    if (definition.ok) {
      assert.equal(definition.result?.agentId, "security");
      assert.equal(definition.result?.memoryRequirements.providerAccess, "never");
      assert.equal(definition.result?.humanApprovalRequirements.includes("github.push"), true);
    }
    const malformed = await app.ipc.dispatch({ protocolVersion: 1, requestId: "agent-catalog-invalid", correlationId: "agent-catalog", method: "agent.catalog.list", payload: { limit: 64, send: true } } as const);
    assert.equal(malformed.ok, false);
    if (!malformed.ok) assert.equal(malformed.error.code, "INVALID_REQUEST");
    const unsafe = await app.ipc.dispatch({ protocolVersion: 1, requestId: "agent-definition-unsafe", correlationId: "agent-catalog", method: "agent.definition.get", payload: { agentId: "../secret" } } as const);
    assert.equal(unsafe.ok, false);
    if (!unsafe.ok) assert.equal(unsafe.error.code, "INVALID_REQUEST");
    assert.equal(app.humanGate.listPending(8).length, 0);
  } finally {
    app.close();
  }
});

test("typed IPC exposes bounded report documents with provenance and explicit review", async () => {
  const app = createEmbeddedApplication();
  try {
    const source = await app.ipc.dispatch({ protocolVersion: 1, requestId: "report-source", correlationId: "report-ipc", method: "production.source.register", payload: { kind: "workspace_document", locator: "workspace://report/source", bytes: 64, sha256: "d".repeat(64), verificationState: "content_validated" } } as const);
    assert.equal(source.ok, true);
    if (!source.ok) return;
    const citation = await app.ipc.dispatch({ protocolVersion: 1, requestId: "report-citation", correlationId: "report-ipc", method: "production.citation.add", payload: { sourceId: source.result.sourceId, label: "Report source", verificationState: "content_validated" } } as const);
    assert.equal(citation.ok, true);
    if (!citation.ok) return;
    const plan = await app.ipc.dispatch({ protocolVersion: 1, requestId: "report-plan", correlationId: "report-ipc", method: "production.plan.create", payload: { brief: "Report plan" } } as const);
    assert.equal(plan.ok, true);
    if (!plan.ok) return;
    const section = await app.ipc.dispatch({ protocolVersion: 1, requestId: "report-section", correlationId: "report-ipc", method: "production.plan.section.add", payload: { planId: plan.result.planId, title: "Findings" } } as const);
    assert.equal(section.ok, true);
    if (!section.ok) return;
    const claim = await app.ipc.dispatch({ protocolVersion: 1, requestId: "report-claim", correlationId: "report-ipc", method: "production.plan.claim.add", payload: { planId: plan.result.planId, sectionId: section.result.sections[0]!.sectionId, text: "The report has traceable evidence." } } as const);
    assert.equal(claim.ok, true);
    if (!claim.ok) return;
    const attached = await app.ipc.dispatch({ protocolVersion: 1, requestId: "report-attach", correlationId: "report-ipc", method: "production.plan.citation.attach", payload: { planId: plan.result.planId, claimId: claim.result.claims[0]!.claimId, citationId: citation.result.citationId } } as const);
    assert.equal(attached.ok, true);
    const report = await app.ipc.dispatch({ protocolVersion: 1, requestId: "report-create", correlationId: "report-ipc", method: "production.report.create", payload: { kind: "technical_analysis", title: "Traceable report", scope: "Production Studio", contentPlanId: plan.result.planId } } as const);
    assert.equal(report.ok, true);
    if (!report.ok) return;
    assert.equal(report.result.reviewState, "review_required");
    assert.equal(report.result.claims[0]?.verificationState, "supported");
    assert.deepEqual(report.result.sourceRefs, [source.result.sourceId]);
    const fetched = await app.ipc.dispatch({ protocolVersion: 1, requestId: "report-get", correlationId: "report-ipc", method: "production.report.get", payload: { reportId: report.result.reportId } } as const);
    assert.equal(fetched.ok, true);
    if (fetched.ok) assert.equal(fetched.result?.reportId, report.result.reportId);
    const listed = await app.ipc.dispatch({ protocolVersion: 1, requestId: "report-list", correlationId: "report-ipc", method: "production.report.list", payload: { limit: 8 } } as const);
    assert.equal(listed.ok, true);
    if (listed.ok) assert.equal(listed.result.length, 1);
    const approved = await app.ipc.dispatch({ protocolVersion: 1, requestId: "report-review", correlationId: "report-ipc", method: "production.report.review", payload: { reportId: report.result.reportId, decision: "approve", reason: "Approved locally after evidence review." } } as const);
    assert.equal(approved.ok, true);
    if (approved.ok) {
      assert.equal(approved.result.reviewState, "approved");
      assert.equal(approved.result.warnings.includes("user_approved_not_externally_verified"), true);
    }
    const malformed = await app.ipc.dispatch({ protocolVersion: 1, requestId: "report-invalid", correlationId: "report-ipc", method: "production.report.list", payload: { limit: 8, send: true } } as const);
    assert.equal(malformed.ok, false);
    if (!malformed.ok) assert.equal(malformed.error.code, "INVALID_REQUEST");
    assert.equal(app.humanGate.listPending(8).length, 0);
  } finally {
    app.close();
  }
});

test("typed IPC exposes Arabic-first application settings with bounded updates", async () => {
  const app = createEmbeddedApplication();
  try {
    const defaults = await app.ipc.dispatch({ protocolVersion: 1, requestId: "settings-get-default", correlationId: "settings-ipc", method: "settings.get", payload: {} } as const);
    assert.equal(defaults.ok, true);
    if (defaults.ok) {
      assert.equal(defaults.result.locale, "ar");
      assert.equal(defaults.result.direction, "rtl");
      assert.equal(defaults.result.theme, "dark");
      assert.equal(defaults.result.fontScale, 1);
    }
    const updated = await app.ipc.dispatch({ protocolVersion: 1, requestId: "settings-update-en", correlationId: "settings-ipc", method: "settings.update", payload: { locale: "en", theme: "light", fontScale: 1.25, density: "compact", reduceMotion: true } } as const);
    assert.equal(updated.ok, true);
    if (updated.ok) {
      assert.equal(updated.result.locale, "en");
      assert.equal(updated.result.direction, "ltr");
      assert.equal(updated.result.theme, "light");
      assert.equal(updated.result.fontScale, 1.25);
      assert.equal(updated.result.density, "compact");
      assert.equal(updated.result.reduceMotion, true);
    }
    const malformed = await app.ipc.dispatch({ protocolVersion: 1, requestId: "settings-invalid", correlationId: "settings-ipc", method: "settings.update", payload: { locale: "ar", unknown: true } } as const);
    assert.equal(malformed.ok, false);
    if (!malformed.ok) assert.equal(malformed.error.code, "INVALID_REQUEST");
    const retained = await app.ipc.dispatch({ protocolVersion: 1, requestId: "settings-get-retained", correlationId: "settings-ipc", method: "settings.get", payload: {} } as const);
    assert.equal(retained.ok, true);
    if (retained.ok) assert.equal(retained.result.locale, "en");
    assert.equal(app.humanGate.listPending(8).length, 0);
  } finally {
    app.close();
  }
});

test("typed IPC exposes render policy preview without starting a renderer", async () => {
  const app = createEmbeddedApplication();
  try {
    const missing = await app.ipc.dispatch({ protocolVersion: 1, requestId: "render-policy-missing", correlationId: "render-policy", method: "production.render.policy.preview", payload: { artifactId: "missing", format: "pdf" } } as const) as IpcResponse<RenderPolicyPreview>;
    assert.equal(missing.ok, true);
    if (missing.ok) {
      assert.equal(missing.result.decision, "blocked");
      assert.equal(missing.result.executionStarted, false);
      assert.equal(missing.result.adapter, "none");
    }
    const malformed = await app.ipc.dispatch({ protocolVersion: 1, requestId: "render-policy-invalid", correlationId: "render-policy", method: "production.render.policy.preview", payload: { artifactId: "missing", format: "pdf", relativeDestination: "/tmp/output.pdf" } } as const);
    assert.equal(malformed.ok, false);
    if (!malformed.ok) assert.equal(malformed.error.code, "INVALID_REQUEST");
    assert.equal(app.humanGate.listPending(8).length, 0);
  } finally {
    app.close();
  }
});

test("typed IPC assembles a review-only artifact manifest without render or approval", async () => {
  const app = createEmbeddedApplication();
  try {
    const source = app.sourceRegistry.registerSource({ kind: "user_url", locator: "https://example.test/manifest", bytes: 256, sha256: "d".repeat(64), verificationState: "content_validated" });
    const citation = app.sourceRegistry.addCitation({ sourceId: source.sourceId, label: "Manifest evidence", span: { start: 0, end: 10 }, verificationState: "content_validated" });
    const plan = app.contentPlan.createPlan({ brief: "Assemble a report" });
    const sectioned = app.contentPlan.addSection({ planId: plan.planId, title: "Evidence" });
    const claim = app.contentPlan.addClaim({ planId: plan.planId, sectionId: sectioned.sections[0]!.sectionId, text: "Evidence can be reviewed." });
    const cited = app.contentPlan.attachCitation({ planId: plan.planId, claimId: claim.claims[0]!.claimId, citationId: citation.citationId });
    const asset = app.assetCatalog.registerAsset({ kind: "image", title: "Manifest chart", locator: "studio://assets/manifest.png", sha256: "e".repeat(64), bytes: 128, license: { name: "Internal", state: "verified", warnings: [] }, sourceIds: [source.sourceId] });
    const brief = app.assetCatalog.createBrief({ title: "Manifest visual brief", intent: "Review chart" });
    app.assetCatalog.attachAsset({ briefId: brief.briefId, assetId: asset.assetId });
    const draft = await app.ipc.dispatch({ protocolVersion: 1, requestId: "artifact-draft-1", correlationId: "artifact-review", method: "production.artifact.draft.create", payload: { kind: "document", title: "Reviewable report", contentPlanId: cited.planId, briefId: brief.briefId } } as const) as IpcResponse<ArtifactDraft>;
    assert.equal(draft.ok, true);
    if (!draft.ok) return;
    assert.equal(draft.result.reviewState, "ready_for_render");
    assert.deepEqual(draft.result.manifest.claims, [claim.claims[0]!.claimId]);
    assert.deepEqual(draft.result.manifest.assets, [asset.assetId]);
    assert.deepEqual(draft.result.manifest.sources, [source.sourceId]);
    assert.deepEqual(draft.result.manifest.tools, []);
    const fetched = await app.ipc.dispatch({ protocolVersion: 1, requestId: "artifact-draft-get-1", correlationId: "artifact-review", method: "production.artifact.draft.get", payload: { artifactId: draft.result.artifactId } } as const) as IpcResponse<ArtifactDraft | undefined>;
    assert.equal(fetched.ok, true);
    if (fetched.ok) assert.equal(fetched.result?.artifactId, draft.result.artifactId);
    const malformed = await app.ipc.dispatch({ protocolVersion: 1, requestId: "artifact-draft-invalid", correlationId: "artifact-review", method: "production.artifact.draft.create", payload: { kind: "document", title: "Invalid", contentPlanId: cited.planId, claimIds: [claim.claims[0]!.claimId, claim.claims[0]!.claimId] } } as const);
    assert.equal(malformed.ok, false);
    if (!malformed.ok) assert.equal(malformed.error.code, "INVALID_REQUEST");
    assert.equal(app.humanGate.listPending(8).length, 0);
  } finally {
    app.close();
  }
});
