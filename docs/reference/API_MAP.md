# API_MAP

## Application API الحالية

`FoundationUseCases.openWorkspace`, `createSession`, `startSession`, `requestApproval`, `resolveApproval`, `registerDeviceProfile`, `createPreview`, و`transitionPreview` هي أول use-case surface. تتلقى domain-safe inputs وتكتب إلى repository ports وتنشر domain events.

## Ports المخططة

AIProvider، ModelProvider، VoiceProvider، StorageProvider، GitProvider، GitHubProvider، SearchProvider، DocumentProvider، ImageProvider، VideoProvider، EmbeddingProvider، MemoryProvider، AgentRuntime، TerminalProvider، SimulatorProvider، AutomationProvider؛ التفاصيل في `docs/34-clean-architecture.md`.

## IPC المخطط

الرسائل هي `{protocolVersion, requestId, correlationId, method, payload}` مع schema validation. الأحداث `progress`, `approval_required`, `preview_event`, `log`, `error`, `result`. لا تُكشف Node APIs مباشرة إلى renderer. أصبح `preview.openProject` يمر عبر typed Electron preload تجريبي بواجهة `osamah.dispatch` وقناة allowlisted، مع root selection في مسار التطبيق وCSP/sandbox policy؛ production root picker وواجهة preload النهائية ما زالا لاحقين.

## Presentation API

يوجد الآن `renderPreviewNode` و`renderPreviewTree` في `src/presentation/preview-renderer.ts`. يستقبلان `PreviewRenderNode` فقط، ويعيدان HTML دلاليًا محدودًا أو يركبانه في target يملك `innerHTML`. يطبق renderer escaping، deterministic props، وdepth guard، ولا يقرأ ملفات أو يشغّل project code.

## API status

يوجد الآن typed IPC in-memory transport فعلي في `src/ipc/` مع protocol v1 وhandlers للمحاكي: `health.get`, `device.get`, `preview.start`, `preview.openProject`, `preview.input`, `preview.refresh`, `preview.capture`, `preview.inspect`, و`preview.stop`. كما تعرض `agent.catalog.list` و`agent.definition.get` عقد Agent Definition Catalog bounded للقراءة والمراجعة فقط، و`production.report.create` و`production.report.get` و`production.report.list` و`production.report.review` عقد ReportDocument المحلي القابل للتتبع؛ لا يبدأ أي منها agent execution أو provider invocation أو export/publish تلقائيًا أو approval ticket. يبني `preview.openProject` bundle من filesystem عبر `ProjectPreviewService` ثم يبدأ session ويعيد summary محدودًا. يقبل `preview.start/refresh` ProjectPreviewBundle، ويعيد `preview.inspect` source hash وmodule count وrender tree وevents/diagnostics. يوجد Electron main/preload تجريبي في `src/desktop/` يمرر الطلبات إلى نفس transport عبر `contextBridge` دون كشف `ipcRenderer`. يركب browser adapter في `prototypes/studio/preview-renderer.js` نفس الشجرة داخل `#previewTree`. لا توجد واجهة HTTP، ولا يزال root picker وpackaging production boundary مخططين. `createEmbeddedApplication` هو composition root الحالي.
