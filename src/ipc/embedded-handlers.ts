import type { AgentWorkCycleService } from "../application/agent-work-cycle.js";
import type { HumanGatePort } from "../application/human-gate.js";
import type { LocalProviderConfig, LocalProviderId, ProviderDoctorReport } from "../application/provider-policy.js";
import type { ProviderListItem } from "./contracts.js";
import type { FilesystemProjectContextIndex } from "../application/project-context.js";
import type { ProjectExplorerPort, WorkspaceFileReaderPort } from "../application/project-explorer.js";
import type { EditorDocumentPort } from "../application/editor-document.js";
import type { TerminalPolicyPort } from "../application/terminal-policy.js";
import type { GitReadOnlyPort } from "../application/git-read-only.js";
import type { ProjectPreviewService } from "../application/project-preview-service.js";
import type { AgentTaskPreviewService } from "../application/agent-task-preview.js";
import type { SourceRegistryPort } from "../application/source-registry.js";
import type { ContentPlanPort } from "../application/content-plan.js";
import type { AssetCatalogPort, CreativeBriefPort } from "../application/asset-catalog.js";
import type { ArtifactAssemblyPort } from "../application/artifact-assembly.js";
import type { RenderPolicyPort } from "../application/render-policy.js";
import type { MemoryCapturePort, MemoryReviewPort } from "../application/memory-capture.js";
import type { AgentCatalogPort } from "../application/agent-catalog.js";
import type { ReportDocumentPort } from "../application/report-document.js";
import type { InMemoryEmbeddedSimulatorController } from "../mobile/embedded-controller.js";
import type { InMemoryIpcTransport } from "./in-memory-transport.js";

export interface AgentIpcDependencies {
  readonly context: Pick<FilesystemProjectContextIndex, "build">;
  readonly taskPreview: Pick<AgentTaskPreviewService, "preview">;
  readonly sourceRegistry: Pick<SourceRegistryPort, "registerSource" | "listSources" | "addCitation" | "getCitation" | "listCitations" | "listProvenanceLinks">;
  readonly contentPlan: Pick<ContentPlanPort, "createPlan" | "getPlan" | "addSection" | "addClaim" | "attachCitation">;
  readonly assetCatalog: Pick<AssetCatalogPort, "registerAsset" | "listAssets">;
  readonly creativeBrief: Pick<CreativeBriefPort, "createBrief" | "getBrief" | "attachAsset">;
  readonly artifactAssembly: Pick<ArtifactAssemblyPort, "createDraft" | "getDraft">;
  readonly renderPolicy: Pick<RenderPolicyPort, "preview">;
  readonly memoryCapture: Pick<MemoryCapturePort, "capture" | "get" | "list" | "searchLocal"> & Pick<MemoryReviewPort, "review" | "listForReview">;
  readonly agentCatalog: Pick<AgentCatalogPort, "list" | "get">;
  readonly reportDocument: Pick<ReportDocumentPort, "create" | "get" | "list" | "review">;
  readonly explorer: Pick<ProjectExplorerPort, "list">;
  readonly fileReader: Pick<WorkspaceFileReaderPort, "readText">;
  readonly editorDocuments: Pick<EditorDocumentPort, "open" | "propose">;
  readonly terminalPolicy: Pick<TerminalPolicyPort, "inspect">;
  readonly gitReadOnly: Pick<GitReadOnlyPort, "status" | "diff">;
  readonly workCycle: Pick<AgentWorkCycleService, "start" | "inspect" | "cancel">;
  readonly humanGate: Pick<HumanGatePort, "listPending" | "decide">;
  readonly providers: {
    readonly list: () => readonly ProviderListItem[];
    readonly configure: (config: LocalProviderConfig) => LocalProviderConfig;
    readonly doctor: (providerId?: LocalProviderId) => Promise<readonly ProviderDoctorReport[]>;
  };
}

export const registerEmbeddedSimulatorHandlers = (
  transport: InMemoryIpcTransport,
  controller: InMemoryEmbeddedSimulatorController,
  projectPreviewService: ProjectPreviewService,
  agentDependencies?: AgentIpcDependencies,
): void => {
  transport.register("health.get", async () => ({ status: "ok", version: "0.4.0-presentation-renderer" }));
  transport.register("device.get", async (request) => {
    const profile = controller.getProfile(request.payload.deviceProfileId);
    if (!profile) throw new Error(`Device profile ${request.payload.deviceProfileId} was not found.`);
    return profile;
  });
  transport.register("preview.start", (request) => controller.start(request.payload));
  transport.register("preview.openProject", async (request) => {
    const bundle = await projectPreviewService.build({
      projectId: request.payload.projectId,
      rootPath: request.payload.rootPath,
      entry: request.payload.entry,
    });
    const session = await controller.start({
      deviceProfileId: request.payload.deviceProfileId,
      mode: request.payload.mode,
      bundle,
    });
    return {
      session,
      bundle: {
        projectId: bundle.projectId,
        entry: bundle.entry,
        sourceHash: bundle.sourceHash,
        moduleCount: bundle.modules.length,
        warningCount: bundle.warnings.length,
      },
    };
  });
  transport.register("preview.input", (request) => controller.sendInput(request.payload.sessionId, request.payload.input));
  transport.register("preview.refresh", (request) => controller.refresh(request.payload.sessionId, request.payload.kind, request.payload.bundle));
  transport.register("preview.capture", (request) => controller.capture(request.payload.sessionId));
  transport.register("preview.inspect", async (request) => controller.inspect(request.payload.sessionId));
  transport.register("preview.stop", async (request) => {
    await controller.stop(request.payload.sessionId);
    return { stopped: true as const };
  });
  if (agentDependencies) {
    transport.register("context.index", (request) => agentDependencies.context.build(request.payload.rootPath));
    transport.register("task.preview", (request) => agentDependencies.taskPreview.preview(request.payload));
    transport.register("production.source.register", async (request) => agentDependencies.sourceRegistry.registerSource(request.payload));
    transport.register("production.source.list", async (request) => agentDependencies.sourceRegistry.listSources(request.payload.limit));
    transport.register("production.citation.add", async (request) => agentDependencies.sourceRegistry.addCitation(request.payload));
    transport.register("production.citation.list", async (request) => agentDependencies.sourceRegistry.listCitations(request.payload.sourceId, request.payload.limit));
    transport.register("production.provenance.list", async (request) => agentDependencies.sourceRegistry.listProvenanceLinks(request.payload.entityId, request.payload.limit));
    transport.register("production.plan.create", async (request) => agentDependencies.contentPlan.createPlan(request.payload));
    transport.register("production.plan.get", async (request) => agentDependencies.contentPlan.getPlan(request.payload.planId));
    transport.register("production.plan.section.add", async (request) => agentDependencies.contentPlan.addSection(request.payload));
    transport.register("production.plan.claim.add", async (request) => agentDependencies.contentPlan.addClaim(request.payload));
    transport.register("production.plan.citation.attach", async (request) => agentDependencies.contentPlan.attachCitation(request.payload));
    transport.register("production.asset.register", async (request) => agentDependencies.assetCatalog.registerAsset(request.payload));
    transport.register("production.asset.list", async (request) => agentDependencies.assetCatalog.listAssets(request.payload.limit));
    transport.register("production.brief.create", async (request) => agentDependencies.creativeBrief.createBrief(request.payload));
    transport.register("production.brief.get", async (request) => agentDependencies.creativeBrief.getBrief(request.payload.briefId));
    transport.register("production.brief.asset.attach", async (request) => agentDependencies.creativeBrief.attachAsset(request.payload));
    transport.register("production.artifact.draft.create", async (request) => agentDependencies.artifactAssembly.createDraft(request.payload));
    transport.register("production.artifact.draft.get", async (request) => agentDependencies.artifactAssembly.getDraft(request.payload.artifactId));
    transport.register("production.render.policy.preview", async (request) => agentDependencies.renderPolicy.preview(request.payload));
    transport.register("brain.memory.capture", async (request) => agentDependencies.memoryCapture.capture(request.payload));
    transport.register("brain.memory.get", async (request) => agentDependencies.memoryCapture.get(request.payload.entryId));
    transport.register("brain.memory.list", async (request) => agentDependencies.memoryCapture.list(request.payload.limit));
    transport.register("brain.memory.searchLocal", async (request) => agentDependencies.memoryCapture.searchLocal(request.payload.query, request.payload.limit));
    transport.register("brain.memory.review", async (request) => agentDependencies.memoryCapture.review(request.payload));
    transport.register("brain.memory.listForReview", async (request) => agentDependencies.memoryCapture.listForReview(request.payload.limit));
    transport.register("agent.catalog.list", async (request) => agentDependencies.agentCatalog.list(request.payload.limit));
    transport.register("agent.definition.get", async (request) => agentDependencies.agentCatalog.get(request.payload.agentId));
    transport.register("production.report.create", async (request) => agentDependencies.reportDocument.create(request.payload));
    transport.register("production.report.get", async (request) => agentDependencies.reportDocument.get(request.payload.reportId));
    transport.register("production.report.list", async (request) => agentDependencies.reportDocument.list(request.payload.limit));
    transport.register("production.report.review", async (request) => agentDependencies.reportDocument.review(request.payload));
    transport.register("project.tree", (request) => agentDependencies.explorer.list(request.payload.rootPath));
    transport.register("file.openText", (request) => agentDependencies.fileReader.readText(request.payload.rootPath, request.payload.relativePath));
    transport.register("editor.open", (request) => agentDependencies.editorDocuments.open(request.payload.rootPath, request.payload.relativePath));
    transport.register("editor.propose", (request) => agentDependencies.editorDocuments.propose(request.payload.rootPath, request.payload.relativePath, request.payload.content, request.payload.expectedSha256));
    transport.register("terminal.inspect", (request) => Promise.resolve(agentDependencies.terminalPolicy.inspect(request.payload)));
    transport.register("git.status", (request) => agentDependencies.gitReadOnly.status(request.payload.rootPath));
    transport.register("git.diff", (request) => agentDependencies.gitReadOnly.diff(request.payload.rootPath, request.payload.relativePath));
    transport.register("workCycle.start", (request) => agentDependencies.workCycle.start(request.payload));
    transport.register("workCycle.inspect", (request) => Promise.resolve(agentDependencies.workCycle.inspect(request.payload.cycleId)));
    transport.register("workCycle.cancel", (request) => Promise.resolve(agentDependencies.workCycle.cancel(request.payload.cycleId)));
    transport.register("approval.listPending", (request) => Promise.resolve(agentDependencies.humanGate.listPending(request.payload.limit)));
    transport.register("approval.decide", (request) => Promise.resolve(agentDependencies.humanGate.decide(request.payload.approvalId, request.payload.decision)));
    transport.register("provider.list", async () => agentDependencies.providers.list());
    transport.register("provider.configure", async (request) => agentDependencies.providers.configure(request.payload));
    transport.register("provider.doctor", async (request) => agentDependencies.providers.doctor(request.payload.providerId));
  }
};
