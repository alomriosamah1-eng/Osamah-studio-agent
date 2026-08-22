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
    const projectFileResponse = await window.osamah.dispatch({
      protocolVersion: 1,
      requestId: 'desktop-smoke-file-open',
      correlationId: 'desktop-smoke-explorer',
      method: 'file.openText',
      payload: { rootPath: 'fixtures/mobile-expo', relativePath: 'app/index.tsx' },
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
    const editorPassed = editorOpenResponse.ok && Boolean(editorOpenResponse.result?.sha256) && editorProposeResponse.ok && editorProposeResponse.result?.diffTruncated === false;
    console.log(response.ok && approvalFlowPassed && providerFlowPassed && providerPlannerPassed && explorerPassed && editorPassed && rootPickerPassed && streamReady ? 'DESKTOP_IPC_SMOKE=PASS' : 'DESKTOP_IPC_SMOKE=FAIL');
  };

  renderCode();
  renderProfile();
  subscribeToApprovalEvents();
  void loadPendingApprovals();
  void loadProviders();
  void runDesktopSmoke();
})();
