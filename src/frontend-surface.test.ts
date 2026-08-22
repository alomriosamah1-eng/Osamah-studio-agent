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
  'timeline', 'diffPreview', 'rightStatus', 'inspectorStatus', 'footerText',
];

test('unified frontend exposes all product sections and control surfaces', async () => {
  const html = await readFile(htmlPath, 'utf8');
  for (const id of requiredIds) assert.match(html, new RegExp(`id=["']${id}["']`), `missing frontend id: ${id}`);
  for (const view of ['development', 'studio', 'brain', 'settings']) {
    assert.match(html, new RegExp(`data-app-view=["']${view}["']`), `missing app view: ${view}`);
    assert.match(html, new RegExp(`data-view=["']${view}["']`), `missing navigation view: ${view}`);
  }
  assert.match(html, /<html lang="ar" dir="rtl">/);
  assert.match(html, /data-control-section="general"/);
  assert.match(html, /data-control-section="accounts"/);
  assert.match(html, /data-control-section="storage"/);
  assert.match(html, /data-control-section="selfDevelopment"/);
  assert.match(html, /Global|Workspace|Production Studio|Second Brain/);
});

test('frontend keeps upstream projects behind internal UI boundary', async () => {
  const [html, workspace] = await Promise.all([readFile(htmlPath, 'utf8'), readFile(workspacePath, 'utf8')]);
  const source = `${html}\n${workspace}`;
  assert.doesNotMatch(source, /from\s+["'][^"']*(?:opencode|hermes|deepseek|monaco|xterm)[^"']*["']/iu);
  assert.doesNotMatch(source, /(?:opencode|hermes|deepseek|monaco|xterm)[^\n]*(?:route|component|iframe|webview)/iu);
  assert.match(source, /واجهة Osamah الموحدة/u);
});
