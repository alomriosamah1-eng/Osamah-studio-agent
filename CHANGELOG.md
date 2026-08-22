# سجل التغييرات

## [Unreleased] — Agent Work Cycle وProject Context Index

### Added

- `FilesystemProjectContextIndex` لفهرسة الملفات والـmanifests وGit status وقراءة targeted bounded مع SHA-256، دون تشغيل project scripts.
- `GitStatusAdapter` يستخدم `git status --porcelain=v1 --branch` عبر `execFile` دون shell.
- `AgentWorkCycleService` بتسلسل request → context → targeted read → caller-supplied plan → patch preview → approval → checkpoint → revalidate → apply.
- `FilesystemPatchAdapter` مع canonical root وpath traversal/symlink guards وduplicate checks وexpected SHA وstaged atomic file replacement.
- `Checkpoint` و`InMemoryCheckpointStore` وDomainEvents لمراحل WorkCycle، مع composition exports لدورة الوكيل وpatch/context adapters.
- `docs/53-agent-work-cycle.md` واختبارات `src/project-context.test.ts` و`src/agent-work-cycle.test.ts` و`src/filesystem-patch.test.ts`.

### Verified

- `pnpm check`: `71/71` اختبارًا ناجحًا.
- دورة approval ثم checkpoint ثم apply، denial، conflict، no-op checkpoint، وpatch safety: PASS.
- full static/build/desktop/performance gates: PASS؛ `DESKTOP_SMOKE=PASS` و`PERF_SMOKE=PASS` وmigration/JSON/diff/secret checks PASS.

### Boundaries

- لا يوجد planner أو critic أو LLM inference تلقائي؛ الخطة يقدّمها caller حاليًا.
- لا يوجد persistent project index أو checkpoint restore أو terminal/Git write adapter أو editor UI؛ التعديلات محصورة في patch contract المحلي.

## [Unreleased] — Provider وApproval Contracts

### Added

- typed `AgentActionRequest` و`AgentAuthorizationDecision` و`ApprovalTicket` و`AuditRecord` لفصل فعل الوكيل عن runtime وpolicy.
- `InMemoryApprovalWorkflow` بسياسة default-deny للأفعال الحساسة، وapproval-required قبل queue، وmatching approval عند الاستئناف، وbounded audit trail دون prompt input.
- `BoundedAgentRuntime.submitGuarded()` الذي يرفض guarded actions قبل إدخالها إلى الطابور عند غياب الموافقة أو authorization port.
- typed `ProviderManifest` و`ProviderAdapter` و`ProviderInvocationRequest/Response` و`ProviderRouteDecision` وroute audit.
- `ProviderGateway` بفلترة capability/privacy/offline، local-first ordering، health checks، bounded fallback، malformed-output validation، وmutation idempotency guard.
- `FixtureProviderAdapter` و`InMemoryProviderRouteAudit` لاختبارات deterministic بلا شبكة أو تحميل model weights أو تشغيل process خارجي.
- composition exports لـ`approvalWorkflow` و`auditTrail` و`providerGateway` و`providerRouteAudit`، مع بقاء gateway registry فارغًا عند الإقلاع.
- `docs/52-provider-approval-contracts.md` واختبارات `src/approval-workflow.test.ts` و`src/provider-gateway.test.ts`.

### Verified

- `pnpm check`: `63/63` اختبارًا ناجحًا.
- `pnpm build` و`pnpm desktop:smoke`: `DESKTOP_SMOKE=PASS` و`DESKTOP_IPC_SMOKE=PASS`.
- `pnpm performance:smoke`: `PERF_SMOKE=PASS` مع `low_memory` وpreview `11.56ms` وRSS delta `3MB` تقريبًا تحت V8 heap 768MB.
- SQLite migration validator وJSON validation وdiff hygiene وsecret scan: PASS.

### Boundaries

- لا يوجد remote provider أو Ollama/llama.cpp adapter أو model loading تلقائي؛ ProviderGateway يعمل بلا providers إلى أن يُسجل adapter صريح.
- approval tickets وaudit trail الحالية in-memory؛ persistence hydration وHuman Gate UI وquota/circuit breaker الكامل خطوات لاحقة.

## [Unreleased] — Profile Path Policy وExclusive Lock

### Added

- `resolveProfilePaths` لمسارات profile قياسية deterministic تحت `userDataDirectory/profiles/<profileId>` مع database وlock وbackups paths.
- `validateProfileId` لرفض traversal والمسافات ومعرّفات profile غير الآمنة، ورفض filesystem root كـuser-data root.
- `FileProfileLock` بقفل حصري `wx` و`ProfileLockedError` typed وmetadata محدودة وrelease يتحقق من ownership token ويعمل idempotently.
- `sqlite-profile` storage composition التي تربط profile paths وexclusive lock بدورة SQLite، وتطلق lock عند `close()` أو فشل initialization/fallback.
- `docs/51-profile-path-policy.md` و`src/profile-storage.test.ts` واختبار composition lifecycle للقفل وإعادة الفتح.

### Verified

- `pnpm check`: `53/53` اختبارًا ناجحًا.
- profile path tests وexclusive-lock/release lifecycle وcomposition lock lifecycle: PASS.
- `pnpm typecheck`: PASS.

### Boundaries

- لا يوجد stale-lock cleanup تلقائي أو تشفير أو key management في هذه الشريحة؛ recovery الصريح أكثر أمانًا من حذف lock حي.
- `sqlite` raw path يبقى مدعومًا للتوافق، بينما `sqlite-profile` هو المسار الذي يفرض policy والقفل. لا تُشغّل project scripts أو native toolchains تلقائيًا.

## [Unreleased] — Optional SQLite Composition

### Added

- optional `storage` options في `createEmbeddedApplication` مع `memory` default و`sqlite` opt-in.
- profile lifecycle صريح مع `storageKind` و`close()` idempotent، دون فتح SQLite أو WAL عند عدم طلبه.
- fallback إلى in-memory فقط عند `allowFallback: true`، مع `storageFallbackReason` واضح، وfail-closed عند تعطيل fallback.
- restart persistence test عبر نفس SQLite profile، وإغلاق الاتصال عند فشل initialization أو migration لمنع resource leak.
- توليد UUID لـ`domain_events.event_id` لتجنب collision عند إعادة تشغيل composition.
- `docs/50-optional-sqlite-composition.md` و`src/composition.test.ts` لتوثيق واختبار lifecycle.

### Verified

- `pnpm check`: `53/53` اختبارًا ناجحًا.
- `pnpm performance:smoke`: PASS مع `low_memory` وبدون تغيير preview budgets.
- `pnpm desktop:smoke`: PASS، وSQLite migration validator وJSON validation وsecret scan PASS.

### Boundaries

- SQLite opt-in حاليًا؛ `sqlite-profile` يفرض مسار profile وقفلًا حصريًا، بينما encryption وbackup UX المتكامل وkey management تبقى خطوات لاحقة.
- لا يبدأ التطبيق SQLite أو workers أو local models تلقائيًا، ولا يتحول migration checksum failure إلى نجاح صامت.

## [Unreleased] — Production Root Picker

### Added

- typed `window.osamah.chooseProjectRoot()` خلف `contextBridge` مع قناة allowlisted منفصلة `osamah:choose-project-root`.
- main-process `dialog.showOpenDialog` بخاصية `openDirectory` فقط، مع trusted sender وworkspace URL validation.
- canonical root validation عبر `realpath` و`stat` وdirectory check، مع نتائج typed للإلغاء والاختيار والخطأ دون تسريب filesystem messages إلى renderer.
- زر `Open Project` داخل Workspace لا يشغّل project scripts أو Metro/Expo أو native toolchains تلقائيًا، وdeterministic root-picker desktop smoke.
- `docs/49-production-root-picker.md` و`src/root-picker.test.ts` لتوثيق العقد واختبارات cancel/invalid/non-directory.

### Verified

- `pnpm check`: `47/47` اختبارًا ناجحًا.
- `pnpm desktop:smoke`: `DESKTOP_ROOT_PICKER_SMOKE=PASS` و`DESKTOP_IPC_SMOKE=PASS` و`DESKTOP_SMOKE=PASS`.
- `node --check` للـ Workspace/preload و`git diff --check` اجتازا بعد إغلاق الشريحة.

### Boundaries

- root picker يختار مجلدًا فقط ولا يفتح المشروع أو يشغّل أي script تلقائيًا؛ فتح/preview المشروع يبقى contract منفصلًا ومقيّدًا بالـ budgets.
- لا يكشف preload `ipcRenderer` أو Node APIs إلى renderer، ولا يعلن root picker native simulator fidelity.

## [Unreleased] — Lightweight Web Preview وResource Governance

### Added

- `ProjectKind` و`PreviewCapability` و`GeneralProjectDetector` لدعم React Native وReact والويب والمشاريع العامة دون تشغيل project scripts تلقائيًا.
- low-memory `ResourcePolicy` لأجهزة Ubuntu ذات RAM 8GB: جلسة preview واحدة، agent job واحد، source/modules/assets/warnings budgets، وagent history bounded.
- hard limits داخل Web preview، وlatest-only refresh queue، و`BoundedAgentRuntime` مع cancellation وcooperative timeout وqueue/history limits.
- embedded controller يرفض native transports غير المتاحة ويعلن `nativeFidelity: compatibility` بدل native fidelity زائفة.
- `scripts/performance-smoke.mjs` و`pnpm performance:smoke` لقياس preview وheap/RSS تحت V8 heap 768MB.
- `docs/48-lightweight-preview-and-resource-policy.md` و`research/lightweight-preview-sources.txt` لتوثيق القرار والمراجع الرسمية.

### Verified

- `pnpm check`: `44/44` اختبارًا ناجحًا.
- `pnpm performance:smoke`: `PERF_SMOKE=PASS`؛ low-memory، React Native → lightweight_web، preview حوالي 10–13ms، heap delta حوالي 0.3MB، RSS delta حوالي 3.4MB.
- `python3 -m json.tool project/master-implementation-plan.json`: `JSON_VALID=true`.

### Boundaries

- Web Preview يعرض React وReact Native compatibility فقط؛ لا يشغل Metro/Expo/native modules ولا يدعي native fidelity.
- Android Emulator وiOS Simulator transports اختيارية وليست dependency للإقلاع، ولا يبدأ native toolchain قبل doctor/resource contracts.
- performance smoke دليل مسار صغير bounded وليس ضمانًا مطلقًا لكل جهاز أو لكل مشروع؛ يجب استمرار benchmark على ملفات ومشاريع أكبر.

## [Unreleased] — SQLite Adapter وObservability وBackup/Restore

### Added

- `node:sqlite` / `DatabaseSync` adapter خلف `SqlExecutor`، مع migrations مرتبة وchecksum fail-closed وtransactions وWAL وforeign-key enforcement.
- migration `002_observability.sql` لجداول `device_profiles` و`preview_sessions` و`observability_logs` والفهارس الخاصة بها، مع schema version `002`.
- `SqliteRepositories` لـ Workspace وSession وApproval وDeviceProfile وPreviewSession، و`SqliteEventBus` persistent إلى `domain_events`.
- `SqliteObservabilitySink` و`InMemoryObservabilitySink` مع bounded listing وrecursive redaction لمفاتيح الأسرار.
- `LocalSqliteBackupProvider` لإنشاء snapshot atomic عبر `VACUUM INTO`، وmanifest مع SHA-256، وverify، وmigration dry-run، وrestore إلى profile منفصل.
- `src/sqlite.test.ts` يغطي migration order وchecksum mismatch وrestart persistence وrepositories وevents وredaction وtransactions وbackup/restore والتلاعب بالـ checksum.
- `docs/47-sqlite-adapter-implementation.md` وvalidator محدّث في `scripts/validate_sqlite_migration.py`.

### Verified

- `pnpm check`: `31/31` اختبارًا ناجحًا.
- `python3 scripts/validate_sqlite_migration.py`: `SQLITE_MIGRATION_VALID=true`، migration count `2`، schema `002`.
- backup/restore وforeign-key validation وmigration dry-run وsecret redaction اختُبرت محليًا.
- commit `0c51c1e00726afa798182ade0e6dc16ab627eba7` دُفع إلى `origin/main`، وتطابق local وremote SHA.

### Boundaries

- لا تزال wiring النهائية لـSQLite داخل `createEmbeddedApplication` وproduction root picker ضمن الشريحة التالية.
- لا يدعي الـ embedded simulator native fidelity؛ ما زال compatibility/fixture mode، ولا تُشغّل مشاريع الهاتف أو scripts أو native toolchains تلقائيًا.

## [Unreleased] — Electron Shell and Typed Preload

### Added

- Electron main process وBrowserWindow مع `contextIsolation` و`sandbox` و`nodeIntegration=false` و`webSecurity=true`.
- typed preload API بواجهة `osamah.dispatch` وقناة IPC allowlisted دون كشف `ipcRenderer` إلى renderer.
- CSP وsender/frame URL validation وnavigation/window/permission policies.
- `pnpm build` و`pnpm desktop:smoke` للتحقق من startup وpreload و`preview.openProject` عبر fixture فعلي.
- نقل Workspace runtime من inline script إلى `prototypes/studio/workspace.js` لدعم `script-src 'self'`.
- وثيقة `docs/46-electron-shell-and-preload-implementation.md`.

### Verified

- `pnpm check` ناجح؛ اختبارات security الجديدة ناجحة.
- `pnpm desktop:smoke`: `DESKTOP_SMOKE=PASS` و`DESKTOP_IPC_SMOKE=PASS`.

## [Unreleased] — Master Implementation Plan

### Added

- `docs/45-master-implementation-plan.md` كخطة تنفيذ شاملة للأقسام الثلاثة، المعمارية، العقود، المراحل 0–17، بوابات القبول، المخاطر، والإصدارات.
- `project/master-implementation-plan.json` كنسخة قابلة للآلة للمراحل والاعتماديات وMVP وسياسة إعادة استخدام المشاريع المفتوحة المصدر.
- مصفوفة reuse تصنف المشاريع إلى `USE` و`ADAPT/WRAP` و`OPTIONAL` و`REFERENCE/LEGAL REVIEW` و`CONTRACT ONLY`.

## [Unreleased] — IPC Project Open

### Added

- method typed IPC باسم `preview.openProject` يستقبل projectId/rootPath/deviceProfileId ويدعم entry/mode اختياريًا.
- حقن `FilesystemProjectPreviewService` في composition root لبناء bundle قبل تشغيل `EmbeddedSimulatorController`.
- response summary محدود يتضمن session وprojectId وentry وsourceHash وmoduleCount وwarningCount.
- اختبارات تكامل تفتح fixture فعليًا عبر IPC، وتفحص bundle/inspect، وترفض entry الذي يتجاوز root.
- وثيقة `docs/44-ipc-project-open-implementation.md`.

### Verified

- `pnpm check`: نجاح typecheck و`21/21` اختبارًا.
- لا يتم تشغيل project scripts أو native toolchains، وentry traversal مرفوض قبل بدء الجلسة.

## [Unreleased] — Presentation Renderer

### Added

- `src/presentation/preview-renderer.ts` لتحويل `PreviewRenderNode` إلى HTML دلالي محدود قابل للتركيب داخل embedded simulator.
- escaping آمن للنصوص والخصائص، deterministic attribute ordering، وحد أقصى لعمق شجرة العرض.
- browser adapter في `prototypes/studio/preview-renderer.js` ودمجه في `prototypes/studio/index.html`.
- إعادة تركيب المعاينة عند فتح ملف، Run، وتطبيق Fast Refresh مع بقاء المحاكي وInspector وConsole داخل Workspace.
- `docs/43-presentation-renderer-implementation.md` و`research/presentation-renderer-visual-check.txt`.

### Verified

- `pnpm check`: نجاح typecheck و`19/19` اختبارًا.
- `node --check prototypes/studio/preview-renderer.js` و`git diff --check` وsecret scan ناجحة.
- تحقق بصري من render tree، فتح `settings.tsx`، rotate، وFast Refresh داخل اللوحة المدمجة.

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
