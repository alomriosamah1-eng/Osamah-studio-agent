import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const projectRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const htmlPath = join(projectRoot, 'prototypes', 'studio', 'index.html');
const workspacePath = join(projectRoot, 'prototypes', 'studio', 'workspace.js');

const requiredIds = [
  'root', 'openProject', 'approve', 'projectState', 'projectTree', 'editorBuffer', 'tabName', 'path',
  'editorMeta', 'editorState', 'proposeDiff', 'previewTree', 'previewSub', 'deviceSelect', 'phone', 'rotate',
  'theme', 'deviceKv', 'log', 'reviewTask', 'taskReviewStatus', 'taskContextFiles', 'taskContextManifests',
  'taskTargetCount', 'taskContextState', 'taskTargetList', 'taskPlanList', 'taskCritiqueList', 'inspectTerminal',
  'terminalExecutable', 'terminalArgs', 'terminalPolicyResult', 'refreshGit', 'gitRepoState', 'gitBranch',
  'gitCounts', 'gitChanges', 'gitDiffPreview', 'registerCurrentSource', 'refreshSources', 'sourceRegistryStatus',
  'sourceList', 'citationList', 'contentBrief', 'createContentPlan', 'contentPlanStatus', 'contentPlanSections',
  'contentPlanClaims', 'contentPlanSupported', 'contentPlanUnresolved', 'contentPlanConflicted', 'contentPlanClaimList',
  'registerDemoAsset', 'refreshAssets', 'assetCatalogStatus', 'assetList', 'briefTitle', 'briefIntent',
  'createCreativeBrief', 'creativeBriefStatus', 'briefAssetCount', 'briefWarningCount', 'briefAssetList',
  'artifactTitle', 'createArtifactDraft', 'artifactStatus', 'artifactReviewState', 'artifactClaimCount',
  'artifactAssetCount', 'artifactSourceCount', 'artifactToolCount', 'artifactManifestList', 'reportTitle',
  'reportScope', 'createReportDocument', 'refreshReportDocuments', 'reportReviewReason', 'approveReportDocument',
  'reportStatus', 'reportReviewState', 'reportClaimCount', 'reportEvidenceCount', 'reportSourceCount',
  'reportRedactionState', 'reportClaimList', 'renderFormat', 'previewRenderPolicy', 'renderPolicyStatus',
  'renderDecision', 'renderAdapter', 'renderMemoryBudget', 'renderExecutionStarted', 'renderChecksList',
  'memoryTitle', 'memoryKind', 'memoryContent', 'memoryTags', 'captureMemoryEntry', 'memorySearch',
  'searchMemoryEntries', 'memoryReviewReason', 'listMemoryReview', 'memoryStatus', 'memoryList', 'memoryReviewList',
  'memoryCandidateTitle', 'memoryCandidateKind', 'memoryCandidateContent', 'memoryCandidateSourceIds',
  'memoryCandidateScope', 'createMemoryCandidate', 'listMemoryCandidates', 'memoryConsolidationStatus', 'memoryCandidateList',
  'controlCenter', 'appLocale', 'appTheme', 'appFontScale', 'appDensity', 'appReduceMotion', 'settingsStatus',
  'accountProvider', 'accountLabel', 'accountOwner', 'accountScopes', 'accountResourceScope', 'registerExternalAccount',
  'externalAccountStatus', 'externalAccountList', 'storageSettingsStatus', 'storageSettingsList', 'selfDevelopmentKind',
  'selfDevelopmentTitle', 'selfDevelopmentContent', 'selfDevelopmentScope', 'selfDevelopmentSource',
  'createSelfDevelopmentCandidate', 'selfDevelopmentStatus', 'selfDevelopmentList', 'refreshAgentCatalog',
  'agentCatalogPanel', 'agentCatalogStatus', 'agentCatalogList', 'providerPanel', 'providerEmpty', 'providerList',
  'agentAdminStatus', 'agentAdminList', 'privacyDataPolicy', 'secretSafetyPanel', 'privacyHumanGate', 'hostPermissionPanel',
  'privacySecurityStatus', 'securityEventsList', 'performanceProfile', 'memoryBudget', 'concurrencyLimit', 'cacheState',
  'runDiagnostics', 'performanceDiagnosticsStatus', 'diagnosticEventsList', 'timeline', 'diffPreview', 'rightStatus', 'inspectorStatus', 'footerText', 'currentSection', 'bodyShell', 'inspectorPanel', 'toggleInspector', 'closeInspector', 'openPreview', 'previewPanel', 'developmentWorkspace', 'globalAgentBar', 'agentInstruction', 'agentProfile', 'agentIntent', 'agentScope', 'agentConstraints', 'previewAgentCommand', 'clearAgentCommand', 'agentCommandStatus', 'agentCommandPreview',
];

test('unified frontend exposes all product sections and control surfaces', async () => {
  const html = await readFile(htmlPath, 'utf8');
  for (const id of requiredIds) {
    const matches = html.match(new RegExp(`id=["']${id}["']`, 'g')) || [];
    assert.equal(matches.length, 1, `frontend id must exist exactly once: ${id}`);
  }
  assert.equal((html.match(/class="[^"]*(?:^|\s)agent-command(?=\s|")[^"]*"/g) || []).length, 1, 'one unified agent command surface is required');
  for (const view of ['home', 'development', 'studio', 'brain', 'settings']) {
    assert.match(html, new RegExp(`data-app-view=["']${view}["']`), `missing app view: ${view}`);
    assert.match(html, new RegExp(`data-view=["']${view}["']`), `missing navigation view: ${view}`);
  }
  assert.match(html, /<html lang="ar" dir="rtl">/);
  assert.match(html, /data-control-section="general"/);
  assert.match(html, /data-control-section="accounts"/);
  assert.match(html, /data-control-section="storage"/);
  assert.match(html, /data-control-section="selfDevelopment"/);
  assert.match(html, /data-control-section="agents"/);
  assert.match(html, /data-control-section="privacySecurity"/);
  assert.match(html, /data-control-section="performanceDiagnostics"/);
  assert.match(html, /data-control-section="editorBoundary"/);
  assert.match(html, /Global|Workspace|Production Studio|Second Brain/);
  assert.match(html, /class="home-launcher" data-view="development"/);
  assert.match(html, /class="home-launcher" data-view="studio"/);
  assert.match(html, /class="home-launcher" data-view="brain"/);
  assert.match(html, /data-agent-action="send"/);
  assert.match(html, /data-agent-action="activity"/);
  assert.match(html, /data-agent-action="expand"/);
  const mainStart = html.indexOf('<main class="main"');
  const mainEnd = html.indexOf('</main>');
  assert.ok(mainStart >= 0 && mainEnd > mainStart, 'main must be present and closed after its content');
  for (const view of ['home', 'development', 'studio', 'brain', 'settings']) {
    const viewStart = html.indexOf(`data-app-view="${view}"`);
    assert.ok(viewStart > mainStart && viewStart < mainEnd, `${view} must remain inside main`);
  }
  assert.match(html, /id="previewPanel"[^>]*hidden/);
  assert.match(html, /id="inspectorPanel"/);
  assert.match(html, /\.body-shell\.inspector-open \.inspector/);
  assert.match(html, /id="globalAgentBar"/);
  assert.match(html, /data-workspace-section="development:editor"/);
  assert.match(html, /data-workspace-section="studio:review"/);
  assert.match(html, /data-workspace-section="studio:editors"/);
  assert.match(html, /data-workspace-section="brain:consolidation"/);
  assert.match(html, /data-workspace-section="brain:modules"/);
  assert.match(html, /data-studio-panel="editors"/);
  assert.match(html, /data-brain-panel="modules"/);
  assert.match(html, /data-editor-kind="document"/);
  assert.match(html, /data-editor-kind="presentation"/);
  assert.match(html, /data-editor-kind="image"/);
  assert.match(html, /data-editor-kind="video"/);
});

test('frontend keeps upstream projects behind internal UI boundary', async () => {
  const [html, workspace] = await Promise.all([readFile(htmlPath, 'utf8'), readFile(workspacePath, 'utf8')]);
  const source = `${html}\n${workspace}`;
  assert.doesNotMatch(source, /from\s+["'][^"']*(?:opencode|hermes|deepseek|monaco|xterm)[^"']*["']/iu);
  assert.doesNotMatch(source, /(?:opencode|hermes|deepseek|monaco|xterm)[^\n]*(?:route|component|iframe|webview)/iu);
  assert.match(source, /واجهة Osamah الموحدة/u);
  assert.match(workspace, /setPreviewOpen\(\$\('previewPanel'\)\.hidden\)/);
  assert.match(workspace, /moveAgentCommandToGlobalBar/);
  assert.match(workspace, /activateView\('home'\)/);
  assert.match(workspace, /nextView !== 'development'\) setPreviewOpen\(false\)/);
  assert.match(workspace, /selectWorkspaceSection/);
  assert.match(workspace, /diagnostics.completed lightweight/);
  assert.match(workspace, /selectEditorKind/);
});
