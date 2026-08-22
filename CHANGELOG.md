# سجل التغييرات

## [Unreleased] — Project Preview Runtime

### Added

- `ProjectPreviewBundle` و`FixturePreviewRuntime` لبناء وتشغيل معاينة bounded من file map مع module graph وsource hash وrender tree وdiagnostics.
- ربط `EmbeddedSimulatorController` وtyped IPC بعمليات `preview.start` و`preview.refresh` و`preview.inspect` مع تمرير bundle وحالة runtime.
- `FilesystemProjectScanner` بقراءة root/manifest/source محدودة، ومنع path traversal وتجاهل symlinks والمجلدات المولدة، دون تشغيل scripts من مشاريع الهاتف.
- `FilesystemProjectPreviewService` لاختيار entry من manifest أو fallback معروف وبناء bundle من مشروع موجود على disk.
- Expo fixture واختبارات contract تغطي filesystem scanner وProjectPreviewService.
- وثيقتا العقد والتنفيذ `docs/41-project-preview-runtime.md` و`docs/42-project-preview-runtime-implementation.md`.

### Verified

- `pnpm check`: نجاح typecheck و`17/17` اختبارًا.
- المسار يظل compatibility/fixture mode ولا يدعي native fidelity أو Metro HMR حقيقيًا.

## [Unreleased] — Discovery

### Added

- Gap analysis شامل من GAP-001 إلى GAP-060.
- بحث موثق عن React Native وExpo وMetro وFast Refresh وReact Native Web وExpo Snack وAndroid Emulator وiOS Simulator وHermes وReact Native Debugging.
- Clean Architecture contracts وDomain entities/events وApplication use cases وin-memory adapters.
- Foundation tests deterministic وpackage/TypeScript foundation.
- Mobile development architecture وEmbedded Simulator architecture/implementation docs.
- Embedded Studio Workspace prototype يدمج editor/file tree/simulator/Inspector/console.
- `EmbeddedSimulatorController` مع device profiles وinput/refresh/capture/inspect/stop.
- typed IPC protocol v1 وin-memory transport وhandlers واختبارات malformed/unknown/duplicate requests.
- SQLite migration schema contract وvalidator قابل لإعادة التشغيل.
- Mobile development architecture و16 living reference maps تحت `docs/reference/`.
- `PROJECT_STATE.md` و`AI_CONTINUATION.md` و`docs/WORK_LOG.md`.
- خط أساس للمستودع يثبت أنه كان فارغًا وقت البدء.
- مصادر خام وتحليل أولي لـ OpenCode وHermes Agent وOmniRoute وDeepSeek Harness.
- metadata لـ 44 مشروعًا مفتوح المصدر مرشحًا.
- منظومة وثائق `docs/00` إلى `docs/30`.
- متطلبات وظيفية وغير وظيفية، معمارية، أمن، أداء، UX، صوت، routing، ذاكرة، أتمتة، CI/CD، تراخيص، مخاطر، roadmap، وAI handoff.
- قرار مؤقت باستخدام modular desktop monolith وElectron في MVP مع OpenTo adapter غير مفعّل.

### Verified

- تم دفع commit خط الأساس إلى فرع `main` والتحقق من المرجع البعيد.

### Not yet implemented

- لا يوجد تطبيق runtime أو schema أو workflows فعلية بعد.
- لم يُحسم OpenTo Desktop.

إعداد: Manus AI.
