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
    line.innerHTML = `<span class="${kind}">[event]</span> ${message}`;
    $('log').appendChild(line);
    $('log').scrollTop = $('log').scrollHeight;
    $('footerText').textContent = message;
  };

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
  $('approve').onclick = () => { log('ApprovalRequested: change scope=workspace', 'warn'); $('footerText').textContent = 'Approval required before agent edit'; };

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
    console.log(response.ok ? 'DESKTOP_IPC_SMOKE=PASS' : 'DESKTOP_IPC_SMOKE=FAIL');
  };

  renderCode();
  renderProfile();
  void runDesktopSmoke();
})();
