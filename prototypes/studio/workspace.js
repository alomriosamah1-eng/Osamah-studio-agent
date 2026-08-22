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
  const $ = (id) => document.getElementById(id);

  const renderCode = () => {
    $('code').innerHTML = (codeByFile[currentFile] || ['// file preview unavailable'])
      .map((line, index) => `<span class="code-line"><span class="ln">${String(index + 1).padStart(2, ' ')}</span>${line.replace(/(import|export|return|default|function|const)/g, '<span class="kw">$1</span>').replace(/(View|Text|StyleSheet|DeviceStatus|Card|Stack)/g, '<span class="fn">$1</span>').replace(/('.*?')/g, '<span class="str">$1</span>')}</span>`)
      .join('');
    $('path').textContent = `app/${currentFile}`;
    $('tabName').innerHTML = `${currentFile} <small>●</small>`;
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
        $('projectState').textContent = `root selected: ${rootName}`;
        $('rightStatus').textContent = 'Project root selected';
        log(`project.root_selected ${rootName}`, 'ok');
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
  document.querySelectorAll('.file').forEach((button) => {
    button.onclick = () => {
      document.querySelectorAll('.file').forEach((fileButton) => fileButton.classList.remove('active'));
      button.classList.add('active');
      currentFile = button.dataset.file;
      renderCode();
      renderPreview();
      log(`file.opened ${currentFile}`);
    };
  });
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
        plan: { summary: 'Request approval.', steps: [] },
        patch: { proposalId: 'desktop-smoke-patch', operations: [{ relativePath: 'app/index.tsx', mode: 'update', content: '// desktop smoke only\\n' }] },
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
    console.log(response.ok && approvalFlowPassed && rootPickerPassed && streamReady ? 'DESKTOP_IPC_SMOKE=PASS' : 'DESKTOP_IPC_SMOKE=FAIL');
  };

  renderCode();
  renderProfile();
  subscribeToApprovalEvents();
  void loadPendingApprovals();
  void runDesktopSmoke();
})();
