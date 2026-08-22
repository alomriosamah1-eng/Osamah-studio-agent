# التقرير النهائي — Osamah Studio Agent

## الخلاصة

تم تنفيذ البرومبت الجديد على مستودع `Osamah Studio Agent` من حالة وثائقية بلا runtime إلى **Foundation slice قابل للاختبار** مع **محاكي هاتف مدمج داخل Workspace** و**typed IPC** و**SQLite adapter وobservability وbackup/restore bounded**. أضيفت profile path policy وexclusive lock لمسار SQLite المخصص للـprofiles، مع إبقاء التطبيق lightweight وmemory default عند عدم طلب persistence. ثم أضيفت عقود Provider وApproval وProviderGateway bounded مع default-deny وoffline/local-first routing. أضيفت بعدها نواة Agent Work Cycle وProject Context Index وFilesystemPatchAdapter لقراءة context موجهة وتنفيذ patch محمي قبل checkpoint/apply. ثم أضيفت typed application/IPC boundary لعمليات `context.index` و`workCycle.start` و`workCycle.inspect` و`workCycle.cancel` مع runtime payload validation. وأضيف Persistent Audit عبر migration 003 و`SqliteAuditTrail`، مع Human Gate bounded و`approval.listPending` و`approval.decide` وredaction/restart contracts. ثم أضيف `ApprovalStore` وmigration 004 و`SqliteApprovalStore` لإعادة hydration لتذاكر الموافقة bounded بعد restart مع منع duplicate decisions. وأضيف Human Gate UI داخل Workspace وقناة `approval.changed` typed من main إلى renderer مع preload subscribe وdesktop smoke end-to-end. ثم أضيف `AuditExportProvider` و`LocalAuditExportProvider` و`BoundedAuditRetentionPolicy` لتصدير NDJSON ذري bounded وحذف محافظ age/count دون purge تلقائي عند الإقلاع. ثم أضيفت `PlannerPort` و`CriticPort` و`PlannerCriticPort` وربطت بـ`AgentWorkCycleService` قبل patch preview وapproval. ثم أضيفت `LocalHttpProviderAdapter` و`OllamaProviderAdapter` و`LlamaCppProviderAdapter` مع تسجيل اختياري في composition. ثم أضيفت `LocalProviderConfig` و`BoundedProviderConfiguration` و`LocalProviderDoctor` و`BoundedProviderExecutionPolicy` وربط admission وcircuit بـ`ProviderGateway`. ثم أضيفت typed provider configuration UI/IPC لعقود `provider.list` و`provider.configure` و`provider.doctor` ولوحة Providers داخل Workspace مع Save config وRun doctor. ثم أضيفت `AsyncPlannerPort` و`LlmPlanner` و`ProviderBackedPlannerCritic` لتوليد خطة bounded عبر `ProviderGateway` عند غياب `plan`، مع provider/model/offline selection typed، ومنع fallback عند الاختيار الصريح، وحماية Human Gate وresume consistency. ثم أضيفت أول شريحة من Development Environment العامة: `ProjectExplorerPort` و`WorkspaceFileReaderPort` و`project.tree` و`file.openText`، مع شجرة Workspace ديناميكية وقراءة نص آمنة bounded تمنع traversal وsymlink وbinary والحجم وأسماء secrets الشائعة. ثم أضيفت `EditorDocumentPort` و`DocumentSnapshot` و`EditProposal` و`InMemoryEditorDocumentStore` مع `editor.open` و`editor.propose` وbounded diff وstale-hash conflict، وربطها بbuffer خفيف وdiff panel في Workspace دون mutation.
 المحاكي المدمج أصبح جزءًا من بيئة التطوير نفسها إلى جانب شجرة الملفات والمحرر والـ Inspector والـ Console. لم يُدّعَ اكتمال Desktop MVP أو Android Emulator أو iOS Simulator؛ هذه المسارات ما تزال adapters وخططًا لاحقة بحدود واضحة.

أُغلقت شريحة SQLite محليًا خلف ports مستقلة: `node:sqlite` / `DatabaseSync`، migration runner بــchecksums، repositories وpersistent event bus، structured observability مع redaction، وbackup/restore بــmanifest وSHA-256 وmigration dry-run على profile منفصل. أضيف `sqlite-profile` بمسارات `studio.sqlite` و`.profile.lock` و`backups/`، ورفض profile IDs غير الآمنة، وقفل حصري يطلق عند close أو initialization failure. أضيفت طبقة Provider/Approval وProviderGateway مع fixture adapters دون network أو model loading تلقائي. أضيفت Persistent Audit وHuman Gate مع schema 003 وredaction وrestart readback وfail-closed decisions، ثم ApprovalStore وhydration مع schema 004. أضيفت بعدها Human Gate UI وقناة `approval.changed` typed مع preload subscribe وdesktop smoke end-to-end، ثم Audit Export وRetention Policy، ثم Planner/Critic deterministic bounded، ثم local Ollama وllama.cpp adapters فوق fetch مع loopback-only وtimeout/cancellation وtyped output، ثم provider configuration وdoctor وquota/circuit policy، ثم Typed Provider Configuration UI/IPC مع desktop smoke list/configure-disabled/doctor-disabled، ثم provider-backed Planner/WorkCycle مع Electron smoke لتوليد plan-less عبر fixture provider دون mutation، ثم Project Explorer/File Reader مع Electron smoke لـtree وfile open، ثم Safe Editor Document Boundary مع Electron smoke لـeditor open/propose وno-mutation، ثم Terminal Policy Preview مع `terminal.inspect` وتصنيف deny-by-default وWorkspace Inspect-only وno-process smoke. full gate للشريحة الحالية ناجح؛ delivery قيد commit/push.

المستودع: [alomriosamah1-eng/Osamah-studio-agent](https://github.com/alomriosamah1-eng/Osamah-studio-agent).

## ما نُفّذ

| المجال | الناتج |
|---|---|
| Gap Analysis | تحليل 65 فجوة مرقمة من التنفيذ والبنية والأمن والأداء والموبايل والاختبارات والتوثيق |
| Clean Architecture | Domain وApplication وInfrastructure contracts مستقلة عن UI وOS وvendor |
| Domain | IDs، errors، Workspace، AgentSession، Approval، DeviceProfile، PreviewSession، state transitions، domain events |
| Application | `FoundationUseCases` لإنشاء workspace/session/approval/device profile/preview وإدارة الانتقالات |
| Mobile detector | اكتشاف Expo وReact Native دون تشغيل scripts، مع كشف Metro والمجلدات native وweb support |
| Platform capabilities | مصفوفة تمنع ادعاء iOS Simulator أصلي على Windows/Linux وتبقي lightweight preview متاحًا |
| Preview adapter | contract للتشغيل والتفاعل والتدوير واللقطات، مع in-memory adapter قابل للاختبار |
| Prototype بصري | `prototypes/mobile-preview/index.html` بثلاثة profiles، إطار جهاز، Inspector، rotate، theme، refresh، screenshot |
| Embedded Workspace | `prototypes/studio/index.html` يدمج شجرة الملفات والمحرر والمحاكي والـ Inspector والـ Console |
| Embedded controller | `EmbeddedSimulatorController` يدعم start/input/refresh/capture/inspect/stop |
| Project Preview Runtime | `ProjectPreviewBundle` و`FixturePreviewRuntime` مع module graph وsource hash وrender tree وdiagnostics |
| Filesystem integration | `FilesystemProjectScanner` و`FilesystemProjectPreviewService` يقرآن root/manifest/entry بحدود آمنة دون تشغيل scripts |
| Presentation renderer | `src/presentation/preview-renderer.ts` يحول `PreviewRenderNode` إلى HTML دلالي محدود مع escaping وdepth guard، وbrowser adapter مدمج داخل Workspace |
| Typed IPC | protocol v1 وin-memory transport وhandlers مع duplicate/unknown/malformed guards |
| SQLite adapter وmigration | `node:sqlite` / `DatabaseSync`، migrations 001/002/003/004، repositories، event bus، checksums، transactions، validator |
| Observability | `SqliteObservabilitySink` و`InMemoryObservabilitySink` مع structured logs وrecursive redaction وbounded listing |
| Backup وRestore | `LocalSqliteBackupProvider` مع atomic `VACUUM INTO` snapshot وmanifest وSHA-256 وforeign-key validation وmigration dry-run وrestore profile |
| Profile Storage | `resolveProfilePaths` و`validateProfileId` و`FileProfileLock` و`sqlite-profile` composition مع release idempotent |
| Provider وApproval | `AgentActionRequest` و`ApprovalTicket` و`AuditTrail` و`submitGuarded` مع default-deny وmatching approval |
| Provider Gateway | `ProviderManifest` و`ProviderAdapter` وcapability/privacy/offline routing وlocal-first وhealth/fallback وidempotency guard |
| Agent Work Cycle | `ProjectContextIndex` وtargeted read وcaller-supplied plan وpatch preview وapproval وcheckpoint وrevalidate/apply |
| Patch Safety | `FilesystemPatchAdapter` مع canonical root وtraversal/symlink/duplicate/expected-SHA guards وstaged file replacement |
| Typed WorkCycle IPC | methods `context.index` و`workCycle.start` و`workCycle.inspect` و`workCycle.cancel` عبر `IpcMethodMap` وقناة dispatch مع payload validation، واختيار provider/model/offline bounded |
| Persistent Audit وHuman Gate | `SqliteAuditTrail` و`agent_audit_records` schema 003، `sanitizeAuditText`، `HumanGatePort`، approval pending/decide وrestart/redaction tests |
| Human Gate UI وevent stream | `IpcEvent` و`osamah:approval-events` وpreload `subscribe` وWorkspace pending panel وApprove/Deny handlers وdesktop smoke callback |
| Provider-backed Planner/WorkCycle | `AsyncPlannerPort` و`LlmPlanner` وstrict JSON parsing وexplicit provider selection وplan-less WorkCycle وresume/Human Gate guards وElectron fixture smoke |
| Safe Editor Document Boundary | `EditorDocumentPort` و`DocumentSnapshot` و`EditProposal` وbounded diff وstale-hash conflict و`editor.open`/`editor.propose` typed IPC وWorkspace buffer وno-mutation boundary |
| Terminal Policy Preview | `TerminalPolicyPort` و`BoundedTerminalPolicy` و`terminal.inspect` typed IPC وclassification وdeny-by-default وsecret display redaction وWorkspace Inspect-only وno-process boundary |
| CI | GitHub Actions لتثبيت lockfile وتشغيل typecheck/test وJSON validation وdiff hygiene |
| Knowledge system | 16 reference maps، `PROJECT_STATE.md`، `PROJECT_STATUS.md`، `AI_CONTINUATION.md`، و`docs/WORK_LOG.md` |
| Review | مراجعات مستقلة للمعمارية والأمن والأداء والتراخيص وUX والموبايل والـ AI والوثائق وGitHub |

## البحث التقني

تم تثبيت قرارات Mobile Preview على مصادر رسمية ومراجع مفتوحة متعددة. يوضح [React Native Web](https://necolas.github.io/react-native-web/docs/) طبقة التوافق بين React DOM وReact Native، وتوضح [Expo](https://docs.expo.dev/develop/development-builds/introduction/) أن development builds هي المسار المناسب عند الحاجة إلى native configuration. كما يثبت [Fast Refresh](https://reactnative.dev/docs/fast-refresh) و[Metro](https://docs.expo.dev/guides/why-metro/) مسار التحديث والتجميع المعتاد.

يُستخدم [Expo Snack](https://github.com/expo/snack) و[reactnative.run](https://www.reactnative.run/) كمراجع معمارية للـ browser preview فقط. أما Android Emulator فيحتاج graphics/VM acceleration وفق [توثيق Android](https://developer.android.com/studio/run/emulator-acceleration)، وiOS Simulator متاح ضمن macOS/Xcode وفق [توثيق Apple](https://developer.apple.com/documentation/safari-developer-tools/installing-xcode-and-simulators). لذلك لا يساوي Lightweight Preview محاكيًا native ولا يعلن نجاح native modules.

## الاختبارات والفحوص

نجحت جميع الاختبارات الحالية، بما فيها اختبارات deterministic لمسارات profile والقفل الحصري وإعادة فتح profile بعد `close()`، وContext Index وAgent Work Cycle وpatch safety.
 يغطي الاختبار فتح workspace وإنشاء session والأحداث، approval lifecycle، رفض الانتقالات غير القانونية، DeviceProfile، preview lifecycle، اكتشاف Expo وReact Native، platform capability matrix، preview orientation/screenshot contract، bundle/runtime، blocked imports، filesystem scanner، ProjectPreviewService، Presentation renderer semantic mapping/escaping/depth guard، وIPC project open وpath traversal guard.

| الفحص | النتيجة |
|---|---|
| `pnpm install --frozen-lockfile` | ناجح |
| `pnpm typecheck` | ناجح |
| `pnpm test` | `124/124` ناجحة |
| `pnpm check` | ناجح |
| SQLite migration validation | `SQLITE_MIGRATION_VALID=true`، migration count `4`، schema `004`، 12 tables، 24 index entries |
| SQLite restart/backup contracts | repositories وevent bus وobservability وtransactions وchecksum mismatch وbackup/restore وtampering ناجحة |
| `git diff --check` | ناجح |
| JSON validation | ناجح لكل `project/*.json` |
| secret scan | PASS |
| direct dependency license review | TypeScript Apache-2.0، tsx MIT، @types/node MIT |
| `node --check prototypes/studio/preview-renderer.js` | ناجح |
| browser prototype | تم التحقق من render tree وفتح settings وrotate وFast Refresh داخل embedded panel |
| GitHub push verification | آخر push مكتمل `18b980a4e3b76de01e919c959a5771e8a67475a9`؛ Terminal Policy Preview مدفوعة ومتحقق منها |

## GitHub والتسليم

| الوصف | SHA |
|---|---|
| تنفيذ Foundation وMobile Preview | `3e81421a03713dc433d61d4957ec013226e5008f` |
| مراجعة القرارات والاعتماديات | `d9e6e0c06cab9aee63e337d85db8469b9cc35a41` |
| تحديث الحالة والـ handoff النهائي | `2fd2c219072d8d186460a5c02b7c70545b447cb8` |
| Embedded Simulator + typed IPC + migration | `c2d9797ea1745c9901f69b1cd0eee07e1d323bc8` |
| Project Preview Runtime + filesystem scanner/service | feature commit `cc4a35d3f621e5ab6f79e386cc9a1760e970f063`; delivery/docs push verified at `5431527feab7b45d41ff9c96802f0aebfbe25849` |
| Presentation renderer | `df53c8cd32b5e35c25488171bdca5241770146b3`؛ final delivery state at `bce549bb675ee6d0f2c83f950a5c9aae987c61d7` |
| IPC Project Open | `preview.openProject` يبني bundle من filesystem ويبدأ session؛ delivery state متحقق في `c1b1613a92515b5daa186137ad48f37844834878` |
| Electron Shell + Typed Preload | `src/desktop/` و`desktop:smoke`؛ 23/23 tests؛ startup/preload/IPC smoke ناجح؛ delivery state `2a0e891b544324ff06f18ad461282527af987a13` |
| Master Implementation Plan | `docs/45-master-implementation-plan.md` و`project/master-implementation-plan.json`؛ phases 0–17 للأقسام الثلاثة؛ delivery state `0f1010462c6297e274c66b9c99ed38404272df5d` |
| SQLite Adapter + Observability + Backup/Restore | `node:sqlite` adapter، migration 002، repositories، event bus، observability redaction، atomic backup/restore؛ delivery state `0c51c1e00726afa798182ade0e6dc16ab627eba7`، local وremote متطابقان |
| Lightweight Web Preview + Resource Governance | `ProjectKind`، React/React Native general detection، source/module/asset limits، low-memory policy، latest-only refresh، bounded agent runtime؛ `performance:smoke` ناجح تحت V8 heap 768MB؛ delivery `b9089efee33a174c3958a9295853623beae27503` |
| Production Root Picker | main-process `dialog.showOpenDialog` بخاصية `openDirectory`، typed preload، trusted sender، canonical path validation، وroot-picker desktop smoke؛ delivery `197424dc6cbc1f02b92011903f5bbce77e819f6c` |
| Optional SQLite Composition | `createEmbeddedApplication({ storage })` مع memory default، SQLite opt-in، restart persistence، explicit fallback، idempotent close، وUUID event IDs؛ delivery `e9a892a42e394b92e4708847f01eafc9205b70ae` |
| Profile Path Policy + Exclusive Lock | `sqlite-profile`، مسارات profile قياسية، unsafe-ID rejection، قفل `wx` حصري، ownership-token release، واختبارات composition lifecycle؛ delivery `e8c4ecca95dd51659b30d62f740c1f67ca5701ff`، local == `origin/main` |
| Provider وApproval Contracts + ProviderGateway | default-deny، guarded queue، approval matching، route capability/privacy/offline/local-first، fallback bounded، malformed-output validation، وmutation idempotency؛ delivery `c833f0e9c37cfaa1800aa9fcc300881984ab6878`، local == `origin/main` |
| Agent Work Cycle + Project Context Index | context inventory وtargeted SHA وapproval resume وcheckpoint/apply وdenial/conflict/no-op وpatch safety؛ delivery `fb5d93ec87939125373dd8c450d1195af50fc911`، local == `origin/main` |
| Typed Agent WorkCycle IPC | context index وstart/resume/inspect/cancel وmalformed payload validation وduplicate protection؛ delivery `786ea0b888634742936f546431c4d1e7251495e0`، local == `origin/main` |
| ApprovalStore وhydration | schema 004 وfull ticket round-trip وpending hydration وduplicate prevention وdecision persistence بعد restart؛ delivery `fd248891cc5cd68818cc5fa13319bc2a133a2565`، local == `origin/main` |
| Human Gate UI وevent stream | `IpcEvent` و`osamah:approval-events` وWorkspace Human Gate panel وsmoke callback؛ delivery `0b5acbf136d168fb43312379f44846c1075c802f`، local == `origin/main` |
| Audit Export وRetention Policy | `audit.ndjson` وmanifest وSHA/redaction/destination safety وage/count bounded purge؛ delivery `5cf3d03605215ee2160473afee4c77585f0e9f61`، local == `origin/main` |
| Planner وCritic Contracts | deterministic plan وblocking/warning critique وWorkCycle no-mutation guard؛ delivery `a946ad2c168d1d0c8ee3812c4c26a6bb0b61d912`، local == `origin/main` |
| Local Provider Adapters | Ollama/llama.cpp health/invoke mapping وloopback security وHTTP errors وtimeout/cancellation وoptional startup registration؛ delivery `c18b6befcaf82acc4679f9ed72899659d00d6a11`، local == `origin/main` |
| Provider Policy/Doctor/Quota | configuration وdisabled/blocked/healthy doctor وconcurrency/rate/circuit وGateway admission؛ delivery `8be5293f29c8e2c520cd422a54226d9f7f31128a`، local == `origin/main` |
| Typed Provider Configuration UI/IPC | provider.list/configure/doctor validators وhandlers وWorkspace panel وElectron smoke وno-network startup؛ delivery `cb70b17f1b5d9350e22855bf8da98efd0f8eb226`، local == `origin/main` |
| Provider-backed Planner/WorkCycle | LlmPlanner وprovider/model/offline selection وstrict JSON وplan-less generation وHuman Gate/resume guards وElectron fixture smoke؛ delivery `358e339e52f1a07e95c5e266f18bd37ba36072e3`، local == `origin/main` |
| Development Environment: Project Explorer/File Reader | `ProjectExplorerPort` و`WorkspaceFileReaderPort` وfilesystem adapters bounded و`project.tree`/`file.openText` typed IPC وWorkspace dynamic tree وsafe DOM text rendering؛ delivery `a72b2c7b85bf4abc934be638aa911577a20547ab`، local == `origin/main` |
| Persistent Audit وHuman Gate | schema 003 وSqliteAuditTrail وredaction/restart وpending/decide fail-closed؛ delivery `ca7460d6c36ad64d98298d2e383d68e661f0869c`، local == `origin/main` |

تم التحقق من `pnpm check` بـ111/111، و`pnpm build` و`pnpm desktop:smoke` مع `DESKTOP_ROOT_PICKER_SMOKE=PASS` و`DESKTOP_IPC_SMOKE=PASS`، و`pnpm performance:smoke` وSQLite migration 004 وbackup/restore وredaction وrestart وHuman Gate وApprovalStore hydration وapproval event callback وAudit Export NDJSON/manifest/redaction/destination safety وRetention age/count وPlanner/Critic no-mutation guard وLlmPlanner strict JSON/provider routing وProject Explorer/File Reader ordering/hash/size/binary/symlink/secret guards وOllama/llama.cpp mapping/health/loopback/timeout وprovider configuration/doctor/quota/circuit وtyped provider list/configure/doctor/tree/file.openText وcomposition opt-in/no-network-startup وprofile lock lifecycle وProvider/Approval/route tests وContext/WorkCycle/Patch tests وIPC contract tests و`git diff --check` وJSON validation وsecret scan. full gate لشريحة Project Explorer/File Reader ناجح، ودفع GitHub قيد الإغلاق.
 شريحة الأداء السابقة مدفوعة عند `b9089efee33a174c3958a9295853623beae27503`، root picker عند `197424dc6cbc1f02b92011903f5bbce77e819f6c`، وSQLite composition عند `e9a892a42e394b92e4708847f01eafc9205b70ae`، مع تطابق local و`origin/main`.

## الخطة التنفيذية المعتمدة

الخطة الرئيسية في `docs/45-master-implementation-plan.md` هي مصدر التنفيذ للنسخ القادمة. تبدأ بـ typed Electron preload وSQLite/observability وpolicy/security، ثم Agent Runtime وProvider Gateway، ثم Development Environment وProduction Studio وSecond Brain، ثم Voice وAutomation والتكاملات والأداء وCI/CD وBeta Release. النسخة JSON المقابلة تحفظ الاعتماديات وبوابات الخروج وMVP والميزات المؤجلة بطريقة قابلة للآلة.

## الحدود الحالية

يوجد الآن Electron shell أولي وtyped preload boundary مع CSP وsender validation وdesktop smoke، وproduction root picker منفذ عبر main-process dialog وcanonical validation ومدفوع عند `197424dc6cbc1f02b92011903f5bbce77e819f6c`. SQLite adapter مربوط اختياريًا بـ`createEmbeddedApplication` مع memory default وrestart persistence وexplicit fallback، ومسار `sqlite-profile` يطبق profile path policy وprofile locking الحصري. Provider/Approval وProviderGateway وAgent Work Cycle وContext Index وtyped WorkCycle IPC وPersistent Audit وHuman Gate وApproval hydration وHuman Gate UI وapproval event streaming وAudit Export/Retention وPlanner/Critic وlocal Ollama/llama.cpp adapters وprovider configuration/doctor/quota وTyped Provider Configuration UI/IPC وProvider-backed Planner/WorkCycle وProject Explorer/File Reader وSafe Editor Document Boundary وTerminal Policy Preview منفذة كـapplication/desktop slices bounded فقط؛ لا توجد بعد persistence مستقلة لإعدادات providers أو model discovery أو streaming أو tool execution أو circuit persistence أو cross-process quota أو تشفير أو key management أو backup UX متكامل.
 أضيف BoundedAgentRuntime وProviderGateway وApprovalWorkflow وAgentWorkCycle وPlanner/Critic وlocal provider adapters كـapplication slices bounded؛ لا يوجد بعد model discovery أو quota/circuit breaker الكامل أو terminal sandbox أو Metro process adapter أو Android doctor/ADB أو iOS Xcode adapter.
 المحاكي المدمج الحالي Lightweight Web/Fixture Preview مع `nativeFidelity: compatibility`، وليس React Native native renderer أو Metro runtime حقيقيًا. `preview.openProject` يعمل عبر in-memory typed IPC خلف Electron preload تجريبي، وليس production boundary النهائي بعد. OpenTo Desktop ما يزال `UNKNOWN / REQUIRES VALIDATION` لعدم وجود source رسمي قابل للتحقق.

## الخطوة التقنية التالية

بعد إغلاق شريحة Terminal Policy Preview، الخطوة التقنية التالية هي Git/read-only integration وفق الترتيب المعتمد، مع إبقاء provider persistence وstreaming وtool execution وLightweight Web Preview ضمن المراحل اللاحقة.
 يأتي backup UX وencryption/key management عند الحاجة، مع إبقاء استكمال Lightweight Web Preview إلى آخر مراحل تصميم البيئة.
 لا يبدأ Android/iOS native قبل استقرار هذه الحدود وdoctor/resource contracts وقياسات الموارد، ولا تُشغّل scripts من مشاريع الهاتف تلقائيًا.


للتسليم إلى وكيل أو مهندس لاحق، ابدأ بقراءة `AI_CONTINUATION.md` ثم `PROJECT_STATE.md` ثم `docs/36-foundation-implementation-plan.md`.

إعداد: Manus AI. تاريخ التحديث: 2026-08-22. آخر delivery: `18b980a4e3b76de01e919c959a5771e8a67475a9`؛ Terminal Policy Preview مدفوعة ومتحقق منها، local == `origin/main`.
