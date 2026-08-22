# حالة مشروع Osamah Studio Agent

## ملخص الحالة

بدأ المستودع كحزمة وثائقية، ثم أصبح Foundation قابلًا للاختبار مع **Lightweight Web Preview مدمج داخل Workspace**، وtyped IPC، وProject Preview Runtime، وPresentation Renderer، وElectron shell معزولة. اكتملت شريحة SQLite adapter وobservability وbackup/restore bounded، وأضيفت Resource Policy وGeneral Project Detection وBoundedAgentRuntime مع إبقاء native emulators اختيارية، ثم profile path policy وexclusive lock لمسار SQLite المخصص للـprofiles، ثم Provider وApproval contracts وProviderGateway bounded، ثم Agent Work Cycle وProject Context Index وFilesystemPatchAdapter، ثم typed WorkCycle IPC boundary، ثم Persistent Audit وHuman Gate وApproval hydration، ثم Human Gate UI وapproval event streaming، ثم Planner/Critic وLocal Provider Adapters وProvider Policy/Doctor/Quota وTyped Provider Configuration UI/IPC وProject Explorer/File Reader وSafe Editor Document Boundary وTerminal Policy Preview وGit Read-only Integration وContext وAgent Task Review Panel وProduction Studio Source Registry وProvenance وContent Plan وClaim/Citation Integrity وAsset Catalog وCreative Brief وArtifact Assembly وManifest Review وRender Job Policy وValidation Preview وSecond Brain Memory Capture وKnowledge Entry Review وMemory Review وExplicit Confirmation، ثم التدقيق الشامل وAgent Definition Contract وBounded Agent Catalog، ثم ReportDocument وBounded Traceable Reporting، ثم Arabic-first Application Settings وControl Center. أُنجزت بعد ذلك دراسة Virtual Human / AI Avatar كوثائق وبحث ومعمارية فقط؛ لا Avatar Runtime أو Audio Runtime أو TTS/STT أو Wake Word أو Desktop Overlay منفذ.

| البند | الحالة |
|---|---|
| المستودع | `https://github.com/alomriosamah1-eng/Osamah-studio-agent` |
| آخر commit تنفيذي سابق | `0c51c1e00726afa798182ade0e6dc16ab627eba7` (`feat: add sqlite adapter and observability`) |
| آخر commit الأداء السابق | `b9089efee33a174c3958a9295853623beae27503` (`feat: add lightweight preview and resource governance`) |
| آخر commit root picker السابق | `197424dc6cbc1f02b92011903f5bbce77e819f6c` (`feat: add production root picker`) |
| حالة SQLite composition الحالية | opt-in wiring منفذة ومدفوعة ومتحقق منها عند `e9a892a42e394b92e4708847f01eafc9205b70ae` |
| حالة الشجرة | Memory Review مغلقة عند feature `4f1709cd927b77627c4532ec396f572f3bbedb2c` وdocs-close مستقل متحقق. Audit documentation feature/docs-close متحققان عند `7ede715dfbd8f9e4d030848573b11e94790ba580` و`f0c3d86c329f45335cd22cc1465ba673435fea87`. Agent Catalog feature/docs-close متحققان عند `56eebb97267c1e5979ea2e53c9f3fa9ec988d192` و`bc6c9ea3bf430e9586307390e0843fa5fe7c0b5d`. ReportDocument feature/docs-close متحققان عند `24144c4f2495354b5d2d8a5a880192dc251173ff` و`56db328b51b42b64ea59830979df3e262d126237`. Settings feature `d9a746c7deecb38488a5f632599be16c48c8e8cb` دُفع وتحقق local==remote؛ docs-close توثيقي مستقل لهذه التسليمة |
| الإصدار المحلي | `0.6.0`؛ لا يوجد bump إصدار release في هذه الشريحة |
| آخر فحص مكتمل | `pnpm check` ناجح، `181/181` اختبارًا؛ `pnpm build` و`pnpm desktop:smoke` و`pnpm performance:smoke` وSQLite/JSON/diff/secret gates ناجحة، وSettings IPC/Electron smoke ناجح في 2026-08-22 |
| schema الحالي | migrations `001` ثم `002` ثم `003` ثم `004`، schema version `004` |
| SQLite driver | `node:sqlite` / `DatabaseSync` من Node.js 22.13، بلا dependency native إضافية |
| خطة التنفيذ | `docs/45-master-implementation-plan.md` و`project/master-implementation-plan.json`؛ 18 مرحلة مرتبة |
| دراسة Virtual Human | docs `84–86` وresearch metadata؛ `DOCUMENTED ONLY / DEFERRED`، commit الدراسة `d47294ed613090bc913ee14d68669621febbccbb` متحقق local==remote، owner decision مطلوب |
| المحاكي المدمج | جزء من Workspace إلى جانب file tree/editor/Inspector/Console؛ compatibility/fixture mode فقط |
| Android native | transport مستقبلي اختياري؛ يحتاج SDK/JDK/AVD/acceleration وdoctor contract |
| iOS native | transport مستقبلي اختياري؛ macOS/Xcode فقط، ولا يظهر متاحًا أصليًا على Windows/Linux |
| OpenTo | `UNKNOWN / REQUIRES VALIDATION` |

## ما اكتمل

تمت مراجعة المستودع والوثائق السابقة وإنشاء خرائط المراجع وتحليل الفجوات وخطة التنفيذ الشاملة. أضيفت طبقات Domain وApplication وInfrastructure وPresentation، مع entities وstate transitions وdomain events وuse cases وin-memory adapters واختبارات deterministic.

اكتملت شرائح Mobile Preview وEmbedded Simulator وProject Preview Runtime وPresentation Renderer وIPC Project Open. يقرأ scanner المشروع من root مقيد، ويبني bundle، ويفتح embedded session، ويرفض path traversal، ولا يشغل scripts أو `postinstall` أو native toolchains من مشاريع الهاتف.

اكتملت شريحة Electron Shell وTyped Preload مع `contextIsolation` و`sandbox` وCSP وsender validation وdesktop smoke. يمر `preview.openProject` عبر boundary typed، وأضيف production root picker عبر main-process dialog وtyped preload وcanonical validation، بينما wiring النهائية للتخزين ما زالت ضمن الخطوات التالية.

أضيف SQLite adapter كامل في `src/infrastructure/sqlite.ts`، وmigration `002_observability.sql`، وعقود `SqlExecutor` و`ObservabilitySink` و`BackupProvider`. تحفظ repositories الحالية entities في SQLite، ويكتب event bus الأحداث إلى `domain_events`، ويسجل observability payloads بعد redaction recursive.

أضيفت شريحة الأداء الخفيف: `ProjectKind` و`PreviewCapability` و`GeneralProjectDetector` للمشاريع العامة، low-memory `ResourcePolicy`، hard limits للـ preview، latest-only refresh، و`BoundedAgentRuntime` بconcurrency واحد وqueue/history bounded وtimeout/cancellation تعاونيين. لا تشغل هذه الشريحة project scripts أو native toolchains عند الإقلاع.

أضيفت typed provider configuration UI/IPC: `provider.list` و`provider.configure` و`provider.doctor` مع loopback وlow-memory validators، وربط provider controls في composition، ولوحة Providers في Workspace تعرض metadata آمنة وتنفذ Save config وRun doctor. توسع desktop smoke إلى list → configure disabled → doctor disabled دون network.

أضيفت شريحة Context وAgent Task Review: `AgentTaskPreviewService` يقرأ snapshot وtargeted files bounded، ويستخدم deterministic planner/critic افتراضيًا، ولا يستخدم provider إلا عند اختيار صريح مع dependency provider-backed. أضيف `task.preview` إلى typed IPC مع رفض traversal والقيود غير الصالحة قبل Application، وربطت Workspace لوحة تعرض counters وmetadata/hash مختصرًا والخطة والنقد، دون patch أو command أو runtime أو approval ticket.

أضيفت شريحة Production Studio Source Registry وProvenance: `SourceRegistryPort` و`InMemorySourceRegistry` وسجلات source/citation/provenance، وtyped IPC للتسجيل والقوائم، وWorkspace Sources panel تعرض metadata وhash وcitations عبر DOM آمن. التسجيل محلي bounded وdeduplicated؛ لا fetch أو upload أو export تلقائي، و`verificationState` لا يثبت صحة claim.

أضيفت شريحة Content Plan وClaim/Citation Integrity: `ContentPlanPort` و`InMemoryContentPlanService` وsections/claims وintegrity counters، وtyped IPC لإنشاء الخطة وإضافة claims وربط citation IDs، وWorkspace panel تعرض supported/unresolved/conflicted دون توليد أو render أو export. claim بلا citation يبقى unresolved، وinvalid evidence يسبب conflicted.

أضيفت شريحة Asset Catalog وCreative Brief: `AssetCatalogPort` و`CreativeBriefPort` و`InMemoryAssetCatalog` لتسجيل metadata وlicense/provenance وإنشاء briefs وربط asset IDs، مع typed IPC وWorkspace panels metadata-only. تُرفض locators وhash/bytes وsource IDs غير الصالحة، ويُمنع attach للأصول المحظورة، دون binary fetch أو media generation أو converters أو filesystem mutation.

أضيفت شريحة Artifact Assembly وManifest Review ثم Render Job Policy وValidation Preview، مع manifest completeness وقرارات review وlow-memory format/destination guards وtyped IPC وWorkspace Artifact/Render Readiness panels، دون render أو export أو converter أو output file. ثم أضيفت شريحة Second Brain Memory Capture وKnowledge Entry Review مع `MemoryCapturePort` و`InMemoryMemoryCapture`، redaction وsource provenance وlocal search، وprivacy defaults `private`/`never`/`session`؛ لا embeddings أو FTS أو provider sharing أو autosave دائم. ثم أضيفت Memory Review وExplicit Confirmation عبر `MemoryReviewPort` وانتقالات `review_required` إلى `confirmed` أو `archived`، وreview reason/reviewedAt، وtyped IPC وWorkspace queue؛ confirmation محلي لا يثبت صحة خارجية ويحافظ على privacy fields، ولا ينشئ approval ticket أو provider call أو filesystem mutation.
أضيفت شريحة Artifact Assembly وManifest Review ثم Render Job Policy وValidation Preview مع manifest completeness وحالات review bounded وlow-memory budget/format/destination guards وtyped IPC وWorkspace Artifact/Render Readiness panels، دون render أو export أو converter أو output file، و`executionStarted: false` دائمًا.

أضيف provider-backed planning: `AsyncPlannerPort` و`LlmPlanner` و`ProviderBackedPlannerCritic`، واختيار `providerId`/`modelId`/`offlineMode` في WorkCycle وIPC. الاستجابة JSON strict ومحدودة، وprovider selection الصريح يمنع fallback، بينما تبقى الكتابة خلف Human Gate و`submitGuarded`. Electron smoke يثبت plan-less generation عبر fixture provider وعدم mutation.

أضيفت أول شريحة من Development Environment العامة: `ProjectExplorerPort` و`WorkspaceFileReaderPort` وfilesystem adapters bounded، typed `project.tree` و`file.openText`، وشجرة Workspace ديناميكية تعرض النص عبر DOM nodes آمنة. تشمل الحماية traversal وsymlink وbinary والحجم وأسماء secrets الشائعة، دون كتابة أو scripts أو native toolchains.

أضيف production root picker من خلال `chooseProjectRoot` في main process وtyped preload وقناة allowlisted وcanonical path validation. زر Workspace يطلب directory فقط ويعرض حالات cancel/error/selected دون تشغيل المشروع تلقائيًا، واختبر المسار عبر `DESKTOP_ROOT_PICKER_SMOKE=PASS`.

أضيف optional SQLite composition wiring: `createEmbeddedApplication({ storage })` يبقي memory default، ويفتح SQLite فقط عند opt-in، ويدعم restart persistence وfallback صريحًا و`close()` idempotent. عولجت event ID collision المحتملة باستخدام UUID وإغلاق الاتصال عند initialization failure.

أضيفت profile path policy وexclusive lock: `sqlite-profile` يحسب مسارات `studio.sqlite` و`.profile.lock` و`backups/` تحت profile آمن، ويرفض IDs غير الآمنة والجذر، ويمنع فتح profile نفسه مرتين، مع release idempotent عند close أو initialization failure.

أضيف `LocalSqliteBackupProvider` الذي ينشئ snapshot atomic عبر `VACUUM INTO`، ويكتب manifest مع SHA-256، ويتحقق من schema وforeign keys وmigration dry-run على نسخة مؤقتة، ويستعيد إلى profile منفصل دون overwrite للقاعدة الحية.

## المعمارية الحالية

الطبقات هي **Domain → Application → Interface Adapters → Infrastructure → Presentation**. يعرف Domain وApplication ports وعقودًا مجردة فقط؛ أما `node:sqlite` ومسارات الملفات وWAL و`VACUUM INTO` فمحصورة في Infrastructure. يوجد `InMemoryObservabilitySink` للحفاظ على سرعة اختبارات Application.

المحاكي المدمج الحالي compatibility/fixture mode، ولا يساوي React Native native runtime أو Metro HMR أو native module fidelity. Android Emulator وiOS Simulator transports اختيارية مستقبلية تغذي نفس اللوحة المدمجة، ولا يبدأ تنفيذها قبل استقرار doctor/resource contracts.

## الفحوص الحالية

| الفحص | النتيجة |
|---|---|
| `pnpm typecheck` | ناجح |
| `pnpm test` | `165/165` ناجحة |
| `pnpm check` | ناجح |
| `pnpm performance:smoke` | ناجح؛ low_memory، React Native → lightweight_web، preview حوالي 11ms، heap delta حوالي 0.3MB، RSS delta حوالي 3.1MB، تحت V8 heap 768MB |
| `python3 scripts/validate_sqlite_migration.py` | ناجح؛ migration count `4`، schema `004`، 12 جدولًا، 24 index entries |
| SQLite repositories | round-trip وrestart persistence ناجحان |
| event bus وobservability | persistence وredaction وbounded listing ناجحة |
| backup/restore | manifest وSHA-256 وforeign-key validation وmigration dry-run وtampering tests ناجحة |
| `git diff --check` | ناجح |
| secret scan | `SECRET_SCAN=PASS` |
| desktop smoke | `DESKTOP_ROOT_PICKER_SMOKE=PASS` و`DESKTOP_SMOKE=PASS` و`DESKTOP_IPC_SMOKE=PASS`؛ task.preview وContent Plan وAsset Catalog/Creative Brief وArtifact Assembly وRender Policy وMemory Capture/Review no-mutation PASS |
| composition SQLite | opt-in/restart/fallback/close lifecycle PASS؛ delivery `e9a892a42e394b92e4708847f01eafc9205b70ae` |
| profile storage | deterministic paths وunsafe-ID rejection وexclusive lock وidempotent release وcomposition reopen PASS؛ delivery `e8c4ecca95dd51659b30d62f740c1f67ca5701ff`، local == `origin/main` |
| provider/approval | default-deny وguarded queue وapproval matching وlocal-first/offline/fallback/idempotency/route audit PASS؛ delivery `c833f0e9c37cfaa1800aa9fcc300881984ab6878`، local == `origin/main` |
| agent work cycle | context inventory وtargeted SHA وapproval resume وcheckpoint/apply وdenial/conflict/no-op وpatch safety PASS؛ delivery `fb5d93ec87939125373dd8c450d1195af50fc911`، local == `origin/main` |
| persistent audit/Human Gate | schema 003 وSqliteAuditTrail وscope/reason redaction وrestart وpending/decide fail-closed PASS؛ delivery `ca7460d6c36ad64d98298d2e383d68e661f0869c`، local == `origin/main` |
| approval hydration | schema 004 وApprovalStore وSQLite round-trip وpending hydration وduplicate prevention وdecision persistence PASS؛ delivery `fd248891cc5cd68818cc5fa13319bc2a133a2565`، local == `origin/main` |
| typed workcycle IPC | context index وstart/resume/inspect/cancel وruntime payload validation وduplicate protection PASS؛ delivery `786ea0b888634742936f546431c4d1e7251495e0`، local == `origin/main` |
| Human Gate UI/event stream | `approval.changed` contract وpreload filter/unsubscribe وWorkspace panel وdesktop smoke callback PASS؛ delivery `0b5acbf136d168fb43312379f44846c1075c802f`، local == `origin/main` |
| Audit Export/Retention | NDJSON/manifest/SHA/redaction/destination safety وage/count bounded purge PASS؛ delivery `5cf3d03605215ee2160473afee4c77585f0e9f61`، local == `origin/main` |
| Planner/Critic | bounded plan generation وwarnings وunsafe target/byte mismatch/duplicate step rejection وWorkCycle no-mutation guard PASS؛ delivery `a946ad2c168d1d0c8ee3812c4c26a6bb0b61d912`، local == `origin/main` |
| Local Provider Adapters | Ollama/llama.cpp mapping وhealth وloopback security وHTTP errors وtimeout/cancellation وoptional composition registration PASS؛ delivery `c18b6befcaf82acc4679f9ed72899659d00d6a11`، local == `origin/main` |
| Provider Policy/Doctor/Quota | bounded configuration وdisabled/blocked/healthy doctor وconcurrency/rate/circuit وGateway admission PASS؛ delivery `8be5293f29c8e2c520cd422a54226d9f7f31128a`، local == `origin/main` |
| Provider-backed Planner/WorkCycle | LlmPlanner routing وstrict JSON وexplicit selection وplan-less generation وHuman Gate/resume guards وElectron fixture smoke PASS؛ delivery `358e339e52f1a07e95c5e266f18bd37ba36072e3`، local == `origin/main` |
| Development Environment: Project Explorer/File Reader | ProjectExplorerPort وWorkspaceFileReaderPort وtree/file IPC وWorkspace dynamic rendering وtraversal/symlink/secret-name guards وElectron smoke PASS؛ delivery `a72b2c7b85bf4abc934be638aa911577a20547ab`، local == `origin/main` |
| Development Environment: Safe Editor Document Boundary | EditorDocumentPort وInMemoryEditorDocumentStore وeditor.open/propose وbounded diff وstale/path/NUL/size guards وElectron no-mutation smoke PASS؛ delivery `d989960112307b92185f18d1046506a620460887`، local == `origin/main` |
| Development Environment: Terminal Policy Preview | TerminalPolicyPort وBoundedTerminalPolicy وterminal.inspect وclassification/deny-by-default/redaction/bounds وWorkspace Inspect-only وElectron no-process smoke PASS؛ delivery `18b980a4e3b76de01e919c959a5771e8a67475a9`، local == `origin/main` |
| Development Environment: Git Read-only Integration | GitReadOnlyPort وFilesystemGitReadOnlyAdapter وgit.status/git.diff وbounded diff/truncation/path guards وWorkspace read-only panel وElectron smoke PASS؛ delivery `6a0db8a180298030fe77ad53f8fc54667de4258f`، local == `origin/main` |
| Development Environment: Context وAgent Task Review | `AgentTaskPreviewService` و`task.preview` typed IPC وdeterministic default planner وexplicit provider boundary وbounded path/input validation وWorkspace context/plan/critique panel وno-mutation/no-approval smoke PASS؛ feature `665fe76a44963736881f6f2ed519d95a2b901825`، docs-close مستقل |
| Production Studio: Source Registry وProvenance | `SourceRegistryPort` و`InMemorySourceRegistry` وsource/citation/provenance IPC وbounded validation/deduplication وWorkspace Sources panel وno-network/no-mutation smoke PASS؛ feature `fc738f4c89ce5f5df54c6fdbee9f302e13285f7c`، docs-close مستقل |
| Production Studio: Content Plan وClaim/Citation Integrity | `ContentPlanPort` و`InMemoryContentPlanService` وclaim-source integrity وtyped IPC وWorkspace Content Plan panel وunresolved/conflicted/no-mutation smoke PASS؛ feature `403372b4b13c2545818d4fd0fddff180bde89983`، docs-close مستقل |
| Production Studio: Asset Catalog وCreative Brief | `AssetCatalogPort` و`CreativeBriefPort` و`InMemoryAssetCatalog` وlicense/provenance guards وtyped IPC وWorkspace metadata-only panels وno-network/no-mutation smoke PASS؛ feature `552854705ea4b3371ec7fe1c8afbe8d8a9901158`، docs-close مستقل |
| Production Studio: Render Job Policy وValidation Preview | `RenderPolicyPort` وlow-memory format/destination guards وtyped IPC وWorkspace readiness و`executionStarted: false` وno-render/no-mutation PASS؛ feature `8dfd98f2a32751dca7b36d70b60eddb2c00345b3`، docs-close مستقل |
| Second Brain: Memory Capture وKnowledge Entry Review | `MemoryCapturePort` وredaction/source provenance/local search وtyped IPC وWorkspace capture panel وno-provider/no-network/no-mutation PASS؛ feature `39bd89c7f4242abab76fd624045b493b72e48088`، docs-close مستقل |
| Second Brain: Memory Review وExplicit Confirmation | `MemoryReviewPort` وconfirm/archive transitions وexact-key review validation وtyped IPC وWorkspace review queue وno-provider/no-approval/no-mutation PASS؛ feature `4f1709cd927b77627c4532ec396f572f3bbedb2c`، docs-close `04e49b1590fe7df529636e8c721f5b57b86d439f` |
| Comprehensive Project Audit وArchitecture Gaps | inventory فعلي وcoverage matrix لـ46 Agent ودورة lifecycle وتدقيق Port Forwarding/Playwright/OAuth/Google/MCP/dependencies/docs وقرارات مطلوبة؛ docs 76–79 وresearch source log، دون external connector implementation |
| Typed Provider Configuration UI/IPC | provider.list/configure/doctor contracts وhandlers وWorkspace panel وElectron smoke وno-network startup PASS؛ delivery `cb70b17f1b5d9350e22855bf8da98efd0f8eb226`، local == `origin/main` |

## العمل المتبقي

ما زال FTS5 وobject store وcontent hashing وterminal sandbox وproduction packaging الموقّع غير منفذة. BoundedAgentRuntime وResourcePolicy وProviderGateway وApprovalWorkflow وAgentWorkCycle وContextIndex وtyped WorkCycle IPC وPersistent Audit وHuman Gate وApproval hydration وHuman Gate UI/event streaming وAudit Export/Retention وPlanner/Critic وOllama/llama.cpp adapters وProvider Policy/Doctor/Quota وTyped Provider Configuration UI/IPC وProvider-backed Planner/WorkCycle وProject Explorer/File Reader موجودة كـapplication/desktop slices bounded، لكن persistence المستقلة لإعدادات providers وmodel discovery وstreaming وtool execution وMonaco/LSP وterminal worker وGit write وtest runner وquota/circuit breaker الكامل وsigned/tamper-evident export ما زالت لاحقة.
 SQLite مربوط اختياريًا داخل `createEmbeddedApplication`، ومسار `sqlite-profile` يفرض profile path policy وexclusive locking؛ backup UX والتشفير ما زالا لاحقين.

لا توجد بعد React Native Web/Metro runtime فعلية، ولا Android doctor/ADB adapter، ولا iOS Xcode adapter، ولا تكاملات remote/EAS. ولا توجد Audio/Avatar/Wake Word/Overlay runtimes؛ دراسة Virtual Human في docs 84–86 لا تضيف packages أو models أو assets أو native toolchains. لا ينبغي تشغيل native toolchains أو scripts من مشاريع الهاتف تلقائيًا.

## القرار والخطوة التالية

دراسة Virtual Human مكتملة توثيقيًا فقط: `docs/84-virtual-human-research-and-comparison.md` للمقارنة، `docs/85-virtual-human-architecture-and-contracts.md` للعقود والحالات والأداء والخصوصية، و`docs/86-virtual-human-licensing-roadmap-and-decisions.md` للتراخيص وroadmap 0–11. commit الدراسة `d47294ed613090bc913ee14d68669621febbccbb` متحقق local==remote؛ مسار docs-close منفصل مطلوب، ثم يتوقف العمل بانتظار قرار مالك مستقل. لا يبدأ تنفيذ Avatar أو تثبيت حزم أو تغيير Electron/TypeScript/typed IPC قبل ذلك القرار.

بعد إغلاق الدراسة، تظل الشريحة التقنية التالية إكمال localization resources أو metadata-only External Accounts أو Storage Settings أو Self-development Candidate Review؛ تبقى OAuth/MCP/Playwright/tunnels خلف gates مستقلة، ولا تُضاف persistence أو embeddings أو skill activation تلقائيًا.

للتسليم إلى وكيل أو مهندس لاحق، ابدأ بقراءة `AI_CONTINUATION.md` ثم `PROJECT_STATE.md` ثم `docs/45-master-implementation-plan.md` و`docs/47-sqlite-adapter-implementation.md`.

آخر تحديث: 2026-08-22. إعداد: Manus AI. Virtual Human study docs 84–86 `DOCUMENTED ONLY / DEFERRED`؛ لا Avatar implementation. Memory Review feature/docs-close `4f1709cd927b77627c4532ec396f572f3bbedb2c`/`04e49b1590fe7df529636e8c721f5b57b86d439f`، وaudit documentation feature/docs-close `7ede715dfbd8f9e4d030848573b11e94790ba580`/`f0c3d86c329f45335cd22cc1465ba673435fea87`، وAgent Catalog feature/docs-close `56eebb97267c1e5979ea2e53c9f3fa9ec988d192`/`bc6c9ea3bf430e9586307390e0843fa5fe7c0b5d`، وReportDocument feature/docs-close `24144c4f2495354b5d2d8a5a880192dc251173ff`/`56db328b51b42b64ea59830979df3e262d126237` متحققون؛ Settings feature `d9a746c7deecb38488a5f632599be16c48c8e8cb` متحقق local==remote؛ docs-close توثيقي مستقل لهذه التسليمة.
