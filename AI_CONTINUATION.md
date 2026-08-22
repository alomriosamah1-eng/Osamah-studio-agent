# AI Continuation — Osamah Studio Agent

## الهوية والهدف

Osamah Studio Agent منصة Desktop محلية أولًا تجمع Intelligent Software Development Environment وProduction Studio وSecond Brain. الهدف تحويل الطلب إلى سياق وخطة وتنفيذ قابل للمراجعة ثم artifact أو معرفة قابلة لإعادة الاستخدام، مع حماية الملفات والأسرار والموارد.

## الحالة الدقيقة

أصبح المستودع Foundation قابلًا للاختبار مع محاكي هاتف مدمج داخل Workspace وtyped IPC وProject Preview Runtime وPresentation Renderer وElectron shell معزولة. أضيفت شريحة SQLite adapter وobservability وbackup/restore، ثم optional composition، ثم profile path policy وexclusive lock، ثم Persistent Audit وHuman Gate عند `ca7460d6c36ad64d98298d2e383d68e661f0869c` مع تطابق local وremote SHA. شريحة ApprovalStore وhydration أُغلقت عند `fd248891cc5cd68818cc5fa13319bc2a133a2565` مع تطابق local وremote SHA. شريحة Human Gate UI وapproval event streaming أُغلقت عند `0b5acbf136d168fb43312379f44846c1075c802f` مع تطابق local وremote SHA. شريحة Audit Export وRetention Policy منفذة ومدفوعة ومتحقق منها عند `5cf3d03605215ee2160473afee4c77585f0e9f61`. شريحة Planner/Critic منفذة ومربوطة بـWorkCycle ومدفوعة ومتحقق منها عند `a946ad2c168d1d0c8ee3812c4c26a6bb0b61d912`. شريحة Local Provider Adapters منفذة ومربوطة اختياريًا بالـGateway ومدفوعة ومتحقق منها عند `c18b6befcaf82acc4679f9ed72899659d00d6a11`. شريحة Provider Policy/Doctor/Quota منفذة ومربوطة اختياريًا بالـGateway ومدفوعة ومتحقق منها عند `8be5293f29c8e2c520cd422a54226d9f7f31128a`. شريحة Typed Provider Configuration UI/IPC منفذة ومدفوعة ومتحقق منها عند `cb70b17f1b5d9350e22855bf8da98efd0f8eb226`، وتشمل provider.list/configure/doctor وWorkspace Provider panel وdesktop smoke مع تطابق local وremote SHA.

نتيجة الاختبار الحالية: `pnpm check` يمر بـ`98/98` اختبارًا. Full gate للشريحة الحالية يمر مع build وdesktop/performance smoke وSQLite/JSON/diff/secret validation، ودفع GitHub متحقق مع `local_sha == remote_sha`.
 أضيفت Provider وApproval contracts وProviderGateway bounded فوق profile storage، ثم Agent Work Cycle وProject Context Index وFilesystemPatchAdapter، ثم typed WorkCycle IPC، ثم Persistent Audit وHuman Gate، ثم ApprovalStore وSqliteApprovalStore وhydration بعد restart، ثم `IpcEvent` وpreload subscribe وWorkspace Human Gate panel، ثم `AuditExportProvider` و`BoundedAuditRetentionPolicy`، ثم `PlannerPort` و`CriticPort` وربطهما بـWorkCycle، ثم `LocalHttpProviderAdapter` وOllama وllama.cpp adapters مع optional composition registration، ثم `LocalProviderConfig` و`LocalProviderDoctor` و`BoundedProviderExecutionPolicy` وربطها بالـGateway؛ schema 004 وredaction/restart وpending/decide وapproval.changed وNDJSON/manifest/retention وplanner/critic وprovider policy contracts ناجحة.

validator يمر بـ`SQLITE_MIGRATION_VALID=true`، migration count `4`، schema version `004`، 12 جدولًا و24 index entry. اجتازت `pnpm check` و`pnpm typecheck`، ونجحت اختبارات SqliteAuditTrail وApprovalStore restart/redaction وHuman Gate fail-closed. full gate وGitHub push verification ناجحان؛ `local_sha == remote_sha`.

## المعمارية

Clean Architecture: Domain مستقل، Application use cases/ports، Interface Adapters، Infrastructure، Presentation. Domain وApplication يعرفان العقود المجردة؛ `DatabaseSync` وWAL ومسارات الملفات و`VACUUM INTO` محصورة في Infrastructure.

Mobile subsystem له LightweightPreview وFixturePreview في compatibility mode، ثم adapters مستقلة لـReact Native Web/Metro وAndroid Emulator وiOS Simulator وphysical devices وEAS. لا يدّعي preview الحالي native fidelity ولا Metro HMR حقيقيًا.

## الملفات المهمة

`src/infrastructure/profile-storage.ts` يعرّف `ProfilePaths` و`validateProfileId` و`FileProfileLock` بقفل `wx` وownership-token release، وتغطيه `src/profile-storage.test.ts`.

`src/application/agent-contracts.ts` و`src/application/approval-workflow.ts` يعرّفان action/approval/audit contracts. `src/application/agent-runtime.ts` يعرّف `submitGuarded()` الذي يرفض الفعل قبل queue عند غياب authorization أو الموافقة المطابقة.

`src/application/provider-contracts.ts` و`src/application/provider-gateway.ts` يعرّفان ProviderManifest وProviderAdapter وProviderGateway مع capability/privacy/offline filtering وlocal-first وhealth وfallback bounded وtyped output validation وmutation idempotency. `src/application/project-context.ts` و`src/application/agent-work-cycle.ts` يعرّفان context/plan/read/patch/approval/checkpoint protocol، و`src/infrastructure/filesystem-patch.ts` يطبق التحقق والكتابة المحلية الآمنة. `src/ipc/contracts.ts` و`src/ipc/embedded-handlers.ts` يعرّفان ويشغلان `context.index` و`workCycle.start` و`workCycle.inspect` و`workCycle.cancel` مع runtime payload validation.

`src/infrastructure/fixture-provider.ts` و`src/infrastructure/in-memory.ts` يوفران adapters deterministic خفيفة. composition يصدر `approvalWorkflow` و`auditTrail` و`providerGateway` و`providerRouteAudit`، مع registry فارغ فلا توجد network calls أو model loading عند الإقلاع.

`src/infrastructure/sqlite.ts` يحتوي migration runner وchecksum validation وtransactions وrepositories وevent bus وobservability و`SqliteAuditTrail` و`SqliteApprovalStore`، مع migrations 003 و004 لجدولي audit وapproval tickets. `src/infrastructure/sqlite-backup.ts` يحتوي atomic snapshot وmanifest وSHA-256 وforeign-key validation وmigration dry-run وrestore إلى profile منفصل، و`src/infrastructure/audit-export.ts` ينشئ NDJSON وmanifest ذري. `src/application/audit-policy.ts` يعرّف bounded retention، و`src/application/planner-critic.ts` يعرّف planner/critic deterministic contracts، و`src/infrastructure/local-http-provider.ts` يعرّف local HTTP adapters لـOllama وllama.cpp، و`src/application/provider-policy.ts` يعرّف configuration وdoctor/quota/circuit contracts، و`src/infrastructure/local-provider-doctor.ts` ينفذ health reports، و`src/application/human-gate.ts` يعرّف HumanGatePort وInMemoryHumanGate، و`src/ipc/contracts.ts` يعرّف approval methods و`IpcEvent` و`provider.list/configure/doctor`، و`src/ipc/embedded-handlers.ts` يعرّف approval/provider handlers، و`src/desktop/main.ts` و`src/desktop/preload.cjs` يربطان surfaces allowlisted. `prototypes/studio/index.html` و`workspace.js` يقدمان Provider panel آمنًا مع Save config وRun doctor.

التوثيق التنفيذي في `docs/47-sqlite-adapter-implementation.md` و`docs/48-lightweight-preview-and-resource-policy.md` و`docs/49-production-root-picker.md` و`docs/50-optional-sqlite-composition.md` و`docs/51-profile-path-policy.md` و`docs/52-provider-approval-contracts.md` و`docs/53-agent-work-cycle.md` و`docs/54-agent-work-cycle-ipc.md` و`docs/55-persistent-audit-human-gate.md` و`docs/56-approval-hydration.md` و`docs/57-human-gate-ui-event-stream.md` و`docs/58-audit-export-retention.md` و`docs/59-planner-critic-contracts.md` و`docs/60-local-provider-adapters.md` و`docs/61-provider-policy-doctor-quota.md` و`docs/62-provider-configuration-ui-ipc.md`.

## القواعد

لا يعتمد Domain على UI أو OS أو vendor. لا تضع secrets أو user files أو model weights في Git. لا تشغل native toolchains أو scripts غير موثوقة تلقائيًا. لا تجعل iOS Simulator يبدو متاحًا على Windows/Linux. لا تحول UNKNOWN إلى FACT.

كل feature تحتاج architecture وinterface وdata model وdependencies وrisks وacceptance criteria وimplementation وtests وdocs وcommit وpush وverification. لا تدخل الأفعال الحساسة إلى Agent Runtime عبر المسار غير المحمي؛ استخدم `submitGuarded()` مع `AgentActionRequest` وapproval matching.

في SQLite، لا تعدّل migration منشورة؛ أضف ملفًا جديدًا. يفشل runner مغلقًا عند checksum mismatch. لا يستبدل restore profile الحي. Redaction recursive للـlogs/events ليست بديلًا عن secret provider وسياسة أسرار كاملة.

## الأوامر الحالية

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm build
pnpm desktop:smoke
pnpm performance:smoke
python3 scripts/validate_sqlite_migration.py
python3 -m json.tool project/master-implementation-plan.json >/dev/null
git diff --check
```

بعد أي تعديل تالٍ نفّذ secret scan الموجود في المشروع، ثم `git status --short`، ثم commit، ثم `git push origin main`، ثم `git rev-parse HEAD` و`git ls-remote origin refs/heads/main` وتحقق من تطابق القيمتين. آخر delivery مكتمل هو `cb70b17f1b5d9350e22855bf8da98efd0f8eb226`؛ Typed Provider Configuration UI/IPC مدفوعة ومتحقق منها.

## ما يزال مؤجلًا

لم يُنفذ FTS5 أو object store أو terminal sandbox أو production packaging الموقّع. ProviderGateway الحالي contract/fixture bounded فقط؛ لا يوجد remote provider أو Ollama/llama.cpp adapter أو quota/circuit breaker كامل. Agent Work Cycle وtyped IPC وPersistent Audit وHuman Gate وApproval hydration وHuman Gate UI/event streaming وAudit Export/Retention وPlanner/Critic وOllama/llama.cpp adapters وProvider Policy/Doctor/Quota الحالية contract/fixture bounded؛ لا يوجد model discovery أو streaming أو tool execution أو LLM inference تلقائي أو circuit persistence أو cross-process quota أو persistent project index أو checkpoint restore أو تشفير أو signed/tamper-evident export.

Web Preview الحالي lightweight compatibility mapping وليس React Native Web/Metro parity كاملة؛ ولم تُنفذ Android doctor/ADB أو macOS-only iOS adapter. لا يوجد stale-lock cleanup تلقائي أو encryption/key management أو backup UX متكامل.

## التسلسل التالي

بعد إغلاق Typed Provider Configuration UI/IPC، تُربط adapters بمسار Planner/Critic وAgent Runtime مع provider/model selection typed وHuman Gate قبل mutation.
 يأتي backup UX وencryption/key management عند الحاجة، ثم Development Environment العامة وProduction Studio وSecond Brain؛ يبقى React Native Web/Metro parity واستكمال Lightweight Web Preview إلى آخر مراحل تصميم البيئة، ثم Android doctor/ADB وmacOS-only iOS adapter وفق الأدلة.

## أسئلة مفتوحة

OpenTo Desktop ما زال بلا source رسمي قابل للتحقق. يلزم تحديد React renderer، browser-metro/Snack integration، دعم EAS/remote، hardware baseline، وسياسة multi-device concurrency، وتشفير backup وkey management. يجب أن تظل الأسئلة في project state حتى يجيب المالك أو يظهر مصدر موثوق.

إعداد: Manus AI. آخر تحديث: 2026-08-22. آخر delivery: `cb70b17f1b5d9350e22855bf8da98efd0f8eb226`؛ Typed Provider Configuration UI/IPC مدفوعة ومتحقق منها، local == `origin/main`.
