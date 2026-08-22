# AI_CONTINUATION

## الهوية والهدف

Osamah Studio Agent منصة Desktop محلية أولًا تجمع Intelligent Software Development Environment وProduction Studio وSecond Brain. الهدف تحويل الطلب إلى سياق وخطة وتنفيذ قابل للمراجعة ثم artifact أو معرفة قابلة لإعادة الاستخدام، مع حماية الملفات والأسرار والموارد.

## الحالة الدقيقة

أصبح المستودع Foundation قابلًا للاختبار مع محاكي هاتف مدمج داخل Workspace وtyped IPC وProject Preview Runtime وPresentation Renderer وElectron shell معزولة. أضيفت الآن شريحة SQLite adapter وobservability وbackup/restore محليًا، وما تزال غير مدفوعة حتى إغلاق الفحوص والـ commit. آخر delivery مدفوع قبل هذه الشريحة هو `ddeb5edc939c107f808339c480cf7535f1150595`.

نتيجة الاختبار الحالية: `pnpm check` يمر بـ`31/31` اختبارًا. validator يمر بـ`SQLITE_MIGRATION_VALID=true`، migration count `2`، schema version `002`. لم يُحدّث remote بعد هذه الشريحة؛ يجب عدم إعلان النجاح قبل `git push` ثم مقارنة local SHA مع `git ls-remote`.

## المعمارية

Clean Architecture: Domain مستقل، Application use cases/ports، Interface Adapters، Infrastructure، Presentation. Domain وApplication يعرفان `SqlExecutor` و`ObservabilitySink` و`BackupProvider` والعقود repository فقط. `DatabaseSync` وWAL ومسارات الملفات و`VACUUM INTO` محصورة في `src/infrastructure/`.

Mobile subsystem له LightweightPreview وFixturePreview في compatibility mode، ثم adapters مستقلة لـReact Native Web/Metro وAndroid Emulator وiOS Simulator وphysical devices وEAS. لا يدّعي preview الحالي native fidelity ولا Metro HMR حقيقيًا.

## الملفات المهمة الجديدة

`db/migrations/002_observability.sql` يضيف `device_profiles` و`preview_sessions` و`observability_logs` والفهارس `idx_preview_device` و`idx_observability_time` و`idx_observability_correlation`.

`src/application/ports.ts` يحتوي `SqlValue` و`SqlExecutor` و`ObservabilityRecord` و`ObservabilitySink` و`BackupManifest` و`BackupProvider` مع `create` و`verify` و`restore`.

`src/infrastructure/sqlite.ts` يحتوي `SqliteDatabase` مع migration runner وchecksum validation وtransactions وsnapshot، و`SqliteRepositories` للكيانات الحالية، و`SqliteEventBus`، و`SqliteObservabilitySink`، وfactory `createSqliteApplicationStorage`.

`src/infrastructure/sqlite-backup.ts` يحتوي `LocalSqliteBackupProvider` مع atomic snapshot وmanifest وSHA-256 وforeign-key validation وmigration dry-run على نسخة مؤقتة وrestore إلى profile منفصل.

`src/sqlite.test.ts` يغطي migration order وchecksum mismatch وrestart persistence وrepositories وevent bus وredaction وtransactions وbackup/restore والتلاعب بالنسخة. `scripts/validate_sqlite_migration.py` يطبق migrations 001 و002 في memory ويتحقق من schema والجداول والفهارس وforeign keys. التوثيق التنفيذي في `docs/47-sqlite-adapter-implementation.md`.

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

قبل الدفع نفّذ secret scan الموجود في المشروع، ثم `git status --short`، ثم commit، ثم `git push origin main`، ثم `git rev-parse HEAD` و`git ls-remote origin refs/heads/main` وتحقق من تطابق القيمتين.

## ما يزال مؤجلًا

SQLite adapter لم يُربط بعد بـ`createEmbeddedApplication`؛ wiring composition وprofile picker الإنتاجي يأتيان بعد هذه الشريحة. لم يُنفذ FTS5 أو object store أو Agent Runtime أو Provider Gateway أو terminal sandbox أو resource manager أو production packaging الموقّع. لم تُنفذ React Native Web/Metro الحقيقية أو Android doctor/ADB أو macOS-only iOS adapter.

## التسلسل التالي

بعد دفع SQLite وobservability، نفّذ production root picker عبر typed preload وmain-process dialog، ثم wiring اختيارية لـSQLite خلف composition مع lifecycle وfallback policy. بعدها bounded Agent Runtime، ثم Provider Gateway، ثم React Native Web/Metro، ثم Android doctor/ADB، ثم macOS-only iOS adapter، ثم visual loop بحدود iteration وapproval.

## أسئلة مفتوحة

OpenTo Desktop ما زال بلا source رسمي قابل للتحقق. يلزم تحديد React renderer، browser-metro/Snack integration، دعم EAS/remote، hardware baseline، وسياسة multi-device concurrency، وتشفير backup وkey management. يجب أن تظل الأسئلة في project state حتى يجيب المالك أو يظهر مصدر موثوق.

إعداد: Manus AI. آخر تحديث: 2026-08-22.
