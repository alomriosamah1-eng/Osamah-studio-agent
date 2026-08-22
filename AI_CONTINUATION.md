# AI_CONTINUATION

## الهوية والهدف

Osamah Studio Agent منصة Desktop محلية أولًا تجمع Intelligent Software Development Environment وProduction Studio وSecond Brain. الهدف تحويل الطلب إلى سياق وخطة وتنفيذ قابل للمراجعة ثم artifact أو معرفة قابلة لإعادة الاستخدام، مع حماية الملفات والأسرار والموارد.

## الحالة الدقيقة

أصبح المستودع Foundation قابلًا للاختبار مع محاكي هاتف مدمج داخل Workspace وtyped IPC وProject Preview Runtime وPresentation Renderer وElectron shell معزولة. أضيفت شريحة SQLite adapter وobservability وbackup/restore ثم دُفعت إلى `origin/main` عند `0c51c1e00726afa798182ade0e6dc16ab627eba7`، مع تطابق local وremote SHA. آخر delivery مدفوع قبل هذه الشريحة هو `ddeb5edc939c107f808339c480cf7535f1150595`.

نتيجة الاختبار الحالية: `pnpm check` يمر بـ`44/44` اختبارًا. validator يمر بـ`SQLITE_MIGRATION_VALID=true`، migration count `2`، schema version `002`. اجتازت slice الأداء `pnpm build` و`pnpm performance:smoke` تحت V8 heap 768MB، وJSON validation وsecret heuristic وdesktop smoke؛ سجل الأداء low_memory وReact Native → lightweight_web وpreview حوالي 11ms وheap delta حوالي 0.3MB وRSS delta حوالي 3.1MB، مع `PERFORMANCE_FINAL_GATE=PASS`.

## المعمارية

Clean Architecture: Domain مستقل، Application use cases/ports، Interface Adapters، Infrastructure، Presentation. Domain وApplication يعرفان `SqlExecutor` و`ObservabilitySink` و`BackupProvider` والعقود repository فقط. `DatabaseSync` وWAL ومسارات الملفات و`VACUUM INTO` محصورة في `src/infrastructure/`.

Mobile subsystem له LightweightPreview وFixturePreview في compatibility mode، ثم adapters مستقلة لـReact Native Web/Metro وAndroid Emulator وiOS Simulator وphysical devices وEAS. لا يدّعي preview الحالي native fidelity ولا Metro HMR حقيقيًا.

## الملفات المهمة الجديدة

`db/migrations/002_observability.sql` يضيف `device_profiles` و`preview_sessions` و`observability_logs` والفهارس `idx_preview_device` و`idx_observability_time` و`idx_observability_correlation`.

`src/application/ports.ts` يحتوي `SqlValue` و`SqlExecutor` و`ObservabilityRecord` و`ObservabilitySink` و`BackupManifest` و`BackupProvider` مع `create` و`verify` و`restore`.

`src/infrastructure/sqlite.ts` يحتوي `SqliteDatabase` مع migration runner وchecksum validation وtransactions وsnapshot، و`SqliteRepositories` للكيانات الحالية، و`SqliteEventBus`، و`SqliteObservabilitySink`، وfactory `createSqliteApplicationStorage`.

`src/infrastructure/sqlite-backup.ts` يحتوي `LocalSqliteBackupProvider` مع atomic snapshot وmanifest وSHA-256 وforeign-key validation وmigration dry-run على نسخة مؤقتة وrestore إلى profile منفصل.

`src/sqlite.test.ts` يغطي migration order وchecksum mismatch وrestart persistence وrepositories وevent bus وredaction وtransactions وbackup/restore والتلاعب بالنسخة. `scripts/validate_sqlite_migration.py` يطبق migrations 001 و002 في memory ويتحقق من schema والجداول والفهارس وforeign keys. أضيفت `src/application/resource-policy.ts` و`src/application/agent-runtime.ts` و`src/domain/project.ts` و`scripts/performance-smoke.mjs` واختباراتها، والتوثيق التنفيذي في `docs/47-sqlite-adapter-implementation.md` و`docs/48-lightweight-preview-and-resource-policy.md`.

## القواعد

لا يعتمد Domain على UI أو OS أو vendor. لا تضع secrets أو user files أو model weights في Git. لا تشغل native toolchains أو scripts غير موثوقة تلقائيًا. لا تجعل iOS Simulator يبدو متاحًا على Windows/Linux. لا تحول UNKNOWN إلى FACT. كل feature تحتاج architecture، interface، data model، dependencies، risks، acceptance criteria، implementation، tests، docs، commit، push، verification.

في SQLite، لا تعدّل migration منشورة؛ أضف ملفًا جديدًا. يفشل runner مغلقًا عند checksum mismatch. لا يستبدل restore profile الحي. لا يفتح `verify` snapshot الأصلي للكتابة؛ migration dry-run يعمل على نسخة مؤقتة. Redaction recursive للـ logs/events ليست بديلًا عن secret provider وسياسة أسرار كاملة.

## الأوامر الحالية

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm build
pnpm desktop:smoke
python3 scripts/validate_sqlite_migration.py
git diff --check
```

بعد أي تعديل تالٍ نفّذ secret scan الموجود في المشروع، ثم `git status --short`، ثم commit، ثم `git push origin main`، ثم `git rev-parse HEAD` و`git ls-remote origin refs/heads/main` وتحقق من تطابق القيمتين. آخر تحقق ناجح هو `GITHUB_PUSH_VERIFIED=true` عند `b9089efee33a174c3958a9295853623beae27503`؛ performance slice وWeb preview وresource governance مدفوعة ومتحقق منها.

## ما يزال مؤجلًا

SQLite adapter لم يُربط بعد lifecycle production داخل `createEmbeddedApplication`، مع أن composition يحقن الآن low-memory ResourcePolicy وBoundedAgentRuntime وGeneralProjectDetector. لم يُنفذ FTS5 أو object store أو Provider Gateway أو terminal sandbox أو production packaging الموقّع. Web Preview الحالي lightweight compatibility mapping وليس React Native Web/Metro parity كاملة؛ ولم تُنفذ Android doctor/ADB أو macOS-only iOS adapter.

## التسلسل التالي

بعد دفع slice الأداء والـ preview، نفّذ production root picker عبر typed preload وmain-process dialog، ثم wiring اختيارية لـSQLite خلف composition مع lifecycle وfallback policy. بعدها تُوسّع BoundedAgentRuntime بعقود provider/approval، ثم Provider Gateway، ثم React Native Web/Metro parity عند الحاجة، ثم Android doctor/ADB، ثم macOS-only iOS adapter، ثم visual loop بحدود iteration وapproval.

## أسئلة مفتوحة

OpenTo Desktop ما زال بلا source رسمي قابل للتحقق. يلزم تحديد React renderer، browser-metro/Snack integration، دعم EAS/remote، hardware baseline، وسياسة multi-device concurrency، وتشفير backup وkey management. يجب أن تظل الأسئلة في project state حتى يجيب المالك أو يظهر مصدر موثوق.

إعداد: Manus AI. آخر تحديث: 2026-08-22.
