# سجل التغييرات

## [Unreleased] — Production Studio: Render Job Policy وValidation Preview

### Added

- `RenderPolicyPort` و`InMemoryRenderPolicy` لإصدار قرار bounded فوق `ArtifactDraft` مع format/adapter/budget/checks.
- قرارات `blocked` و`review_required` و`allowed_preview` مع low-memory bounds للمهلة والذاكرة والحجم والصفحات، وrelative destination guards.
- typed IPC method `production.render.policy.preview` مع fail-closed validation للصيغة والميزانية والوجهة، دون قبول command أو execute أو outputPath مطلق.
- Workspace Render Readiness panel لعرض القرار والمسار والميزانية والفحوص، مع `executionStarted: false` ودون renderer أو converter أو export.
- اختبارات Application وIPC وElectron smoke تثبت missing/blocked/incompatible/budget/destination handling وno-network/no-filesystem/no-mutation.
- توثيق القرار في `docs/73-production-render-policy-preview.md`.

### Verified

- `pnpm check`: `160/160` اختبارًا ناجحًا.
- `pnpm build` و`pnpm desktop:smoke` و`pnpm performance:smoke`: PASS؛ Render Policy blocked/no-execution smoke PASS.
- SQLite migration وJSON validation وsyntax و`git diff --check` وsecret scan: PASS.

### Boundaries

- هذه الشريحة policy preview فقط؛ لا render worker أو converter أو FFmpeg/ComfyUI أو output file أو export أو Human Gate ticket.
- `allowed_preview` يدل على اجتياز الفحص المحلي، ولا يعني نجاح render أو صلاحية artifact للنشر.

## [Unreleased] — Production Studio: Artifact Assembly وManifest Review

### Added

- `ArtifactAssemblyPort` و`InMemoryArtifactAssembly` لبناء draft assembly bounded من `ContentPlan` و`CreativeBrief` و`AssetCatalog`.
- `ArtifactManifest` يجمع claim/source/asset IDs بصورة deterministic، ويثبت `tools: []` لأن render/converter لم يُستدعَ.
- completeness guards لحالات `ready_for_render` و`needs_review` و`blocked`، مع منع claims غير المدعومة، citations المفقودة/غير الصالحة، والأصول المحظورة.
- typed IPC methods `production.artifact.draft.create` و`production.artifact.draft.get` وvalidators ترفض القوائم المكررة والـpayloads غير الصالحة.
- Workspace Artifact Review panel لعرض manifest وحالة المراجعة دون render أو export أو كتابة ملفات.
- اختبارات Application وIPC وElectron smoke تثبت deterministic manifest وblocked unresolved claims وno-network/no-converter/no-mutation وبقاء Human Gate بلا تذكرة جديدة.
- توثيق القرار في `docs/72-production-artifact-assembly-manifest.md`.

### Verified

- `pnpm check`: `155/155` اختبارًا ناجحًا.
- `pnpm build` و`pnpm desktop:smoke` و`pnpm performance:smoke`: PASS؛ Artifact Review وmanifest tools=0 PASS.
- SQLite migration وJSON validation وsyntax و`git diff --check` وsecret scan: PASS.

### Boundaries

- Artifact Assembly حاليًا in-memory وreview-only؛ لا render worker أو converter أو FFmpeg/ComfyUI أو object store أو signed manifest أو export.
- `ready_for_render` تعني اكتمال شروط المراجعة المحلية فقط، ولا تعني نجاح render أو صلاحية النشر أو تحقق حقوق الملكية.

## [Unreleased] — Production Studio: Asset Catalog وCreative Brief

### Added

- `AssetCatalogPort` و`CreativeBriefPort` مع `InMemoryAssetCatalog` bounded لتسجيل metadata للأصول وإنشاء briefs وربط asset IDs.
- license/provenance guards للـkind وlocator وhash/bytes وsource IDs وحالات `declared/unverified/verified/blocked`، مع منع attach للأصول المحظورة وتحذيرات صريحة للأصول غير الموثقة.
- typed IPC methods `production.asset.register` و`production.asset.list` و`production.brief.create` و`production.brief.get` و`production.brief.asset.attach` مع validators fail-closed.
- Workspace Asset Catalog وCreative Brief panels لعرض metadata والترخيص والـwarnings، دون binary fetch أو media generation أو converter أو assembly/render/export.
- اختبارات Application وElectron smoke تثبت deduplication ورفض locator/hash/bytes/source غير الصالحة وblocked asset، وتتحقق من no-network/no-mutation وبقاء Human Gate بلا تذكرة جديدة.
- توثيق القرار في `docs/71-production-asset-catalog.md`.

### Verified

- `pnpm check`: `150/150` اختبارًا ناجحًا.
- `pnpm build` و`pnpm desktop:smoke` و`pnpm performance:smoke`: PASS؛ Asset Catalog وCreative Brief metadata-only smoke PASS.
- SQLite migration وJSON validation وsyntax و`git diff --check` وsecret scan: PASS.

### Boundaries

- Asset Catalog وCreative Brief حاليًا in-memory وreview-only؛ لا object store أو binary ingestion أو provider generation أو FFmpeg/ComfyUI أو converter execution أو export.
- حالة license `verified` لا تعني منح حقوق تجارية، وsource/provenance warnings لا تتحول إلى FACT تلقائيًا.

## [Unreleased] — Production Studio: Content Plan وClaim/Citation Integrity

### Added

- `ContentPlan` و`ContentSection` و`ClaimRecord` و`ContentPlanPort` مع `InMemoryContentPlanService` bounded فوق `SourceRegistryPort`.
- typed IPC methods `production.plan.create` و`production.plan.get` و`production.plan.section.add` و`production.plan.claim.add` و`production.plan.citation.attach` مع validators للـbrief/IDs/sections/claims/confidence.
- Workspace Content Plan panel يعرض sections وclaims وsupported/unresolved/conflicted counts عبر DOM آمن، مع preview محلي لا يولد نصًا ولا ينفذ render أو export.
- claim/citation integrity deterministic: claim بلا citation يبقى `unresolved`، وcitation/source غير الصالحين يسببان `conflicted`، والـunverified يظهر كتحذير صريح.
- اختبارات Application وIPC وElectron smoke تثبت رفض citation المجهولة وduplicate attachment وmalformed payload وno-network/no-mutation.
- توثيق القرار في `docs/70-production-content-plan-citation-integrity.md`.

### Verified

- `pnpm check`: `146/146` اختبارًا ناجحًا.
- `pnpm build` و`pnpm desktop:smoke` و`pnpm performance:smoke`: PASS؛ Content Plan unresolved integrity وno-mutation smoke PASS.
- SQLite migration وJSON validation وsyntax و`git diff --check` وsecret scan: PASS.

### Boundaries

- Content Plan الحالي in-memory وreview-only؛ لا provider generation أو browser/network discovery أو converter/render/export أو SQLite persistence.
- `supported` تعني اكتمال ربط citation بمصدر معروف مع بقاء warnings، ولا تعني صحة claim علميًا أو قانونيًا.

## [Unreleased] — Production Studio: Source Registry وProvenance

### Added

- `SourceRegistryPort` و`SourceRecord` و`CitationRecord` و`ProvenanceLink` مع `InMemorySourceRegistry` bounded وdeduplication وSHA-256/bytes validation وverification states.
- typed IPC methods `production.source.register` و`production.source.list` و`production.citation.add` و`production.citation.list` و`production.provenance.list` مع fail-closed validators للـmetadata والـspans والحدود.
- Workspace Production Studio Sources panel لتسجيل مرجع الملف المحدد وعرض metadata/hash/citations عبر `textContent`، دون fetch أو upload أو export أو startup network.
- توثيق القرار المعماري ونتائج مراجع W3C PROV-DM وC2PA في `docs/69-production-studio-source-registry.md` و`research/production-provenance-findings-01.md`.

### Verified

- `pnpm check`: `141/141` اختبارًا ناجحًا.
- `pnpm build` و`pnpm desktop:smoke` و`pnpm performance:smoke`: PASS؛ Source Registry IPC وno-network/no-mutation desktop smoke PASS.
- SQLite migration وJSON validation وsyntax و`git diff --check` وsecret scan: PASS.

### Boundaries

- Source Registry الحالي in-memory وreview-only؛ لا توجد persistence SQLite للمصادر أو web crawling أو browser fetch أو C2PA signing أو key management أو artifact export.
- `verificationState` يصف حالة metadata/content validation فقط، ولا يثبت صحة claim أو citation قانونيًا أو علميًا.

## [Unreleased] — Project Context وAgent Task Review Panel

### Added

- `AgentTaskPreviewService` يربط `ProjectContextSnapshot` وtargeted reads مع `DeterministicPlannerCritic` افتراضيًا، ويتيح provider-backed planner فقط عند provider/model selection صريح.
- typed IPC method `task.preview` مع validators bounded للـroot والهدف والقيود والمسارات، ورفض traversal وmalformed payload قبل Application.
- Workspace Context/Agent Task Review panel يعرض context counters وtargeted metadata/hash مختصرًا والخطة والنقد باستخدام `textContent` و`replaceChildren`، دون patch أو command أو runtime أو approval ticket.
- اختبارات Application وIPC وElectron smoke تثبت no-mutation وno-approval، وتوثيق المعمارية في `docs/68-project-context-agent-task-review.md`.

### Verified

- `pnpm typecheck` و`pnpm test`: `136/136` اختبارًا ناجحًا.
- `pnpm build` و`pnpm desktop:smoke`: PASS؛ `DESKTOP_IPC_SMOKE=PASS` و`DESKTOP_SMOKE=PASS`.
- task.preview bounded context/target/plan/critique وtraversal rejection وno-mutation/no-approval: PASS.

### Boundaries

- task.preview review-only؛ لا ينشئ checkpoint أو Human Gate ticket ولا يستدعي WorkCycle أو patch apply أو terminal أو Git mutation.
- لا توجد provider/network/model calls من panel الافتراضي؛ Lightweight Web Preview وnative toolchains وProduction Studio وSecond Brain تبقى ضمن المراحل اللاحقة.

## [Unreleased] — Git Read-only Integration وRepository Boundary

### Added

- `GitReadOnlyPort` و`FilesystemGitReadOnlyAdapter` لقراءة branch/status/diff عبر `execFile` بوسائط منفصلة و`shell: false`.
- typed IPC methods `git.status` و`git.diff` مع canonical root وrelative path وoutput guards.
- Workspace Git panel بوضع read-only لعرض branch والحالة والتغييرات وdiff باستخدام `textContent` فقط.
- منع commit وpush وreset وcheckout وhooks وexternal diff من هذه الشريحة.
- توثيق الشريحة في `docs/67-git-read-only-integration.md`.

### Verified

- `pnpm check`: `130/130` اختبارًا ناجحًا.
- Git parsing وbounded diff وtruncation وnon-repository fallback وno-mutation وpath guards: PASS.
- `pnpm build` و`pnpm desktop:smoke` و`pnpm performance:smoke` وSQLite/JSON/diff/secret gates: PASS.

### Boundaries

- لا توجد قنوات `git.commit` أو `github.push` في renderer. أي mutation لاحقة تحتاج AgentAction وHuman Gate مستقلًا.

## [Unreleased] — Terminal Policy Preview وCommand Boundary

### Added

- `TerminalPolicyPort` و`BoundedTerminalPolicy` لتصنيف الأوامر محليًا مع `deny-by-default` وcommand digest bounded.
- رفض shell wrappers وshell metacharacters وnull bytes وcwd traversal وnative/toolchain/privileged/unknown commands دون spawn.
- typed IPC method `terminal.inspect` مع payload/resource guards، وربطه بالـcomposition والـElectron smoke.
- Workspace Terminal Policy panel بوضع Inspect only؛ لا يوجد `terminal.exec` أو PTY أو xterm.js أو process execution.
- توثيق الشريحة في `docs/66-terminal-policy-preview.md`.

### Verified

- `pnpm check`: `124/124` اختبارًا ناجحًا.
- policy classification وHuman Gate metadata وsecret display redaction وdeterministic digest وbounded input: PASS.
- `pnpm build` و`pnpm desktop:smoke` و`pnpm performance:smoke` وSQLite/JSON/diff/secret gates: PASS.

### Boundaries

- كل `read_only` command يحتاج Human Gate في القرار، ولا يعني `approval_required` أنه نُفذ. التعديل وtoolchains وnative والامتيازات والأوامر المجهولة مرفوضة.
- التنفيذ الفعلي يحتاج لاحقًا Terminal Worker مع process isolation وcancellation وresource admission وaudit.

## [Unreleased] — Safe Editor Document Boundary وDiff Preview

### Added

- `EditorDocumentPort` و`DocumentSnapshot` و`EditProposal` و`DiffLine` لعزل buffer المحرر وdiff عن Electron وfilesystem mutation.
- `InMemoryEditorDocumentStore` فوق safe reader مع revision وSHA-256 وstale-source conflict وbounded diff.
- typed IPC methods `editor.open` و`editor.propose` مع path/content/hash validators وhandlers وcomposition wiring.
- Workspace lightweight textarea buffer وPropose diff panel؛ التعديل يبقى في الذاكرة ولا توجد `editor.save` أو `apply` في هذه الشريحة.
- Electron smoke للتحقق من editor open/propose وno-mutation إلى جانب Project Explorer وHuman Gate.
- توثيق الشريحة في `docs/65-safe-editor-document-boundary.md`.

### Verified

- `pnpm check`: `117/117` اختبارًا ناجحًا.
- deterministic diff وline metadata وdiff cap وstale-hash conflict وpath/NUL/size guards: PASS.
- `pnpm build` و`pnpm desktop:smoke` و`pnpm performance:smoke` وSQLite/JSON/diff/secret gates: PASS.

### Boundaries

- لا توجد بعد `editor.save` أو patch apply أو Monaco أو LSP أو terminal worker أو Git write؛ كل mutation ما يزال خلف WorkCycle وHuman Gate.

## [Unreleased] — Development Environment: Project Explorer وBounded File Reader

### Added

- `ProjectExplorerPort` و`WorkspaceFileReaderPort` لعزل عرض بنية المشروع وقراءة النص عن Electron وNode APIs.
- `FilesystemProjectExplorer` بشجرة deterministic، تجاهل directories الثقيلة، truncation bounded، ومنع symlink entries.
- `FilesystemWorkspaceFileReader` بحدود UTF-8 والحجم وSHA-256 ورفض traversal وsymlink وbinary والملفات الحساسة الشائعة مثل `.env` و`credentials.json` وprivate keys.
- typed IPC methods `project.tree` و`file.openText` مع validators وhandlers وcomposition wiring.
- Workspace dynamic Project Explorer وفتح الملفات عبر DOM text nodes آمنة، مع fallback للـprototype خارج Electron.
- Electron smoke للتحقق من tree/file open إلى جانب root picker وHuman Gate، دون تشغيل scripts أو native toolchains أو network عند startup.
- توثيق الشريحة في `docs/64-development-environment-file-explorer.md`.

### Verified

- `pnpm check`: `111/111` اختبارًا ناجحًا.
- Project Explorer/File Reader contract tests وIPC path guards وsecret-name guards: PASS.
- `pnpm build` و`pnpm desktop:smoke` و`pnpm performance:smoke` وSQLite/JSON/diff/secret gates: PASS.

### Boundaries

- لا توجد بعد Monaco أو LSP أو terminal worker أو Git write أو test runner أو React Native Web/Metro parity؛ Lightweight Web Preview ما يزال مؤجلًا إلى آخر مراحل تصميم البيئة.

## [Unreleased] — Provider-backed Planner وWorkCycle

### Added

- `AsyncPlannerPort` و`LlmPlanner` و`ProviderBackedPlannerCritic` لطلب خطة من `ProviderGateway` عند غياب `plan`، مع JSON strict parsing وprompt/output bounds.
- `providerId` و`modelId` و`offlineMode` في WorkCycle وProviderInvocation contracts، مع منع fallback عند الاختيار الصريح وحفظ selection داخل snapshot ورفض تغييره أثناء resume.
- ربط composition بالـprovider-backed planner مع إبقاء provider registration اختياريًا وعدم إجراء network أو model loading عند startup.
- توسيع typed `workCycle.start` ليقبل plan اختياريًا واختيار provider/model bounded، مع Electron smoke يستخدم fixture provider فقط ويفحص عدم mutation.
- توثيق المعمارية والتنفيذ في `docs/63-provider-backed-planner-architecture.md`.

### Verified

- `pnpm check`: `105/105` اختبارًا ناجحًا.
- LlmPlanner routing وstrict JSON وProviderGateway explicit selection وWorkCycle plan-less generation وHuman Gate/resume guards: PASS.
- Electron desktop smoke وperformance وSQLite/JSON/diff/secret gates: PASS.

### Boundaries

- لا توجد streaming أو tool calling أو remote providers أو model discovery أو persistence مستقلة لإعدادات providers؛ Lightweight Web Preview ما يزال مؤجلًا إلى آخر مراحل تصميم البيئة.

## [Unreleased] — Typed Provider Configuration UI وIPC

### Added

- عقود `provider.list` و`provider.configure` و`provider.doctor` مع validators bounded للـIDs وloopback URLs والحدود منخفضة الذاكرة.
- ربط provider controls بـ`EmbeddedApplication` و`ProviderGateway` و`ProviderDoctor` و`BoundedProviderExecutionPolicy` مع عدم إجراء health probe أو model loading عند startup.
- لوحة Providers داخل Workspace تعرض metadata آمنة وحقول base URL/model وEnable وSave config وRun doctor دون إدخال raw IPC أو أسرار إلى renderer.
- توسعة desktop smoke لتدفق provider list → configure disabled → doctor disabled، وتوثيق التنفيذ في `docs/62-provider-configuration-ui-ipc.md`.

### Verified

- `pnpm check`: `98/98` اختبارًا ناجحًا.
- provider IPC validation/handlers، renderer DOM safety، disabled doctor، وno-network startup: PASS.
- Desktop IPC/root-picker/Human Gate وperformance وSQLite migration/JSON/diff/secret checks: PASS.

### Boundaries

- لا توجد persistence مستقلة للـprovider configuration أو model discovery أو streaming أو tool execution أو remote providers؛ التفعيل ما يزال صريحًا ومحليًا.

## [Unreleased] — Provider Policy وDoctor وQuota

### Added

- `LocalProviderConfig` و`BoundedProviderConfiguration` للتحقق من loopback URLs وmodel IDs وحدود low-memory ومنع configuration duplicates.
- `ProviderDoctorPort` و`LocalProviderDoctor` لإرجاع حالات `disabled` و`blocked` وhealth الفعلية مع latency دون probe تلقائي عند startup.
- `ProviderExecutionPolicy` و`BoundedProviderExecutionPolicy` لتقييد concurrency إلى واحد، وrate window، وcircuit closed/open/half-open.
- ربط admission وsuccess/failure/release داخل `ProviderGateway`، وإضافة `providerConfigs` و`providerDoctor` و`providerExecutionPolicy` إلى composition بصورة اختيارية.
- توثيق الشريحة في `docs/61-provider-policy-doctor-quota.md`.

### Verified

- `pnpm check`: `98/98` اختبارًا ناجحًا.
- configuration وdoctor وquota وcircuit وGateway admission وdisabled handling: PASS.
- Desktop IPC وperformance smoke وSQLite migration/JSON/diff/secret checks: PASS.

### Boundaries

- لا توجد persistence مستقلة للـprovider configuration أو model discovery أو streaming أو tool execution أو circuit persistence أو cross-process quota؛ لا يبدأ provider أو model تلقائيًا عند startup.

## [Unreleased] — Local Provider Adapters

### Added

- `LocalHttpProviderAdapter` المشترك مع loopback-only URL validation وHTTP status mapping وtimeout/cancellation وinput/output bounds.
- `OllamaProviderAdapter` لـ`/api/generate` و`/api/tags`، و`LlamaCppProviderAdapter` لـ`/v1/chat/completions` و`/health`.
- تسجيل providers اختياري في `createEmbeddedApplication({ providers })` دون health probe أو model loading عند startup، وتوثيق التنفيذ في `docs/60-local-provider-adapters.md`.

### Verified

- `pnpm check`: `98/98` اختبارًا ناجحًا.
- Ollama/llama.cpp mapping، malformed output، HTTP auth failure، model mismatch، timeout/cancellation، وloopback security: PASS.
- Desktop IPC وperformance smoke وSQLite migration/JSON/diff/secret checks: PASS.

### Boundaries

- لا يوجد model discovery أو streaming أو tool execution أو model download أو circuit persistence أو cross-process quota؛ الاتصالات لا تبدأ إلا عبر health/invoke صريحين وadmission policy.

## [Unreleased] — Planner وCritic Contracts

### Added

- `PlannerRequest` و`PlannerPort` و`CriticPort` و`PlannerCriticPort` لعزل تحويل intent والسياق عن التنفيذ.
- `DeterministicPlanner` و`BoundedPlanCritic` و`assertPlanAccepted` بخطوات مراجعة bounded وblocking/warning issues.
- ربط `AgentWorkCycleService` بمراجعة الخطة بعد targeted read وقبل patch preview أو إنشاء approval، مع رفض unsafe paths وduplicate steps وbyte mismatches fail-closed.
- توثيق التنفيذ في `docs/59-planner-critic-contracts.md` واختبارات integration تمنع mutation عند رفض Critic.

### Verified

- `pnpm check`: `98/98` اختبارًا ناجحًا.
- Desktop IPC smoke وWorkCycle approval flow بعد تحديث fixture بخطة صالحة: PASS.
- Planner/Critic bounded validation وfail-closed filesystem guard: PASS.

### Boundaries

- لا يوجد بعد LLM planner أو تخطيط متعدد الدورات أو persistence مستقلة للخطة؛ provider adapters المحلية موجودة لكن model discovery وstreaming وquota/circuit breaker الكامل ما زالت لاحقة، وتبقى النتائج خلف ProviderGateway ثم Critic وHuman Gate.

## [Unreleased] — Persistent Audit وHuman Gate

### Added

- migration `003_agent_audit.sql` بجدول `agent_audit_records` وفهارس bounded للوقت وcorrelation وsession وapproval، مع تحديث validator إلى schema `003`.
- migration `004_approval_tickets.sql` بجدول `approval_tickets` وقيود kind/risk/status وفهارس pending/session، مع تحديث validator إلى schema `004`.
- `SqliteAuditTrail` persistent adapter متوافق مع `AuditTrail`، وإعادة استخدام `InMemoryAuditTrail` لمسار memory الافتراضي.
- `sanitizeAuditText` مشترك يزيل token/secret/password/api-key/authorization/prompt/private-key من scope وreason قبل التخزين.
- `HumanGatePort` و`InMemoryHumanGate` مع `listPending` و`get` و`decide` وسياسة fail-closed للـIDs والقرارات المجهولة أو المعاد حلها.
- IPC methods typed جديدة: `approval.listPending` و`approval.decide`، مع tests لتدفق pending → decision → WorkCycle resume.
- `docs/55-persistent-audit-human-gate.md` واختبارات SQLite restart/redaction وHuman Gate policy.
- `ApprovalStore` و`InMemoryApprovalStore` و`SqliteApprovalStore` مع hydration bounded إلى `InMemoryApprovalWorkflow` عند فتح SQLite profile، وتوثيق `docs/56-approval-hydration.md`.
- عقد `IpcEvent` و`approval.changed`، قناة `osamah:approval-events`، وpreload `subscribe()` مع filter وunsubscribe.
- لوحة Human Gate داخل Workspace تعرض pending tickets حتى 8 عناصر وتنفذ Approve/Deny عبر typed `approval.decide`؛ وثيقة التنفيذ `docs/57-human-gate-ui-event-stream.md`.
- `AuditExportProvider` و`LocalAuditExportProvider` لإنشاء `audit.ndjson` وmanifest ذري مع SHA-256 وbyte count وredaction إضافي، مع منع destination داخل live profile.
- `AuditRetentionStore` و`BoundedAuditRetentionPolicy` بسياسة عمر محافظة من يوم إلى 365 يومًا وحد أقصى 256 سجلًا، دون حذف تلقائي عند الإقلاع؛ وثيقة التنفيذ `docs/58-audit-export-retention.md`.

### Verified

- `pnpm check`: `98/98` اختبارًا ناجحًا.
- SQLite migration validator: `MIGRATION_COUNT=4` و`SCHEMA_VERSION=004` و12 جدولًا و24 index entry.
- persistent audit redaction/restart وHuman Gate pending/approved/denied/invalid: PASS.
- approval event contract وdesktop smoke لتدفق WorkCycle → pending → decide → renderer callback: PASS.
- Audit Export NDJSON/manifest/redaction/destination safety وRetention age/count/fail-safe: PASS.

### Boundaries

- multi-user identity وRBAC والتشفير وsigned/tamper-evident export ما زالت مؤجلة. Planner/Critic وHuman Gate UI وapproval event streaming وapproval ticket hydration وAudit Export وRetention Policy أصبحت منفذة bounded؛ لا تُدّعى crash-resumability لــWorkCycle checkpoint نفسه.

## [Unreleased] — Typed Agent WorkCycle IPC Boundary

### Added

- methods typed جديدة: `context.index` و`workCycle.start` و`workCycle.inspect` و`workCycle.cancel` عبر `IpcMethodMap` وقناة `osamah:dispatch` الحالية.
- runtime payload validation للـIDs وpaths وconstraints وplan وpatch operations وexpected SHA وtimeout قبل وصول الطلب إلى Application handlers.
- IPC handlers مربوطة بـ`FilesystemProjectContextIndex` و`AgentWorkCycleService`، مع approval resume وcheckpoint/apply وcancel قبل mutation.
- contract tests للـcontext وWorkCycle lifecycle وmalformed payloads وduplicate/unknown requests، وتوثيق `docs/54-agent-work-cycle-ipc.md`.

### Verified

- `pnpm check`: `73/73` اختبارًا ناجحًا.
- sender validation و`contextIsolation` و`sandbox` وCSP تبقى كما هي؛ لا توجد قناة raw filesystem أو terminal أو provider invocation للrenderer.

### Boundaries

- preload surface ما زال `dispatch` typed و`chooseProjectRoot` فقط؛ Human Gate UI وevent streaming وpersistent cycle state وplanner/critic مؤجلة.

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
