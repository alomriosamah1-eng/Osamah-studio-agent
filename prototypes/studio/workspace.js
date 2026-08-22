(() => {
  const profiles = {
    pixel: { name: 'Pixel 9', platform: 'Android', os: '15', width: 1080, height: 2424, dpi: 420, top: 0, bottom: 0 },
    iphone: { name: 'iPhone 16', platform: 'iOS', os: '18', width: 393, height: 852, dpi: 3, top: 59, bottom: 34 },
    tablet: { name: 'Android Tablet', platform: 'Android', os: '15', width: 1600, height: 2560, dpi: 320, top: 0, bottom: 0 },
  };
  const codeByFile = {
    'index.tsx': ["import { View, Text } from 'react-native';", "import { DeviceStatus } from '../components/DeviceStatus';", '', 'export default function Home() {', '  return (', '    <View style={styles.screen}>', '      <Text style={styles.title}>Build with clarity.</Text>', '      <Text style={styles.body}>', '        Edit, refresh, inspect, and validate.', '      </Text>', '      <DeviceStatus mode="embedded" />', '    </View>', '  );', '}', '', 'const styles = StyleSheet.create({', '  screen: { flex: 1, padding: 24 },', '  title: { fontSize: 28, fontWeight: \'700\' },', '  body: { marginTop: 12, lineHeight: 20 },', '});'],
    'settings.tsx': ['export default function Settings() {', '  return <Text>Settings</Text>;', '}'],
    '_layout.tsx': ["import { Stack } from 'expo-router';", '', 'export default function Layout() {', '  return <Stack />;', '}'],
    'HomeCard.tsx': ['export function HomeCard() {', '  return <Card title="Preview session" />;', '}'],
    'DeviceStatus.tsx': ['export function DeviceStatus({ mode }) {', '  return <Text>{mode} / ready</Text>;', '}'],
  };

  let selected = profiles.pixel;
  let orientation = 'portrait';
  let dark = false;
  let currentFile = 'index.tsx';
  let currentRelativePath = 'app/index.tsx';
  let currentRoot = '';
  let loadedFileContent;
  let currentDocument;
  const $ = (id) => document.getElementById(id);

  const renderCode = () => {
    const source = loadedFileContent === undefined ? (codeByFile[currentFile] || ['// file preview unavailable']).join('\n') : loadedFileContent;
    const editor = $('editorBuffer');
    editor.value = source;
    $('path').textContent = currentRelativePath || `app/${currentFile}`;
    $('editorMeta').textContent = currentDocument?.sha256 ? `revision ${currentDocument.revision} · ${currentDocument.bytes} bytes` : 'fixture buffer · no mutation';
    $('editorState').textContent = currentDocument?.sha256 ? 'loaded · proposal only' : 'fixture / read-only host';
    $('tabName').replaceChildren(document.createTextNode(currentFile), Object.assign(document.createElement('small'), { textContent: currentDocument?.sha256 ? ' · loaded' : ' · fixture' }));
  };

  const renderDiff = (proposal) => {
    const container = $('diffPreview');
    container.replaceChildren();
    proposal.diff.forEach((line) => {
      const element = document.createElement('span');
      element.className = `diff-line ${line.kind}`;
      element.textContent = `${line.kind === 'add' ? '+' : line.kind === 'remove' ? '-' : ' '} ${line.text}`;
      container.append(element);
    });
    if (proposal.diffTruncated) {
      const warning = document.createElement('div');
      warning.className = 'diff-line remove';
      warning.textContent = '… diff output bounded; proposal is not shown as complete.';
      container.append(warning);
    }
  };

  const renderProjectTree = (treeResult) => {
    const container = $('projectTree');
    if (!container) return;
    container.replaceChildren();
    const renderNode = (node, depth) => {
      const button = document.createElement('button');
      button.className = node.kind === 'directory' ? 'folder' : 'file';
      button.style.paddingLeft = `${8 + depth * 16}px`;
      button.textContent = `${node.kind === 'directory' ? '▾' : '◻'} ${node.name}`;
      if (node.kind === 'file') {
        button.dataset.file = node.relativePath;
        button.classList.toggle('active', node.relativePath === currentRelativePath);
        button.onclick = () => { void openWorkspaceFile(node.relativePath); };
      }
      container.append(button);
      if (node.kind === 'directory') node.children.forEach((child) => renderNode(child, depth + 1));
    };
    treeResult.root.children?.forEach((node) => renderNode(node, 0));
    if (treeResult.truncated) {
      const warning = document.createElement('div');
      warning.className = 'hint';
      warning.textContent = treeResult.warnings[0] || 'Project tree is bounded.';
      container.append(warning);
    }
  };

  const renderFallbackProjectTree = () => renderProjectTree({
    root: {
      name: 'Project', relativePath: '', kind: 'directory', children: [
        { name: 'app', relativePath: 'app', kind: 'directory', children: [
          { name: 'index.tsx', relativePath: 'app/index.tsx', kind: 'file', extension: '.tsx' },
          { name: 'settings.tsx', relativePath: 'app/settings.tsx', kind: 'file', extension: '.tsx' },
          { name: '_layout.tsx', relativePath: 'app/_layout.tsx', kind: 'file', extension: '.tsx' },
        ] },
        { name: 'components', relativePath: 'components', kind: 'directory', children: [
          { name: 'HomeCard.tsx', relativePath: 'components/HomeCard.tsx', kind: 'file', extension: '.tsx' },
          { name: 'DeviceStatus.tsx', relativePath: 'components/DeviceStatus.tsx', kind: 'file', extension: '.tsx' },
        ] },
        { name: 'package.json', relativePath: 'package.json', kind: 'file', extension: '.json' },
      ],
    },
    fileCount: 6,
    truncated: false,
    warnings: [],
  });

  const openWorkspaceFile = async (relativePath) => {
    currentRelativePath = relativePath;
    currentFile = relativePath.split('/').at(-1) || relativePath;
    loadedFileContent = undefined;
    currentDocument = undefined;
    if (!currentRoot || typeof window.osamah?.dispatch !== 'function') {
      renderProjectTree({ root: { name: 'Project', relativePath: '', kind: 'directory', children: [] }, fileCount: 0, truncated: false, warnings: [] });
      renderFallbackProjectTree();
      renderCode();
      renderPreview();
      log(`file.opened ${relativePath} (fixture)`, 'ok');
      return;
    }
    const response = await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: nextRequest('editor-open'),
      correlationId: nextRequest('editor-open-correlation'),
      method: 'editor.open',
      payload: { rootPath: currentRoot, relativePath },
    });
    if (!response.ok) {
      log(`file.open_failed ${response.error.message}`, 'warn');
      renderCode();
      return;
    }
    if (response.result === undefined) {
      log(`file.open_unavailable ${relativePath}`, 'warn');
      renderCode();
      return;
    }
    currentDocument = response.result;
    loadedFileContent = response.result.content;
    renderCode();
    renderPreview();
    document.querySelectorAll('#projectTree .file').forEach((button) => button.classList.toggle('active', button.dataset.file === relativePath));
    $('projectState').textContent = `file loaded: ${relativePath}`;
    log(`file.opened ${relativePath} · ${response.result.bytes} bytes`, 'ok');
  };

  const loadProjectTree = async (rootPath) => {
    if (typeof window.osamah?.dispatch !== 'function') {
      renderFallbackProjectTree();
      return;
    }
    const response = await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: nextRequest('project-tree'),
      correlationId: nextRequest('project-tree-correlation'),
      method: 'project.tree',
      payload: { rootPath },
    });
    if (!response.ok) {
      log(`project.tree_failed ${response.error.message}`, 'warn');
      return;
    }
    currentRoot = rootPath;
    renderProjectTree(response.result);
    $('projectState').textContent = `project loaded: ${response.result.fileCount} files${response.result.truncated ? ' · bounded' : ''}`;
    const firstFile = response.result.root.children?.flatMap((node) => {
      const visit = (candidate) => candidate.kind === 'file' ? [candidate.relativePath] : candidate.children.flatMap(visit);
      return visit(node);
    })[0];
    if (firstFile) await openWorkspaceFile(firstFile);
    log(`project.tree_loaded ${response.result.fileCount} files`, 'ok');
  };

  const renderPreview = () => {
    const title = currentFile === 'settings.tsx' ? 'Settings' : 'Build with clarity.';
    const body = currentFile === 'settings.tsx'
      ? 'Settings is rendered through the same bounded preview tree.'
      : 'Edit the project on the left, run the preview here, inspect events on the right, and keep native validation explicit.';
    window.OsamahPreviewRenderer.renderPreviewTree({
      type: 'view',
      props: { role: 'screen', projectId: 'mobile-app' },
      children: [
        { type: 'text', text: title, props: { role: 'heading' } },
        { type: 'text', text: body, props: { role: 'paragraph' } },
        { type: 'card', text: 'Preview session', props: { status: 'ready' } },
        { type: 'status', text: 'embedded_web', props: { nativeFidelity: 'compatibility' } },
      ],
    }, $('previewTree'));
  };

  const renderProfile = () => {
    const profile = selected;
    $('previewSub').textContent = `${profile.name} · ${profile.platform} ${profile.os} · embedded_web`;
    $('phone').classList.toggle('landscape', orientation === 'landscape');
    $('root').classList.toggle('dark', dark);
    $('theme').textContent = dark ? 'Light' : 'Dark';
    $('pill').textContent = `${profile.platform.toLowerCase()} / embedded`;
    $('deviceKv').innerHTML = `<div class="kv"><span>Platform</span><span>${profile.platform}</span></div><div class="kv"><span>OS</span><span>${profile.os}</span></div><div class="kv"><span>Frame</span><span>${orientation === 'portrait' ? `${profile.width}×${profile.height}` : `${profile.height}×${profile.width}`}</span></div><div class="kv"><span>DPI</span><span>${profile.dpi}</span></div><div class="kv"><span>Safe area</span><span>${profile.top}/${profile.bottom}</span></div><div class="kv"><span>Mode</span><span>embedded_web</span></div>`;
    renderPreview();
  };

  const log = (message, kind = '') => {
    const line = document.createElement('div');
    line.textContent = `[event] ${message}`;
    line.className = kind;
    $('log').appendChild(line);
    $('log').scrollTop = $('log').scrollHeight;
    $('footerText').textContent = message;
  };

  let ipcSequence = 0;
  const approvalTickets = new Map();
  let approvalEventReceived = false;
  const nextRequest = (prefix) => {
    ipcSequence += 1;
    return `${prefix}-${Date.now()}-${ipcSequence}`;
  };
  const renderApprovals = () => {
    const pending = [...approvalTickets.values()].filter((ticket) => ticket.status === 'requested').slice(0, 8);
    const empty = $('approvalEmpty');
    const list = $('approvalList');
    empty.hidden = pending.length > 0;
    empty.textContent = pending.length ? '' : 'No pending approvals. Agent mutations remain approval-gated.';
    list.replaceChildren();
    pending.forEach((ticket) => {
      const card = document.createElement('div');
      card.className = 'approval-card';
      const title = document.createElement('strong');
      title.textContent = `${ticket.action.kind} · ${ticket.action.risk}`;
      const meta = document.createElement('div');
      meta.className = 'approval-meta';
      meta.textContent = `Approval ${ticket.approvalId} · ${ticket.action.actionId}`;
      const scope = document.createElement('div');
      scope.className = 'approval-scope';
      scope.textContent = ticket.action.scope;
      const actions = document.createElement('div');
      actions.className = 'approval-actions';
      const deny = document.createElement('button');
      deny.className = 'deny';
      deny.textContent = 'Deny';
      deny.onclick = () => { void decideApproval(ticket.approvalId, 'denied'); };
      const allow = document.createElement('button');
      allow.className = 'allow';
      allow.textContent = 'Approve';
      allow.onclick = () => { void decideApproval(ticket.approvalId, 'approved'); };
      actions.append(deny, allow);
      card.append(title, meta, scope, actions);
      list.append(card);
    });
  };
  const loadPendingApprovals = async () => {
    if (!window.osamah?.dispatch) {
      renderApprovals();
      return;
    }
    const response = await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: nextRequest('approval-list'),
      correlationId: nextRequest('approval-list-correlation'),
      method: 'approval.listPending',
      payload: { limit: 32 },
    });
    if (!response.ok) {
      log(`approval.list_failed ${response.error.message}`, 'warn');
      return;
    }
    approvalTickets.clear();
    response.result.forEach((ticket) => approvalTickets.set(ticket.approvalId, ticket));
    renderApprovals();
    $('rightStatus').textContent = response.result.length ? `${response.result.length} approval(s) pending` : 'No approvals pending';
  };
  const decideApproval = async (approvalId, decision) => {
    const response = await window.osamah?.dispatch?.({
      protocolVersion: 1,
      requestId: nextRequest('approval-decide'),
      correlationId: nextRequest('approval-decision-correlation'),
      method: 'approval.decide',
      payload: { approvalId, decision },
    });
    if (!response) {
      log('approval.decide_unavailable', 'warn');
      return;
    }
    if (!response.ok) {
      log(`approval.decision_failed ${response.error.message}`, 'warn');
      await loadPendingApprovals();
      return;
    }
    approvalTickets.set(response.result.approvalId, response.result);
    renderApprovals();
    $('rightStatus').textContent = `Approval ${decision}`;
    log(`ApprovalResolved: ${decision}`, decision === 'approved' ? 'ok' : 'warn');
  };
  const subscribeToApprovalEvents = () => {
    if (typeof window.osamah?.subscribe !== 'function') return;
    const unsubscribe = window.osamah.subscribe((event) => {
      if (event.type !== 'approval.changed') return;
      approvalEventReceived = true;
      approvalTickets.set(event.ticket.approvalId, event.ticket);
      renderApprovals();
      $('rightStatus').textContent = event.ticket.status === 'requested' ? 'Approval required' : `Approval ${event.ticket.status}`;
      log(`approval.changed ${event.ticket.approvalId} ${event.ticket.status}`, event.ticket.status === 'denied' ? 'warn' : 'ok');
    });
    window.addEventListener('beforeunload', unsubscribe, { once: true });
  };

  const providerConfigs = new Map();
  const renderProviders = (providers) => {
    const empty = $('providerEmpty');
    const list = $('providerList');
    if (!empty || !list) return;
    empty.hidden = providers.length > 0;
    empty.textContent = providers.length ? '' : 'No local providers registered. Registration is explicit and offline-first.';
    list.replaceChildren();
    providers.forEach((provider) => {
      const card = document.createElement('div');
      card.className = 'approval-card provider-card';
      card.dataset.providerId = provider.id;
      const title = document.createElement('strong');
      title.textContent = `${provider.label} · ${provider.offline ? 'offline-capable' : 'remote'}`;
      const meta = document.createElement('div');
      meta.className = 'approval-meta';
      meta.textContent = `${provider.id} · ${provider.configured ? (provider.enabled ? 'enabled' : 'disabled') : 'not configured'}`;
      const model = document.createElement('div');
      model.className = 'approval-scope';
      model.textContent = provider.models[0]?.id ? `Model: ${provider.models[0].id}` : 'No model metadata';
      const form = document.createElement('div');
      form.className = 'provider-form';
      const baseUrl = document.createElement('input');
      baseUrl.type = 'url';
      baseUrl.placeholder = 'http://127.0.0.1:11434';
      baseUrl.value = providerConfigs.get(provider.id)?.baseUrl || (provider.id === 'ollama' ? 'http://127.0.0.1:11434' : 'http://127.0.0.1:8080');
      baseUrl.dataset.providerField = 'baseUrl';
      const modelId = document.createElement('input');
      modelId.type = 'text';
      modelId.placeholder = 'model id';
      modelId.value = providerConfigs.get(provider.id)?.modelId || provider.models[0]?.id || '';
      modelId.dataset.providerField = 'modelId';
      const enabled = document.createElement('input');
      enabled.type = 'checkbox';
      enabled.checked = providerConfigs.get(provider.id)?.enabled || provider.enabled;
      enabled.dataset.providerField = 'enabled';
      const enabledLabel = document.createElement('label');
      enabledLabel.textContent = 'Enable';
      enabledLabel.prepend(enabled);
      const save = document.createElement('button');
      save.className = 'allow';
      save.textContent = 'Save config';
      save.onclick = () => { void configureProvider(provider.id, baseUrl, modelId, enabled); };
      const doctor = document.createElement('button');
      doctor.className = 'deny';
      doctor.textContent = 'Run doctor';
      doctor.onclick = () => { void runProviderDoctor(provider.id, card); };
      form.append(baseUrl, modelId, enabledLabel, save, doctor);
      card.append(title, meta, model, form);
      list.append(card);
    });
  };
  const loadProviders = async () => {
    if (!window.osamah?.dispatch) {
      renderProviders([]);
      return;
    }
    const response = await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: nextRequest('provider-list'),
      correlationId: nextRequest('provider-list-correlation'),
      method: 'provider.list',
      payload: {},
    });
    if (!response.ok) {
      log(`provider.list_failed ${response.error.message}`, 'warn');
      return;
    }
    renderProviders(response.result);
    $('rightStatus').textContent = response.result.length ? `${response.result.length} provider(s) registered` : 'No providers registered';
  };
  const configureProvider = async (providerId, baseUrl, modelId, enabled) => {
    const payload = {
      providerId,
      enabled: enabled.checked,
      baseUrl: baseUrl.value.trim(),
      modelId: modelId.value.trim(),
      timeoutMs: 15000,
      maxInputChars: 128 * 1024,
      maxOutputChars: 256 * 1024,
      maxConcurrent: 1,
      maxRequestsPerWindow: 8,
      quotaWindowMs: 60000,
      circuitFailureThreshold: 3,
      circuitCooldownMs: 15000,
    };
    const response = await window.osamah?.dispatch?.({
      protocolVersion: 1,
      requestId: nextRequest('provider-configure'),
      correlationId: nextRequest('provider-configure-correlation'),
      method: 'provider.configure',
      payload,
    });
    if (!response) {
      log('provider.configure_unavailable', 'warn');
      return;
    }
    if (!response.ok) {
      log(`provider.configure_failed ${response.error.message}`, 'warn');
      return;
    }
    providerConfigs.set(providerId, response.result);
    $('rightStatus').textContent = `${providerId} configuration saved`;
    log(`provider.configured ${providerId}`, 'ok');
    await loadProviders();
  };
  const runProviderDoctor = async (providerId, card) => {
    const status = document.createElement('div');
    status.className = 'approval-meta';
    status.textContent = 'Checking provider…';
    card.append(status);
    const response = await window.osamah?.dispatch?.({
      protocolVersion: 1,
      requestId: nextRequest('provider-doctor'),
      correlationId: nextRequest('provider-doctor-correlation'),
      method: 'provider.doctor',
      payload: { providerId },
    });
    if (!response) {
      status.textContent = 'Doctor unavailable in this host.';
      log('provider.doctor_unavailable', 'warn');
      return;
    }
    if (!response.ok) {
      status.textContent = `Doctor failed: ${response.error.message}`;
      log(`provider.doctor_failed ${response.error.message}`, 'warn');
      return;
    }
    const report = response.result[0];
    status.textContent = report ? `Doctor: ${report.status}${report.latencyMs === undefined ? '' : ` · ${report.latencyMs}ms`}` : 'Doctor: no report';
    $('rightStatus').textContent = report ? `${providerId}: ${report.status}` : 'Provider doctor complete';
    log(`provider.doctor ${providerId} ${report?.status || 'empty'}`, report?.status === 'healthy' ? 'ok' : 'warn');
  };

  const inspectTerminalPolicy = async () => {
    const executable = $('terminalExecutable').value.trim();
    const rawArgs = $('terminalArgs').value.trim();
    const args = rawArgs ? rawArgs.split(/\s+/u) : [];
    if (typeof window.osamah?.dispatch !== 'function') {
      $('terminalPolicyResult').textContent = 'Desktop IPC is unavailable; no command was inspected or executed.';
      log('terminal.inspect_unavailable', 'warn');
      return;
    }
    const response = await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: nextRequest('terminal-inspect'),
      correlationId: nextRequest('terminal-inspect-correlation'),
      method: 'terminal.inspect',
      payload: { requestId: nextRequest('terminal-policy-request'), sessionId: 'workspace-terminal', rootPath: currentRoot || '.', cwd: '.', executable, args },
    });
    if (!response.ok) {
      $('terminalPolicyResult').textContent = `Request rejected: ${response.error.message}`;
      log(`terminal.inspect_rejected ${response.error.message}`, 'warn');
      return;
    }
    const decision = response.result;
    $('terminalPolicyResult').textContent = `${decision.decision.toUpperCase()} · ${decision.commandClass}\n${decision.displayCommand}\n${decision.reason}\nHuman Gate: ${decision.requiresHumanGate ? 'required' : 'not available'}`;
    $('rightStatus').textContent = `Terminal policy: ${decision.decision}`;
    log(`terminal.inspect ${decision.commandClass} · ${decision.decision} · no process started`, decision.decision === 'denied' ? 'warn' : 'ok');
  };

  const renderGitDiff = (result) => {
    const container = $('gitDiffPreview');
    if (!container) return;
    const label = result.relativePath ? `Diff · ${result.relativePath}` : 'Diff · working tree';
    const suffix = result.rawUnavailable ? '\n[Git diff unavailable]' : result.truncated ? '\n[Git diff truncated by policy]' : '';
    container.textContent = `${label}\n${result.patch || '(no unstaged diff)'}${suffix}`;
  };

  const loadGitDiff = async (relativePath) => {
    if (!currentRoot || typeof window.osamah?.dispatch !== 'function') {
      $('gitDiffPreview').textContent = 'Select a project root before reading Git diff.';
      return;
    }
    const response = await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: nextRequest('git-diff'),
      correlationId: nextRequest('git-diff-correlation'),
      method: 'git.diff',
      payload: { rootPath: currentRoot, ...(relativePath ? { relativePath } : {}) },
    });
    if (!response.ok) {
      $('gitDiffPreview').textContent = `Git diff rejected: ${response.error.message}`;
      log(`git.diff_rejected ${response.error.message}`, 'warn');
      return;
    }
    renderGitDiff(response.result);
    log(`git.diff_loaded ${relativePath || 'working-tree'} · ${response.result.bytes} bytes${response.result.truncated ? ' · truncated' : ''}`, response.result.truncated ? 'warn' : 'ok');
  };

  const renderGitStatus = (status) => {
    $('gitRepoState').textContent = status.isRepository ? (status.truncated ? 'available · bounded' : 'available') : 'not available';
    $('gitBranch').textContent = status.branch || (status.isRepository ? '(detached)' : '—');
    $('gitCounts').textContent = `S ${status.staged.length} · U ${status.unstaged.length} · ? ${status.untracked.length} · ! ${status.conflicted.length}`;
    const list = $('gitChanges');
    list.replaceChildren();
    const entries = [
      ...status.staged.map((change) => ({ path: change.path, label: `S ${change.status} ${change.path}` })),
      ...status.unstaged.map((change) => ({ path: change.path, label: `U ${change.status} ${change.path}` })),
      ...status.untracked.map((path) => ({ path, label: `? ?? ${path}` })),
      ...status.conflicted.map((path) => ({ path, label: `! conflict ${path}` })),
    ].slice(0, 32);
    if (!entries.length) {
      const empty = document.createElement('div');
      empty.className = 'approval-empty';
      empty.textContent = status.isRepository ? 'Working tree clean. No unstaged diff.' : 'Git status unavailable for this root.';
      list.append(empty);
      return;
    }
    entries.forEach((entry) => {
      const button = document.createElement('button');
      button.className = 'git-change';
      button.textContent = entry.label;
      button.title = entry.path;
      button.onclick = () => { void loadGitDiff(entry.path); };
      list.append(button);
    });
  };

  const loadGitStatus = async () => {
    if (!currentRoot || typeof window.osamah?.dispatch !== 'function') {
      $('gitRepoState').textContent = 'root required';
      $('gitBranch').textContent = '—';
      $('gitCounts').textContent = '—';
      $('gitChanges').replaceChildren();
      $('gitDiffPreview').textContent = 'Select a project root before reading Git. Commit and push are unavailable in this panel.';
      return;
    }
    const response = await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: nextRequest('git-status'),
      correlationId: nextRequest('git-status-correlation'),
      method: 'git.status',
      payload: { rootPath: currentRoot },
    });
    if (!response.ok) {
      $('gitRepoState').textContent = 'request rejected';
      $('gitChanges').replaceChildren();
      $('gitDiffPreview').textContent = `Git status rejected: ${response.error.message}`;
      log(`git.status_rejected ${response.error.message}`, 'warn');
      return;
    }
    renderGitStatus(response.result);
    $('rightStatus').textContent = response.result.isRepository ? `Git: ${response.result.branch || 'detached'}` : 'Git unavailable for root';
    log(`git.status_loaded ${response.result.branch || 'not-a-repository'} · ${response.result.staged.length + response.result.unstaged.length + response.result.untracked.length} changes`, response.result.isRepository ? 'ok' : 'warn');
  };

  const renderTaskReview = (result) => {
    $('taskReviewStatus').textContent = `${result.safeToProceed ? 'ACCEPTED' : 'BLOCKED'} · preview-only · no patch, command, runtime, or approval ticket`;
    $('taskContextFiles').textContent = String(result.context.files.length);
    $('taskContextManifests').textContent = String(result.context.manifests.length);
    $('taskTargetCount').textContent = String(result.targetedFiles.length);
    $('taskContextState').textContent = result.context.truncated ? 'truncated · review warnings' : (result.context.warnings.length ? 'warning-bearing' : 'bounded');
    const renderItems = (id, items, emptyText, className = 'task-review-item') => {
      const list = $(id);
      list.replaceChildren();
      if (!items.length) {
        const empty = document.createElement('div');
        empty.className = 'approval-empty';
        empty.textContent = emptyText;
        list.append(empty);
        return;
      }
      items.forEach((item) => {
        const element = document.createElement('div');
        element.className = className;
        element.textContent = item;
        list.append(element);
      });
    };
    renderItems('taskTargetList', result.targetedFiles.map((file) => `${file.relativePath} · ${file.bytes} bytes · sha256 ${file.sha256.slice(0, 12)}…`), 'No targeted file metadata.');
    renderItems('taskPlanList', result.plan.steps.map((step, index) => `${index + 1}. ${step.title}\n${step.description}`), 'No plan preview.');
    const critiqueItems = result.critique.issues.map((issue) => `${issue.severity.toUpperCase()} · ${issue.code}${issue.stepId ? ` · ${issue.stepId}` : ''}\n${issue.message}`);
    renderItems('taskCritiqueList', critiqueItems, result.critique.accepted ? 'No blocking critique issues.' : 'Critique blocked this preview.', 'task-review-item ' + (result.critique.accepted ? 'warning' : 'blocking'));
  };

  let selectedSourceId = '';
  const renderCitations = (citations) => {
    const list = $('citationList');
    if (!list) return;
    list.replaceChildren();
    if (!citations.length) {
      const empty = document.createElement('div');
      empty.className = 'source-empty';
      empty.textContent = 'No citations registered for this source.';
      list.append(empty);
      return;
    }
    citations.slice(0, 16).forEach((citation) => {
      const item = document.createElement('div');
      item.className = 'citation-item';
      const location = citation.page ? `page ${citation.page}` : citation.section || (citation.span ? `span ${citation.span.start}-${citation.span.end}` : 'location not supplied');
      item.textContent = `${citation.label} · ${citation.verificationState}\n${location}${citation.quotePreview ? `\n${citation.quotePreview}` : ''}`;
      list.append(item);
    });
  };
  const loadSourceCitations = async (sourceId) => {
    selectedSourceId = sourceId;
    if (typeof window.osamah?.dispatch !== 'function') {
      renderCitations([]);
      return;
    }
    const response = await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: nextRequest('production-citation-list'),
      correlationId: nextRequest('production-citation-list-correlation'),
      method: 'production.citation.list',
      payload: { sourceId, limit: 16 },
    });
    if (!response.ok) {
      $('sourceRegistryStatus').textContent = `Citation request rejected: ${response.error.message}`;
      log(`production.citation.list_rejected ${response.error.message}`, 'warn');
      return;
    }
    renderCitations(response.result);
    $('sourceRegistryStatus').textContent = `${response.result.length} citation(s) loaded · source ${sourceId}`;
  };
  const renderSources = (sources) => {
    const list = $('sourceList');
    if (!list) return;
    list.replaceChildren();
    if (!sources.length) {
      const empty = document.createElement('div');
      empty.className = 'source-empty';
      empty.textContent = 'No production sources yet.';
      list.append(empty);
      renderCitations([]);
      return;
    }
    sources.slice(0, 64).forEach((source) => {
      const item = document.createElement('div');
      item.className = `source-item${source.sourceId === selectedSourceId ? ' active' : ''}`;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${source.title || source.kind}\n${source.locator}\n${source.verificationState} · ${source.bytes === undefined ? 'bytes unknown' : `${source.bytes} bytes`} · ${source.sha256 ? `sha256 ${source.sha256.slice(0, 12)}…` : 'no hash'}`;
      button.onclick = () => { void loadSourceCitations(source.sourceId); };
      item.append(button);
      list.append(item);
    });
  };
  const loadSources = async () => {
    if (typeof window.osamah?.dispatch !== 'function') {
      renderSources([]);
      $('sourceRegistryStatus').textContent = 'Desktop IPC unavailable; no source was fetched or registered.';
      return;
    }
    const response = await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: nextRequest('production-source-list'),
      correlationId: nextRequest('production-source-list-correlation'),
      method: 'production.source.list',
      payload: { limit: 64 },
    });
    if (!response.ok) {
      $('sourceRegistryStatus').textContent = `Source list rejected: ${response.error.message}`;
      log(`production.source.list_rejected ${response.error.message}`, 'warn');
      return;
    }
    renderSources(response.result);
    $('sourceRegistryStatus').textContent = `${response.result.length} source(s) · local registry · no fetch`;
  };
  const registerCurrentSource = async () => {
    if (!currentRoot || !currentDocument || typeof window.osamah?.dispatch !== 'function') {
      $('sourceRegistryStatus').textContent = 'Open a selected project file in Electron before registering its reference.';
      log('production.source.register_unavailable', 'warn');
      return;
    }
    const response = await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: nextRequest('production-source-register'),
      correlationId: nextRequest('production-source-register-correlation'),
      method: 'production.source.register',
      payload: {
        kind: 'workspace_document',
        locator: `workspace://${currentDocument.relativePath}`,
        title: `${currentDocument.relativePath} reference`,
        contentType: 'text/plain',
        bytes: currentDocument.bytes,
        sha256: currentDocument.sha256,
        verificationState: 'content_validated',
        warnings: ['Reference registered explicitly; citation remains unverified.'],
      },
    });
    if (!response.ok) {
      $('sourceRegistryStatus').textContent = `Source registration rejected: ${response.error.message}`;
      log(`production.source.register_rejected ${response.error.message}`, 'warn');
      return;
    }
    selectedSourceId = response.result.sourceId;
    $('sourceRegistryStatus').textContent = `Registered locally · ${response.result.sourceId} · no fetch/export`;
    log(`production.source.registered ${response.result.locator} · no mutation`, 'ok');
    await loadSources();
    await loadSourceCitations(response.result.sourceId);
  };

  let selectedAssetId = '';
  let activeBrief;
  const renderAssets = (assets) => {
    const list = $('assetList');
    if (!list) return;
    list.replaceChildren();
    if (!assets.length) {
      const empty = document.createElement('div');
      empty.className = 'source-empty';
      empty.textContent = 'No asset metadata yet.';
      list.append(empty);
      return;
    }
    assets.slice(0, 64).forEach((asset) => {
      const item = document.createElement('div');
      item.className = `asset-item${asset.assetId === selectedAssetId ? ' active' : ''}`;
      item.textContent = `${asset.kind.toUpperCase()} · ${asset.title}\n${asset.locator}\nLicense: ${asset.license.name} · ${asset.license.state}\n${asset.bytes === undefined ? 'bytes unknown' : `${asset.bytes} bytes`} · ${asset.sha256 ? `sha256 ${asset.sha256.slice(0, 12)}…` : 'no hash'}\n${asset.warnings.length ? `Warnings: ${asset.warnings.join(', ')}` : 'No metadata warnings'}`;
      item.onclick = () => { selectedAssetId = asset.assetId; renderAssets(assets); };
      list.append(item);
    });
  };
  const loadAssets = async () => {
    if (typeof window.osamah?.dispatch !== 'function') {
      renderAssets([]);
      $('assetCatalogStatus').textContent = 'Desktop IPC unavailable; no asset was fetched.';
      return;
    }
    const response = await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: nextRequest('production-asset-list'),
      correlationId: nextRequest('production-asset-list-correlation'),
      method: 'production.asset.list',
      payload: { limit: 64 },
    });
    if (!response.ok) {
      $('assetCatalogStatus').textContent = `Asset list rejected: ${response.error.message}`;
      log(`production.asset.list_rejected ${response.error.message}`, 'warn');
      return;
    }
    renderAssets(response.result);
    $('assetCatalogStatus').textContent = `${response.result.length} asset(s) · metadata-only · no binary fetch`;
  };
  const registerDemoAsset = async () => {
    if (typeof window.osamah?.dispatch !== 'function') {
      $('assetCatalogStatus').textContent = 'Desktop IPC unavailable; no asset metadata was registered.';
      log('production.asset.register_unavailable', 'warn');
      return;
    }
    const response = await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: nextRequest('production-asset-register'),
      correlationId: nextRequest('production-asset-register-correlation'),
      method: 'production.asset.register',
      payload: {
        kind: 'image',
        title: 'Embedded hero reference',
        locator: 'studio://assets/embedded-hero.png',
        mediaType: 'image/png',
        license: { name: 'Declared placeholder', state: 'unverified', warnings: ['Demo metadata only; license requires review.'] },
      },
    });
    if (!response.ok) {
      $('assetCatalogStatus').textContent = `Asset registration rejected: ${response.error.message}`;
      log(`production.asset.register_rejected ${response.error.message}`, 'warn');
      return;
    }
    selectedAssetId = response.result.assetId;
    $('assetCatalogStatus').textContent = `Registered locally · ${response.result.assetId} · no generation/fetch`;
    log(`production.asset.registered ${response.result.kind} · no binary`, 'ok');
    await loadAssets();
  };
  const renderBrief = (brief) => {
    activeBrief = brief;
    $('creativeBriefStatus').textContent = `Brief ${brief.briefId} · review-only · no assembly/render/export`;
    $('briefAssetCount').textContent = String(brief.assetIds.length);
    $('briefWarningCount').textContent = String(brief.warnings.length);
    const list = $('briefAssetList');
    list.replaceChildren();
    if (!brief.assetIds.length) {
      const empty = document.createElement('div');
      empty.className = 'source-empty';
      empty.textContent = brief.warnings.length ? `No asset links · ${brief.warnings.join(', ')}` : 'No brief asset links.';
      list.append(empty);
      return;
    }
    brief.assetIds.slice(0, 16).forEach((assetId) => {
      const item = document.createElement('div');
      item.className = 'brief-item';
      item.textContent = `Asset ${assetId} · linked by ID only`;
      list.append(item);
    });
  };
  const createCreativeBrief = async () => {
    if (typeof window.osamah?.dispatch !== 'function') {
      $('creativeBriefStatus').textContent = 'Desktop IPC unavailable; no brief was created.';
      log('production.brief.create_unavailable', 'warn');
      return;
    }
    const button = $('createCreativeBrief');
    button.disabled = true;
    $('creativeBriefStatus').textContent = 'Creating bounded brief preview…';
    try {
      const created = await window.osamah.dispatch({
        protocolVersion: 1,
        requestId: nextRequest('production-brief-create'),
        correlationId: nextRequest('production-brief-correlation'),
        method: 'production.brief.create',
        payload: { title: $('briefTitle').value.trim(), intent: $('briefIntent').value.trim(), constraints: ['Do not generate media automatically.'], assetSlots: ['hero'] },
      });
      if (!created.ok) {
        $('creativeBriefStatus').textContent = `Brief rejected: ${created.error.message}`;
        log(`production.brief.create_rejected ${created.error.message}`, 'warn');
        return;
      }
      const attached = selectedAssetId ? await window.osamah.dispatch({
        protocolVersion: 1,
        requestId: nextRequest('production-brief-asset-attach'),
        correlationId: nextRequest('production-brief-correlation'),
        method: 'production.brief.asset.attach',
        payload: { briefId: created.result.briefId, assetId: selectedAssetId },
      }) : created;
      if (!attached.ok) {
        $('creativeBriefStatus').textContent = `Brief asset link rejected: ${attached.error.message}`;
        log(`production.brief.asset_attach_rejected ${attached.error.message}`, 'warn');
        return;
      }
      renderBrief(attached.result);
      $('rightStatus').textContent = `Creative brief ${attached.result.warnings.length ? 'needs review' : 'ready'}`;
      log(`production.brief.preview_ready ${attached.result.assetIds.length} asset(s) · no generation`, 'ok');
    } catch (error) {
      $('creativeBriefStatus').textContent = `Brief failed: ${error instanceof Error ? error.message : 'unknown error'}`;
      log('production.brief.failed', 'warn');
    } finally {
      button.disabled = false;
    }
  };

  const renderMemoryEntries = (entries, status) => {
    $('memoryStatus').textContent = status;
    const list = $('memoryList');
    list.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement('div');
      empty.className = 'source-empty';
      empty.textContent = 'No local memory entries.';
      list.append(empty);
      return;
    }
    for (const entry of entries) {
      const item = document.createElement('div');
      item.className = `brain-item ${entry.state}`;
      item.textContent = `${entry.title} · ${entry.kind} · ${entry.state}\n${entry.content}\nvisibility=${entry.visibility} · providerAccess=${entry.providerAccess} · retention=${entry.retention}\ntags=${entry.tags.join(', ') || 'none'}\nprovenance=${entry.provenance.map((ref) => `${ref.kind}:${ref.id}`).join(', ') || 'none'}\nwarnings=${entry.warnings.join(', ') || 'none'}`;
      list.append(item);
    }
  };
  const loadMemoryEntries = async (query) => {
    if (typeof window.osamah?.dispatch !== 'function') {
      $('memoryStatus').textContent = 'Desktop IPC unavailable; no memory request was sent.';
      return;
    }
    const response = query === undefined
      ? await window.osamah.dispatch({ protocolVersion: 1, requestId: nextRequest('brain-memory-list'), correlationId: nextRequest('brain-memory-list-correlation'), method: 'brain.memory.list', payload: { limit: 32 } })
      : await window.osamah.dispatch({ protocolVersion: 1, requestId: nextRequest('brain-memory-search'), correlationId: nextRequest('brain-memory-search-correlation'), method: 'brain.memory.searchLocal', payload: { query, limit: 32 } });
    if (!response.ok) {
      $('memoryStatus').textContent = `Memory request rejected: ${response.error.message}`;
      log(`brain.memory.rejected ${response.error.message}`, 'warn');
      return;
    }
    renderMemoryEntries(response.result, query === undefined ? `Loaded ${response.result.length} local review entries.` : `Found ${response.result.length} local entries for “${query}”.`);
    log(query === undefined ? `brain.memory.list ${response.result.length}` : `brain.memory.searchLocal ${response.result.length}`, 'ok');
  };
  const captureMemoryEntry = async () => {
    if (typeof window.osamah?.dispatch !== 'function') {
      $('memoryStatus').textContent = 'Desktop IPC unavailable; no memory entry was captured.';
      return;
    }
    const button = $('captureMemoryEntry');
    button.disabled = true;
    $('memoryStatus').textContent = 'Capturing bounded review entry locally…';
    try {
      const tags = $('memoryTags').value.split(',').map((tag) => tag.trim()).filter(Boolean);
      const response = await window.osamah.dispatch({
        protocolVersion: 1,
        requestId: nextRequest('brain-memory-capture'),
        correlationId: nextRequest('brain-memory-capture-correlation'),
        method: 'brain.memory.capture',
        payload: { kind: $('memoryKind').value, title: $('memoryTitle').value.trim(), content: $('memoryContent').value, tags, providerAccess: 'never', visibility: 'private', retention: 'session' },
      });
      if (!response.ok) {
        $('memoryStatus').textContent = `Memory capture rejected: ${response.error.message}`;
        log(`brain.memory.capture_rejected ${response.error.message}`, 'warn');
        return;
      }
      renderMemoryEntries([response.result], `Captured ${response.result.entryId} · review_required · providerAccess=never · session memory`);
      $('rightStatus').textContent = 'Second Brain review entry captured';
      log(`brain.memory.capture ${response.result.entryId} · no provider`, 'ok');
    } catch (error) {
      $('memoryStatus').textContent = `Memory capture failed: ${error instanceof Error ? error.message : 'unknown error'}`;
      log('brain.memory.capture_failed', 'warn');
    } finally {
      button.disabled = false;
    }
  };
  const searchMemoryEntries = async () => {
    const query = $('memorySearch').value.trim();
    if (!query) {
      $('memoryStatus').textContent = 'Enter a local search query; no request was sent.';
      return;
    }
    try {
      await loadMemoryEntries(query);
    } catch (error) {
      $('memoryStatus').textContent = `Memory search failed: ${error instanceof Error ? error.message : 'unknown error'}`;
      log('brain.memory.search_failed', 'warn');
    }
  };

  let activeArtifact;
  const renderArtifact = (draft) => {
    activeArtifact = draft;
    $('artifactStatus').textContent = `Draft ${draft.artifactId} · assembly review only · no render/export/file write`;
    $('artifactReviewState').textContent = draft.reviewState;
    $('artifactClaimCount').textContent = String(draft.manifest.claims.length);
    $('artifactAssetCount').textContent = String(draft.manifest.assets.length);
    $('artifactSourceCount').textContent = String(draft.manifest.sources.length);
    $('artifactToolCount').textContent = String(draft.manifest.tools.length);
    const list = $('artifactManifestList');
    list.replaceChildren();
    const item = document.createElement('div');
    item.className = `artifact-item ${draft.reviewState === 'ready_for_render' ? 'ready' : draft.reviewState === 'blocked' ? 'blocked' : 'review'}`;
    item.textContent = `State: ${draft.reviewState}\nClaims: ${draft.manifest.claims.join(', ') || 'none'}\nAssets: ${draft.manifest.assets.join(', ') || 'none'}\nSources: ${draft.manifest.sources.join(', ') || 'none'}\nTools invoked: ${draft.manifest.tools.length ? draft.manifest.tools.join(', ') : 'none'}\nWarnings: ${draft.warnings.length ? draft.warnings.join(', ') : 'none'}`;
    list.append(item);
  };
  const previewRenderPolicy = async () => {
    if (!activeArtifact) {
      $('renderPolicyStatus').textContent = 'Build an artifact manifest first; no renderer was started.';
      log('production.render.policy.missing_artifact', 'warn');
      return;
    }
    if (typeof window.osamah?.dispatch !== 'function') {
      $('renderPolicyStatus').textContent = 'Desktop IPC unavailable; no render policy was evaluated.';
      log('production.render.policy.unavailable', 'warn');
      return;
    }
    const button = $('previewRenderPolicy');
    button.disabled = true;
    $('renderPolicyStatus').textContent = 'Evaluating bounded policy preview…';
    try {
      const response = await window.osamah.dispatch({
        protocolVersion: 1,
        requestId: nextRequest('production-render-policy'),
        correlationId: nextRequest('production-render-policy-correlation'),
        method: 'production.render.policy.preview',
        payload: { artifactId: activeArtifact.artifactId, format: $('renderFormat').value, relativeDestination: 'preview/policy-only-output' },
      });
      if (!response.ok) {
        $('renderPolicyStatus').textContent = `Render policy rejected: ${response.error.message}`;
        log(`production.render.policy_rejected ${response.error.message}`, 'warn');
        return;
      }
      $('renderPolicyStatus').textContent = `Policy ${response.result.decision} · no renderer started · no output file`;
      $('renderDecision').textContent = response.result.decision;
      $('renderAdapter').textContent = response.result.adapter;
      $('renderMemoryBudget').textContent = `${response.result.budget.maxMemoryMb} MB · ${response.result.budget.timeoutMs} ms`;
      $('renderExecutionStarted').textContent = String(response.result.executionStarted);
      const checks = $('renderChecksList');
      checks.replaceChildren();
      const item = document.createElement('div');
      item.className = `artifact-item ${response.result.decision === 'allowed_preview' ? 'ready' : response.result.decision === 'blocked' ? 'blocked' : 'review'}`;
      item.textContent = `Checks: ${response.result.checks.join(', ') || 'none'}\nWarnings: ${response.result.warnings.length ? response.result.warnings.join(', ') : 'none'}`;
      checks.append(item);
      $('rightStatus').textContent = `Render policy ${response.result.decision}`;
      log(`production.render.policy ${response.result.decision} · executionStarted=false`, response.result.decision === 'blocked' ? 'warn' : 'ok');
    } catch (error) {
      $('renderPolicyStatus').textContent = `Render policy failed: ${error instanceof Error ? error.message : 'unknown error'}`;
      log('production.render.policy_failed', 'warn');
    } finally {
      button.disabled = false;
    }
  };

  const createArtifactDraft = async () => {
    if (!activeContentPlan) {
      $('artifactStatus').textContent = 'Create a content plan preview first; no assembly was attempted.';
      log('production.artifact.missing_plan', 'warn');
      return;
    }
    if (typeof window.osamah?.dispatch !== 'function') {
      $('artifactStatus').textContent = 'Desktop IPC unavailable; no artifact draft was created.';
      log('production.artifact.create_unavailable', 'warn');
      return;
    }
    const button = $('createArtifactDraft');
    button.disabled = true;
    $('artifactStatus').textContent = 'Building bounded manifest preview…';
    try {
      const response = await window.osamah.dispatch({
        protocolVersion: 1,
        requestId: nextRequest('production-artifact-draft'),
        correlationId: nextRequest('production-artifact-correlation'),
        method: 'production.artifact.draft.create',
        payload: { kind: 'document', title: $('artifactTitle').value.trim(), contentPlanId: activeContentPlan.planId, ...(activeBrief ? { briefId: activeBrief.briefId } : {}) },
      });
      if (!response.ok) {
        $('artifactStatus').textContent = `Artifact draft rejected: ${response.error.message}`;
        log(`production.artifact.draft_rejected ${response.error.message}`, 'warn');
        return;
      }
      renderArtifact(response.result);
      $('rightStatus').textContent = `Artifact ${response.result.reviewState}`;
      log(`production.artifact.draft_ready ${response.result.reviewState} · tools=0`, response.result.reviewState === 'blocked' ? 'warn' : 'ok');
    } catch (error) {
      $('artifactStatus').textContent = `Artifact draft failed: ${error instanceof Error ? error.message : 'unknown error'}`;
      log('production.artifact.failed', 'warn');
    } finally {
      button.disabled = false;
    }
  };

  let activeContentPlan;
  const renderContentPlan = (plan) => {
    activeContentPlan = plan;
    $('contentPlanStatus').textContent = `Plan ${plan.planId} · review-only · no generation/render/export`;
    $('contentPlanSections').textContent = String(plan.sections.length);
    $('contentPlanClaims').textContent = String(plan.integrity.totalClaims);
    $('contentPlanSupported').textContent = String(plan.integrity.supportedClaims);
    $('contentPlanUnresolved').textContent = String(plan.integrity.unresolvedClaims);
    $('contentPlanConflicted').textContent = String(plan.integrity.conflictedClaims);
    const list = $('contentPlanClaimList');
    list.replaceChildren();
    if (!plan.claims.length) {
      const empty = document.createElement('div');
      empty.className = 'source-empty';
      empty.textContent = 'No claims in preview.';
      list.append(empty);
      return;
    }
    plan.claims.slice(0, 128).forEach((claim) => {
      const item = document.createElement('div');
      item.className = `content-plan-item ${claim.verificationState}`;
      item.textContent = `${claim.verificationState.toUpperCase()} · ${claim.text}\nCitations: ${claim.citationIds.length ? claim.citationIds.join(', ') : 'none'}${claim.warnings.length ? `\nWarnings: ${claim.warnings.join(', ')}` : ''}`;
      list.append(item);
    });
  };
  const createContentPlanPreview = async () => {
    if (typeof window.osamah?.dispatch !== 'function') {
      $('contentPlanStatus').textContent = 'Desktop IPC unavailable; no plan was created.';
      log('production.plan.create_unavailable', 'warn');
      return;
    }
    const button = $('createContentPlan');
    button.disabled = true;
    $('contentPlanStatus').textContent = 'Building bounded plan preview…';
    try {
      const created = await window.osamah.dispatch({
        protocolVersion: 1,
        requestId: nextRequest('production-plan-create'),
        correlationId: nextRequest('production-plan-correlation'),
        method: 'production.plan.create',
        payload: { brief: $('contentBrief').value.trim() },
      });
      if (!created.ok) {
        $('contentPlanStatus').textContent = `Plan rejected: ${created.error.message}`;
        log(`production.plan.create_rejected ${created.error.message}`, 'warn');
        return;
      }
      const section = await window.osamah.dispatch({
        protocolVersion: 1,
        requestId: nextRequest('production-plan-section'),
        correlationId: nextRequest('production-plan-correlation'),
        method: 'production.plan.section.add',
        payload: { planId: created.result.planId, title: 'Review', summary: 'Bounded review section; generated copy is not enabled.' },
      });
      if (!section.ok) {
        $('contentPlanStatus').textContent = `Section rejected: ${section.error.message}`;
        log(`production.plan.section_rejected ${section.error.message}`, 'warn');
        return;
      }
      const claim = await window.osamah.dispatch({
        protocolVersion: 1,
        requestId: nextRequest('production-plan-claim'),
        correlationId: nextRequest('production-plan-correlation'),
        method: 'production.plan.claim.add',
        payload: { planId: created.result.planId, sectionId: section.result.sections[0].sectionId, text: 'This plan requires citation review before any final copy.', confidence: 0.5 },
      });
      if (!claim.ok) {
        $('contentPlanStatus').textContent = `Claim rejected: ${claim.error.message}`;
        log(`production.plan.claim_rejected ${claim.error.message}`, 'warn');
        return;
      }
      renderContentPlan(claim.result);
      $('rightStatus').textContent = `Content plan ${claim.result.integrity.unresolvedClaims ? 'needs citations' : 'ready'}`;
      log(`production.plan.preview_ready ${claim.result.integrity.totalClaims} claim(s) · no generation`, 'ok');
    } catch (error) {
      $('contentPlanStatus').textContent = `Plan failed: ${error instanceof Error ? error.message : 'unknown error'}`;
      log('production.plan.failed', 'warn');
    } finally {
      button.disabled = false;
    }
  };

  const previewCurrentTask = async () => {
    if (!currentRoot || typeof window.osamah?.dispatch !== 'function') {
      $('taskReviewStatus').textContent = 'Select a project root in Electron before requesting task review.';
      log('task.preview_unavailable', 'warn');
      return;
    }
    const button = $('reviewTask');
    button.disabled = true;
    $('taskReviewStatus').textContent = 'Reading bounded context and preparing deterministic review…';
    try {
      const response = await window.osamah.dispatch({
        protocolVersion: 1,
        requestId: nextRequest('task-preview'),
        correlationId: nextRequest('task-preview-correlation'),
        method: 'task.preview',
        payload: {
          rootPath: currentRoot,
          goal: 'Review the selected project context before any change.',
          constraints: ['Do not execute scripts or mutate files.', 'Wait for explicit Human Gate before any future mutation.'],
          targetedPaths: currentRelativePath ? [currentRelativePath] : [],
          offlineMode: true,
        },
      });
      if (!response.ok) {
        $('taskReviewStatus').textContent = `Task preview rejected: ${response.error.message}`;
        log(`task.preview_rejected ${response.error.message}`, 'warn');
        return;
      }
      renderTaskReview(response.result);
      $('rightStatus').textContent = response.result.safeToProceed ? 'Task review ready' : 'Task review blocked';
      log(`task.preview_ready ${response.result.targetedFiles.length} target(s) · no mutation`, response.result.safeToProceed ? 'ok' : 'warn');
    } catch (error) {
      $('taskReviewStatus').textContent = `Task preview failed: ${error instanceof Error ? error.message : 'unknown error'}`;
      log('task.preview_failed', 'warn');
    } finally {
      button.disabled = false;
    }
  };

  const proposeEditorDiff = async () => {
    const content = $('editorBuffer').value;
    if (!currentRoot || !currentDocument) {
      $('editorState').textContent = 'fixture / no mutation';
      $('diffPreview').textContent = 'Open a project file in Electron before proposing a diff.';
      log('editor.propose_unavailable', 'warn');
      return;
    }
    const response = await window.osamah?.dispatch?.({
      protocolVersion: 1,
      requestId: nextRequest('editor-propose'),
      correlationId: nextRequest('editor-propose-correlation'),
      method: 'editor.propose',
      payload: { rootPath: currentRoot, relativePath: currentDocument.relativePath, content, expectedSha256: currentDocument.sha256 },
    });
    if (!response) {
      log('editor.propose_unavailable', 'warn');
      return;
    }
    if (!response.ok) {
      $('editorState').textContent = response.error.code === 'DOMAIN_ERROR' ? 'conflict / reload required' : 'proposal rejected';
      log(`editor.propose_failed ${response.error.message}`, 'warn');
      return;
    }
    renderDiff(response.result);
    $('editorState').textContent = response.result.diffTruncated ? 'diff bounded / review incomplete' : 'diff ready / no mutation';
    $('rightStatus').textContent = `Diff ready: ${currentDocument.relativePath}`;
    log(`editor.diff_ready ${currentDocument.relativePath} · ${response.result.bytes} bytes`, 'ok');
  };

  const chooseProjectRoot = async () => {
    const button = $('openProject');
    if (!window.osamah?.chooseProjectRoot) {
      log('Root picker is unavailable in this host.', 'warn');
      return;
    }
    button.disabled = true;
    $('rightStatus').textContent = 'Choosing project root…';
    $('projectState').textContent = 'waiting for folder selection';
    try {
      const result = await window.osamah.chooseProjectRoot();
      if (result.canceled) {
        $('projectState').textContent = 'selection canceled';
        log('project.root_selection_canceled', 'warn');
      } else if ('rootPath' in result) {
        const rootName = result.rootPath.split(/[\\/]/).filter(Boolean).at(-1) || result.rootPath;
        currentRoot = result.rootPath;
        $('projectState').textContent = `root selected: ${rootName}`;
        $('rightStatus').textContent = 'Project root selected';
        log(`project.root_selected ${rootName}`, 'ok');
        await loadProjectTree(result.rootPath);
        await loadGitStatus();
        await loadSources();
      } else {
        $('projectState').textContent = 'root selection failed';
        $('rightStatus').textContent = 'Root picker error';
        log(`project.root_selection_failed ${result.message}`, 'warn');
      }
    } catch (error) {
      $('projectState').textContent = 'root selection failed';
      $('rightStatus').textContent = 'Root picker error';
      log(`project.root_selection_failed ${error instanceof Error ? error.message : 'unknown error'}`, 'warn');
    } finally {
      button.disabled = false;
    }
  };

  $('openProject').onclick = () => { void chooseProjectRoot(); };
  $('proposeDiff').onclick = () => { void proposeEditorDiff(); };
  $('inspectTerminal').onclick = () => { void inspectTerminalPolicy(); };
  $('reviewTask').onclick = () => { void previewCurrentTask(); };
  $('registerCurrentSource').onclick = () => { void registerCurrentSource(); };
  $('refreshSources').onclick = () => { void loadSources(); };
  $('registerDemoAsset').onclick = () => { void registerDemoAsset(); };
  $('refreshAssets').onclick = () => { void loadAssets(); };
  $('createCreativeBrief').onclick = () => { void createCreativeBrief(); };
  $('createArtifactDraft').onclick = () => { void createArtifactDraft(); };
  $('previewRenderPolicy').onclick = () => { void previewRenderPolicy(); };
  $('captureMemoryEntry').onclick = () => { void captureMemoryEntry(); };
  $('searchMemoryEntries').onclick = () => { void searchMemoryEntries(); };
  $('createContentPlan').onclick = () => { void createContentPlanPreview(); };
  $('refreshGit').onclick = () => { void loadGitStatus(); };
  $('editorBuffer').addEventListener('input', () => {
    if (currentDocument) $('editorState').textContent = 'modified buffer · proposal only';
  });
  renderFallbackProjectTree();
  $('deviceSelect').onchange = (event) => { selected = profiles[event.target.value]; renderProfile(); log(`device.selected ${selected.name}`); };
  $('rotate').onclick = () => { orientation = orientation === 'portrait' ? 'landscape' : 'portrait'; renderProfile(); log(`orientation.changed ${orientation}`); };
  $('theme').onclick = () => { dark = !dark; renderProfile(); log(`theme.changed ${dark ? 'dark' : 'light'}`); };
  $('run').onclick = () => { $('rightStatus').textContent = 'Preview running'; $('projectState').textContent = 'embedded session running'; renderPreview(); log('PreviewStatusChanged: ready', 'ok'); };
  $('stop').onclick = () => { $('rightStatus').textContent = 'Preview stopped'; $('projectState').textContent = 'session stopped'; log('PreviewStatusChanged: stopped', 'warn'); };
  $('refresh').onclick = () => { $('rightStatus').textContent = 'Fast Refresh applied'; renderPreview(); log('FastRefresh: state preserved', 'ok'); setTimeout(() => { $('rightStatus').textContent = 'Preview ready'; }, 700); };
  $('capture').onclick = () => { log('ScreenshotCaptured: artifact created', 'ok'); };
  $('approve').onclick = () => { void loadPendingApprovals(); log('approval.queue_refreshed'); };

  const runDesktopSmoke = async () => {
    if (window.location.hash !== '#osamah-smoke' || !window.osamah) return;
    const response = await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-open-project',
      correlationId: 'desktop-smoke',
      method: 'preview.openProject',
      payload: {
        projectId: 'desktop-smoke-fixture',
        rootPath: 'fixtures/mobile-expo',
        deviceProfileId: 'pixel-9',
        mode: 'lightweight_web',
      },
    });
    const projectTreeResponse = await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-project-tree',
      correlationId: 'desktop-smoke-explorer',
      method: 'project.tree',
      payload: { rootPath: 'fixtures/mobile-expo' },
    });
    const gitStatusResponse = await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-git-status',
      correlationId: 'desktop-smoke-git',
      method: 'git.status',
      payload: { rootPath: 'fixtures/mobile-expo' },
    });
    const gitDiffResponse = await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-git-diff',
      correlationId: 'desktop-smoke-git',
      method: 'git.diff',
      payload: { rootPath: 'fixtures/mobile-expo', relativePath: 'app/index.tsx' },
    });
    const projectFileResponse = await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-file-open',
      correlationId: 'desktop-smoke-explorer',
      method: 'file.openText',
      payload: { rootPath: 'fixtures/mobile-expo', relativePath: 'app/index.tsx' },
    });
    const taskPreviewResponse = await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-task-preview',
      correlationId: 'desktop-smoke-task-preview-correlation',
      method: 'task.preview',
      payload: {
        rootPath: 'fixtures/mobile-expo',
        goal: 'Review the bounded project before any mutation.',
        constraints: ['Do not execute scripts or mutate files.', 'Wait for explicit Human Gate before mutation.'],
        targetedPaths: ['app/index.tsx'],
        offlineMode: true,
      },
    });
    const sourceBytes = projectFileResponse.ok && projectFileResponse.result ? projectFileResponse.result.bytes : 1;
    const sourceSha = projectFileResponse.ok && projectFileResponse.result ? projectFileResponse.result.sha256 : '0'.repeat(64);
    const sourceRegisterResponse = await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-source-register',
      correlationId: 'desktop-smoke-production-source',
      method: 'production.source.register',
      payload: {
        kind: 'workspace_document',
        locator: 'workspace://app/index.tsx',
        title: 'Desktop smoke source',
        contentType: 'text/typescript',
        bytes: sourceBytes,
        sha256: sourceSha,
        verificationState: 'content_validated',
        warnings: ['Desktop smoke reference; citation is unverified.'],
      },
    });
    const sourceListResponse = await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-source-list',
      correlationId: 'desktop-smoke-production-source',
      method: 'production.source.list',
      payload: { limit: 8 },
    });
    const citationResponse = sourceRegisterResponse.ok ? await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-citation-add',
      correlationId: 'desktop-smoke-production-source',
      method: 'production.citation.add',
      payload: { sourceId: sourceRegisterResponse.result.sourceId, label: 'Desktop smoke span', span: { start: 0, end: Math.min(sourceBytes, 128) }, verificationState: 'unverified' },
    }) : { ok: false };
    const citationListResponse = sourceRegisterResponse.ok ? await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-citation-list',
      correlationId: 'desktop-smoke-production-source',
      method: 'production.citation.list',
      payload: { sourceId: sourceRegisterResponse.result.sourceId, limit: 8 },
    }) : { ok: false };
    const provenanceListResponse = sourceRegisterResponse.ok ? await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-provenance-list',
      correlationId: 'desktop-smoke-production-source',
      method: 'production.provenance.list',
      payload: { entityId: sourceRegisterResponse.result.sourceId, limit: 8 },
    }) : { ok: false };
    const contentPlanCreateResponse = await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-plan-create',
      correlationId: 'desktop-smoke-production-plan',
      method: 'production.plan.create',
      payload: { brief: 'Desktop smoke content review' },
    });
    const contentPlanSectionResponse = contentPlanCreateResponse.ok ? await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-plan-section',
      correlationId: 'desktop-smoke-production-plan',
      method: 'production.plan.section.add',
      payload: { planId: contentPlanCreateResponse.result.planId, title: 'Review', summary: 'Smoke section; no generation.' },
    }) : { ok: false };
    const contentPlanClaimResponse = contentPlanCreateResponse.ok && contentPlanSectionResponse.ok ? await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-plan-claim',
      correlationId: 'desktop-smoke-production-plan',
      method: 'production.plan.claim.add',
      payload: { planId: contentPlanCreateResponse.result.planId, sectionId: contentPlanSectionResponse.result.sections[0].sectionId, text: 'This claim requires citation review.', confidence: 0.5 },
    }) : { ok: false };
    const contentPlanGetResponse = contentPlanCreateResponse.ok ? await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-plan-get',
      correlationId: 'desktop-smoke-production-plan',
      method: 'production.plan.get',
      payload: { planId: contentPlanCreateResponse.result.planId },
    }) : { ok: false };
    const assetRegisterResponse = await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-asset-register',
      correlationId: 'desktop-smoke-production-asset',
      method: 'production.asset.register',
      payload: { kind: 'image', title: 'Desktop smoke asset', locator: 'studio://assets/smoke.png', mediaType: 'image/png', license: { name: 'Smoke placeholder', state: 'unverified', warnings: ['Review license before use.'] } },
    });
    const assetListResponse = await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-asset-list',
      correlationId: 'desktop-smoke-production-asset',
      method: 'production.asset.list',
      payload: { limit: 8 },
    });
    const briefCreateResponse = await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-brief-create',
      correlationId: 'desktop-smoke-production-brief',
      method: 'production.brief.create',
      payload: { title: 'Desktop smoke brief', intent: 'Review visual direction', constraints: ['Do not generate media.'], assetSlots: ['hero'] },
    });
    const briefAttachResponse = assetRegisterResponse.ok && briefCreateResponse.ok ? await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-brief-attach',
      correlationId: 'desktop-smoke-production-brief',
      method: 'production.brief.asset.attach',
      payload: { briefId: briefCreateResponse.result.briefId, assetId: assetRegisterResponse.result.assetId },
    }) : { ok: false };
    const briefGetResponse = briefCreateResponse.ok ? await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-brief-get',
      correlationId: 'desktop-smoke-production-brief',
      method: 'production.brief.get',
      payload: { briefId: briefCreateResponse.result.briefId },
    }) : { ok: false };
    const artifactDraftResponse = contentPlanCreateResponse.ok ? await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-artifact-draft',
      correlationId: 'desktop-smoke-artifact',
      method: 'production.artifact.draft.create',
      payload: { kind: 'document', title: 'Desktop smoke artifact', contentPlanId: contentPlanCreateResponse.result.planId },
    }) : { ok: false };
    const artifactGetResponse = artifactDraftResponse.ok ? await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-artifact-get',
      correlationId: 'desktop-smoke-artifact',
      method: 'production.artifact.draft.get',
      payload: { artifactId: artifactDraftResponse.result.artifactId },
    }) : { ok: false };
    const renderPolicyResponse = artifactDraftResponse.ok ? await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-render-policy',
      correlationId: 'desktop-smoke-render-policy',
      method: 'production.render.policy.preview',
      payload: { artifactId: artifactDraftResponse.result.artifactId, format: 'pdf', relativeDestination: 'preview/policy-only-output' },
    }) : { ok: false };
    const renderPolicyMalformedResponse = artifactDraftResponse.ok ? await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-render-policy-invalid',
      correlationId: 'desktop-smoke-render-policy',
      method: 'production.render.policy.preview',
      payload: { artifactId: artifactDraftResponse.result.artifactId, format: 'pdf', relativeDestination: '/tmp/output.pdf' },
    }) : { ok: false };
    const memoryCaptureResponse = await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-memory-capture',
      correlationId: 'desktop-smoke-memory',
      method: 'brain.memory.capture',
      payload: { kind: 'learning', title: 'Desktop smoke learning', content: 'Local review memory only', tags: ['local', 'review'], providerAccess: 'never', visibility: 'private', retention: 'session' },
    });
    const memorySearchResponse = memoryCaptureResponse.ok ? await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-memory-search',
      correlationId: 'desktop-smoke-memory',
      method: 'brain.memory.searchLocal',
      payload: { query: 'review memory', limit: 8 },
    }) : { ok: false };
    const memoryListResponse = memoryCaptureResponse.ok ? await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-memory-list',
      correlationId: 'desktop-smoke-memory',
      method: 'brain.memory.list',
      payload: { limit: 8 },
    }) : { ok: false };
    const memoryMalformedResponse = await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-memory-invalid',
      correlationId: 'desktop-smoke-memory',
      method: 'brain.memory.capture',
      payload: { kind: 'note', title: 'Invalid', content: 'Invalid', providerAccess: 'send_now', embed: true },
    });
    const editorOpenResponse = await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-editor-open',
      correlationId: 'desktop-smoke-editor',
      method: 'editor.open',
      payload: { rootPath: 'fixtures/mobile-expo', relativePath: 'app/index.tsx' },
    });
    const editorProposeResponse = editorOpenResponse.ok && editorOpenResponse.result
      ? await window.osamah.dispatch({
        protocolVersion: 1,
        requestId: 'desktop-smoke-editor-propose',
        correlationId: 'desktop-smoke-editor',
        method: 'editor.propose',
        payload: { rootPath: 'fixtures/mobile-expo', relativePath: 'app/index.tsx', content: `${editorOpenResponse.result.content}\n// desktop smoke proposal\n`, expectedSha256: editorOpenResponse.result.sha256 },
      })
      : { ok: false };
    const terminalInspectResponse = await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-terminal-inspect',
      correlationId: 'desktop-smoke-terminal',
      method: 'terminal.inspect',
      payload: { requestId: 'desktop-smoke-terminal-request', sessionId: 'desktop-smoke-terminal-session', rootPath: 'fixtures/mobile-expo', cwd: '.', executable: 'pnpm', args: ['test'] },
    });
    const cycleResponse = await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-cycle-start',
      correlationId: 'desktop-smoke-cycle',
      method: 'workCycle.start',
      payload: {
        cycleId: 'desktop-smoke-cycle',
        sessionId: 'desktop-smoke-session',
        rootPath: 'fixtures/mobile-expo',
        goal: 'Request approval without applying a patch.',
        constraints: ['Do not execute scripts.'],
        targetedPaths: ['app/index.tsx'],
        plan: { summary: 'Request approval.', steps: [{ id: 'inspect', title: 'Inspect', description: 'Review the selected file before approval.' }] },
        patch: { proposalId: 'desktop-smoke-patch', operations: [{ relativePath: 'app/index.tsx', mode: 'update', content: '// desktop smoke only\\n' }] },
      },
    });
    const providerListResponse = await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-provider-list',
      correlationId: 'desktop-smoke-provider',
      method: 'provider.list',
      payload: {},
    });
    const providerConfigResponse = await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-provider-configure',
      correlationId: 'desktop-smoke-provider',
      method: 'provider.configure',
      payload: {
        providerId: 'ollama',
        enabled: false,
        baseUrl: 'http://127.0.0.1:11434',
        modelId: 'desktop-smoke-model',
        timeoutMs: 15000,
        maxInputChars: 128 * 1024,
        maxOutputChars: 256 * 1024,
        maxConcurrent: 1,
        maxRequestsPerWindow: 8,
        quotaWindowMs: 60000,
        circuitFailureThreshold: 3,
        circuitCooldownMs: 15000,
      },
    });
    const providerDoctorResponse = await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-provider-doctor',
      correlationId: 'desktop-smoke-provider',
      method: 'provider.doctor',
      payload: { providerId: 'ollama' },
    });
    const providerPlannerResponse = await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-provider-planner',
      correlationId: 'desktop-smoke-provider-planner',
      method: 'workCycle.start',
      payload: {
        cycleId: 'desktop-smoke-provider-cycle',
        sessionId: 'desktop-smoke-provider-session',
        rootPath: 'fixtures/mobile-expo',
        goal: 'Generate a bounded plan without mutation.',
        constraints: ['Do not execute scripts.'],
        targetedPaths: ['app/index.tsx'],
        providerId: 'fixture-planner',
        modelId: 'fixture-planner-model',
        offlineMode: true,
        patch: { proposalId: 'desktop-smoke-provider-patch', operations: [] },
      },
    });
    const approvalResponse = await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-approval-list',
      correlationId: 'desktop-smoke-approval',
      method: 'approval.listPending',
      payload: { limit: 8 },
    });
    const approvalId = approvalResponse.ok ? approvalResponse.result[0]?.approvalId : undefined;
    const decisionResponse = approvalId ? await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-approval-decide',
      correlationId: 'desktop-smoke-approval',
      method: 'approval.decide',
      payload: { approvalId, decision: 'approved' },
    }) : null;
    await new Promise((resolve) => setTimeout(resolve, 0));
    const rootResult = await window.osamah.chooseProjectRoot();
    const rootPickerPassed = !rootResult.canceled
      && 'rootPath' in rootResult
      && rootResult.rootPath.replaceAll('\\\\', '/').endsWith('/fixtures/mobile-expo');
    console.log(rootPickerPassed ? 'DESKTOP_ROOT_PICKER_SMOKE=PASS' : 'DESKTOP_ROOT_PICKER_SMOKE=FAIL');
    const streamReady = typeof window.osamah.subscribe === 'function';
    const approvalFlowPassed = cycleResponse.ok && cycleResponse.result.cycle.stage === 'waiting_approval' && approvalResponse.ok && Boolean(approvalId) && Boolean(decisionResponse?.ok) && approvalEventReceived;
    const providerFlowPassed = providerListResponse.ok && providerConfigResponse.ok && providerDoctorResponse.ok && providerDoctorResponse.result[0]?.status === 'disabled';
    const providerPlannerPassed = providerPlannerResponse.ok && providerPlannerResponse.result.cycle.stage === 'checkpointed' && providerPlannerResponse.result.plan.summary === 'Electron smoke plan';
    const explorerPassed = projectTreeResponse.ok && projectTreeResponse.result.fileCount > 0 && projectFileResponse.ok && projectFileResponse.result?.relativePath === 'app/index.tsx' && projectFileResponse.result.content.includes('react-native');
    const gitPassed = gitStatusResponse.ok && gitStatusResponse.result.isRepository && gitDiffResponse.ok && gitDiffResponse.result.relativePath === 'app/index.tsx' && gitDiffResponse.result.rawUnavailable !== true;
    const editorPassed = editorOpenResponse.ok && Boolean(editorOpenResponse.result?.sha256) && editorProposeResponse.ok && editorProposeResponse.result?.diffTruncated === false;
    const terminalPassed = terminalInspectResponse.ok && terminalInspectResponse.result?.decision === 'denied' && terminalInspectResponse.result?.commandClass === 'toolchain';
    const taskPreviewPassed = taskPreviewResponse.ok
      && taskPreviewResponse.result.safeToProceed
      && taskPreviewResponse.result.targetedFiles[0]?.relativePath === 'app/index.tsx'
      && taskPreviewResponse.result.plan.steps.length > 0
      && taskPreviewResponse.result.critique.accepted
      && taskPreviewResponse.result.warnings.every((warning) => typeof warning === 'string');
    const taskPreviewNoApprovalPassed = taskPreviewResponse.ok && approvalResponse.ok && approvalResponse.result.length === 1;
    const sourceRegistryPassed = sourceRegisterResponse.ok && sourceListResponse.ok && sourceListResponse.result.length === 1 && sourceRegisterResponse.result.verificationState === 'content_validated' && citationResponse.ok && citationListResponse.ok && citationListResponse.result.length === 1 && provenanceListResponse.ok && provenanceListResponse.result.length === 0;
    const sourceRegistryNoMutationPassed = sourceRegistryPassed && approvalResponse.ok && approvalResponse.result.length === 1;
    const contentPlanPassed = contentPlanCreateResponse.ok && contentPlanSectionResponse.ok && contentPlanClaimResponse.ok && contentPlanGetResponse.ok && contentPlanClaimResponse.result.integrity.unresolvedClaims === 1 && contentPlanClaimResponse.result.claims[0]?.citationIds.length === 0;
    const contentPlanNoMutationPassed = contentPlanPassed && approvalResponse.ok && approvalResponse.result.length === 1;
    const assetBriefPassed = assetRegisterResponse.ok && assetListResponse.ok && assetListResponse.result.length === 1 && assetRegisterResponse.result.license.state === 'unverified' && briefCreateResponse.ok && briefAttachResponse.ok && briefGetResponse.ok && briefAttachResponse.result.assetIds.length === 1 && briefAttachResponse.result.warnings.includes('asset_license_unverified');
    const assetBriefNoMutationPassed = assetBriefPassed && approvalResponse.ok && approvalResponse.result.length === 1;
    const artifactPassed = artifactDraftResponse.ok && artifactDraftResponse.result.reviewState === 'blocked' && artifactDraftResponse.result.manifest.tools.length === 0 && artifactDraftResponse.result.warnings.some((warning) => warning.includes('no_citation')) && artifactGetResponse.ok && artifactGetResponse.result?.artifactId === artifactDraftResponse.result.artifactId;
    const artifactNoMutationPassed = artifactPassed && approvalResponse.ok && approvalResponse.result.length === 1;
    const renderPolicyPassed = renderPolicyResponse.ok && renderPolicyResponse.result.decision === 'blocked' && renderPolicyResponse.result.executionStarted === false && renderPolicyResponse.result.adapter === 'none' && renderPolicyResponse.result.checks.includes('artifact_review_blocked');
    const renderPolicyNoMutationPassed = renderPolicyPassed && renderPolicyMalformedResponse.ok === false && approvalResponse.ok && approvalResponse.result.length === 1;
    const memoryPassed = memoryCaptureResponse.ok && memoryCaptureResponse.result.state === 'review_required' && memoryCaptureResponse.result.providerAccess === 'never' && memorySearchResponse.ok && memorySearchResponse.result[0]?.entryId === memoryCaptureResponse.result.entryId && memoryListResponse.ok && memoryListResponse.result.length === 1 && memoryMalformedResponse.ok === false;
    const memoryNoMutationPassed = memoryPassed && approvalResponse.ok && approvalResponse.result.length === 1;
    console.log(response.ok && approvalFlowPassed && providerFlowPassed && providerPlannerPassed && explorerPassed && gitPassed && editorPassed && terminalPassed && taskPreviewPassed && taskPreviewNoApprovalPassed && sourceRegistryPassed && sourceRegistryNoMutationPassed && contentPlanPassed && contentPlanNoMutationPassed && assetBriefPassed && assetBriefNoMutationPassed && artifactPassed && artifactNoMutationPassed && renderPolicyPassed && renderPolicyNoMutationPassed && memoryPassed && memoryNoMutationPassed && rootPickerPassed && streamReady ? 'DESKTOP_IPC_SMOKE=PASS' : 'DESKTOP_IPC_SMOKE=FAIL');
  };

  renderCode();
  renderProfile();
  subscribeToApprovalEvents();
  void loadPendingApprovals();
  void loadProviders();
  void loadSources();
  void loadAssets();
  void runDesktopSmoke();
})();
