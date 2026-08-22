# AI Continuation — Osamah Studio Agent

## الهوية والهدف

Osamah Studio Agent منصة Desktop محلية أولًا تجمع Intelligent Software Development Environment وProduction Studio وSecond Brain. الهدف تحويل الطلب إلى سياق وخطة وتنفيذ قابل للمراجعة ثم artifact أو معرفة قابلة لإعادة الاستخدام، مع حماية الملفات والأسرار والموارد.

## الحالة الدقيقة

أصبح المستودع Foundation قابلًا للاختبار مع محاكي هاتف مدمج داخل Workspace وtyped IPC وProject Preview Runtime وPresentation Renderer وElectron shell معزولة. أضيفت شريحة SQLite adapter وobservability وbackup/restore، ثم optional composition، ثم profile path policy وexclusive lock؛ آخر delivery متحقق قبل الشريحة الحالية هو `e8c4ecca95dd51659b30d62f740c1f67ca5701ff` مع تطابق local وremote SHA.

نتيجة الاختبار الحالية: `pnpm check` يمر بـ`71/71` اختبارًا. أضيفت Provider وApproval contracts وProviderGateway bounded فوق profile storage؛ full gate ناجح، ودُفعت الشريحة عند `c833f0e9c37cfaa1800aa9fcc300881984ab6878` مع تطابق local وremote SHA. أضيفت الآن Agent Work Cycle وProject Context Index وFilesystemPatchAdapter، والاختبارات وfull gate ناجحة؛ دُفعت الشريحة عند `fb5d93ec87939125373dd8c450d1195af50fc911` مع تطابق local وremote SHA.

validator يمر بـ`SQLITE_MIGRATION_VALID=true`، migration count `2`، schema version `002`. اجتازت `pnpm build` و`pnpm desktop:smoke` و`pnpm performance:smoke` تحت V8 heap 768MB، وJSON validation وsecret scan وdiff hygiene؛ سجل الأداء `low_memory` وReact Native → `lightweight_web` وpreview حوالي 11.56ms وheap delta حوالي 0.32MB وRSS delta حوالي 3MB، مع `DESKTOP_ROOT_PICKER_SMOKE=PASS` و`DESKTOP_IPC_SMOKE=PASS`.

## المعمارية

Clean Architecture: Domain مستقل، Application use cases/ports، Interface Adapters، Infrastructure، Presentation. Domain وApplication يعرفان العقود المجردة؛ `DatabaseSync` وWAL ومسارات الملفات و`VACUUM INTO` محصورة في Infrastructure.

Mobile subsystem له LightweightPreview وFixturePreview في compatibility mode، ثم adapters مستقلة لـReact Native Web/Metro وAndroid Emulator وiOS Simulator وphysical devices وEAS. لا يدّعي preview الحالي native fidelity ولا Metro HMR حقيقيًا.

## الملفات المهمة

`src/infrastructure/profile-storage.ts` يعرّف `ProfilePaths` و`validateProfileId` و`FileProfileLock` بقفل `wx` وownership-token release، وتغطيه `src/profile-storage.test.ts`.

`src/application/agent-contracts.ts` و`src/application/approval-workflow.ts` يعرّفان action/approval/audit contracts. `src/application/agent-runtime.ts` يعرّف `submitGuarded()` الذي يرفض الفعل قبل queue عند غياب authorization أو الموافقة المطابقة.

`src/application/provider-contracts.ts` و`src/application/provider-gateway.ts` يعرّفان ProviderManifest وProviderAdapter وProviderGateway مع capability/privacy/offline filtering وlocal-first وhealth وfallback bounded وtyped output validation وmutation idempotency. `src/application/project-context.ts` و`src/application/agent-work-cycle.ts` يعرّفان context/plan/read/patch/approval/checkpoint protocol، و`src/infrastructure/filesystem-patch.ts` يطبق التحقق والكتابة المحلية الآمنة.

`src/infrastructure/fixture-provider.ts` و`src/infrastructure/in-memory.ts` يوفران adapters deterministic خفيفة. composition يصدر `approvalWorkflow` و`auditTrail` و`providerGateway` و`providerRouteAudit`، مع registry فارغ فلا توجد network calls أو model loading عند الإقلاع.

`src/infrastructure/sqlite.ts` يحتوي migration runner وchecksum validation وtransactions وrepositories وevent bus وobservability. `src/infrastructure/sqlite-backup.ts` يحتوي atomic snapshot وmanifest وSHA-256 وforeign-key validation وmigration dry-run وrestore إلى profile منفصل.

التوثيق التنفيذي في `docs/47-sqlite-adapter-implementation.md` و`docs/48-lightweight-preview-and-resource-policy.md` و`docs/49-production-root-picker.md` و`docs/50-optional-sqlite-composition.md` و`docs/51-profile-path-policy.md` و`docs/52-provider-approval-contracts.md` و`docs/53-agent-work-cycle.md`.

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

بعد أي تعديل تالٍ نفّذ secret scan الموجود في المشروع، ثم `git status --short`، ثم commit، ثم `git push origin main`، ثم `git rev-parse HEAD` و`git ls-remote origin refs/heads/main` وتحقق من تطابق القيمتين. آخر delivery هو `fb5d93ec87939125373dd8c450d1195af50fc911`؛ `GITHUB_PUSH_VERIFIED=true` وlocal == `origin/main`.

## ما يزال مؤجلًا

لم يُنفذ FTS5 أو object store أو terminal sandbox أو production packaging الموقّع. ProviderGateway الحالي contract/fixture bounded فقط؛ لا يوجد remote provider أو Ollama/llama.cpp adapter أو quota/circuit breaker كامل. Agent Work Cycle الحالي contract/fixture bounded؛ لا يوجد planner/critic أو LLM inference تلقائي أو persistent project index أو checkpoint restore أو typed IPC boundary أو Human Gate UI.

Web Preview الحالي lightweight compatibility mapping وليس React Native Web/Metro parity كاملة؛ ولم تُنفذ Android doctor/ADB أو macOS-only iOS adapter. لا يوجد stale-lock cleanup تلقائي أو encryption/key management أو backup UX متكامل.

## التسلسل التالي

بعد إغلاق Agent Work Cycle الحالي، تُنفذ typed application/IPC boundary وpersistent audit وHuman Gate UI وplanner/critic وprovider adapters الفعلية. يأتي backup UX وencryption/key management عند الحاجة، ثم Development Environment العامة وProduction Studio وSecond Brain؛ يبقى React Native Web/Metro parity واستكمال Lightweight Web Preview إلى آخر مراحل تصميم البيئة، ثم Android doctor/ADB وmacOS-only iOS adapter وفق الأدلة.

## أسئلة مفتوحة

OpenTo Desktop ما زال بلا source رسمي قابل للتحقق. يلزم تحديد React renderer، browser-metro/Snack integration، دعم EAS/remote، hardware baseline، وسياسة multi-device concurrency، وتشفير backup وkey management. يجب أن تظل الأسئلة في project state حتى يجيب المالك أو يظهر مصدر موثوق.

إعداد: Manus AI. آخر تحديث: 2026-08-22. آخر delivery: `fb5d93ec87939125373dd8c450d1195af50fc911`؛ `GITHUB_PUSH_VERIFIED=true`.
