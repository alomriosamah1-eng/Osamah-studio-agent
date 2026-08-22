# تنفيذ SQLite Adapter وObservability وBackup/Restore

**الحالة:** منفذ محليًا في هذه الشريحة، وقابل للدفع بعد اجتياز الفحوص النهائية.
**النطاق:** Infrastructure adapter خلف Clean Architecture ports، مع عدم تسريب `node:sqlite` إلى Domain أو Application.
**تاريخ التحديث:** 2026-08-22.
**إعداد:** Manus AI.

## القرار التنفيذي

اعتمدت هذه الشريحة `DatabaseSync` من وحدة `node:sqlite` المدمجة في Node.js 22 بدل إضافة native npm dependency. توثق Node.js أن الوحدة أضيفت في v22.5.0، وأنها تعمل عبر scheme `node:`، وأن `DatabaseSync` يوفر اتصالًا متزامنًا مع `exec` وprepared statements و`run` و`get` و`all`؛ لذلك يظل الاختيار مناسبًا لطبقة Infrastructure في Desktop process مع إبقاء العقد العليا مستقلة عن driver بعينه [1]. يظهر تحذير Node التجريبي أثناء الاختبارات، وهذا **حد معروف ومعلن** وليس ادعاءً بأن API أصبحت مستقرة خارج نطاق Node 22 المثبت في المشروع.

> القاعدة المعمارية: Domain وApplication يعرفان `SqlExecutor` وrepository ports فقط؛ أما `DatabaseSync`، وWAL، و`VACUUM INTO`، ومسارات الملفات، فتظل داخل Infrastructure.

تستخدم قاعدة البيانات المحلية ملفًا واحدًا مع `PRAGMA journal_mode = WAL` و`PRAGMA synchronous = NORMAL` وforeign-key enforcement وbusy timeout قدره خمس ثوانٍ. لا تسمح خيارات الاتصال بتحميل extensions (`allowExtension=false`). وتحوّل طبقة adapter صفوف Node ذات `null prototype` إلى plain objects حتى لا تتسرب تفاصيل driver إلى الاختبارات أو الخدمات.

## الملفات الناتجة

| الملف | المسؤولية | ملاحظة القبول |
|---|---|---|
| `db/migrations/002_observability.sql` | إضافة device profiles وpreview sessions وobservability logs والفهارس | migration جديدة غير قابلة للتعديل بعد النشر |
| `src/application/ports.ts` | `SqlExecutor` و`ObservabilitySink` و`BackupProvider` والعقود المشتركة | لا يحتوي على import من Node أو Electron |
| `src/infrastructure/sqlite.ts` | DatabaseSync adapter، migration runner، repositories، event bus، sink | يدعم restart وchecksum validation وtransactions |
| `src/infrastructure/sqlite-backup.ts` | snapshot وmanifest وSHA-256 وverify وrestore | لا يكتب فوق profile الحي؛ restore إلى profile منفصل |
| `src/infrastructure/in-memory.ts` | `InMemoryObservabilitySink` | adapter سريع لاختبارات Application |
| `src/sqlite.test.ts` | contract وfailure/restart/backup tests | يغطي الشريحة دون تشغيل مشاريع الهاتف |
| `scripts/validate_sqlite_migration.py` | validator مستقل للمigrations | يطبق 001 ثم 002 ويتحقق من schema وforeign keys |

## Migration 002

أضيفت ثلاثة جداول جديدة فوق الجداول السبعة الأصلية. يحتفظ `device_profiles` بمواصفات الجهاز اللازمة لإطار المحاكي المدمج، ويحفظ `preview_sessions` علاقة preview بالـ profile ووضع التشغيل وحالة دورة الحياة، بينما يسجل `observability_logs` أحداث diagnostics المهيكلة مع correlation id ومدة التنفيذ ونتيجة العملية وحمولة redacted.

| العنصر | التفاصيل |
|---|---|
| الجداول الجديدة | `device_profiles`, `preview_sessions`, `observability_logs` |
| القيود | `CHECK` للمنصة والوضع والحالة والأبعاد والمستوى، وforeign key من preview إلى device profile |
| الفهارس المسماة | `idx_preview_device`, `idx_observability_time`, `idx_observability_correlation` |
| إصدار schema النهائي | `002` |
| الفهرسة الكاملة المعلنة | 6 فهارس مسماة؛ validator يرى أيضًا auto-indexes التي ينشئها SQLite للـ primary keys |

يطبق runner الملفات المطابقة للنمط `NNN_name.sql` بترتيب lexical، ويخزن `migration_checksum:<file>` في `schema_meta`. إذا وجد migration مسجلة مع checksum مختلف يفشل مغلقًا برسالة صريحة، ولا يحاول حذف القاعدة أو إعادة بنائها. وإذا لم تكن migration مسجلة، يطبقها داخل transaction ثم يسجل checksum.

## Repositories وEvent Bus

يوفر `SqliteRepositories` implementations للـ Workspace وSession وApproval وDeviceProfile وPreviewSession. تستعمل عمليات الحفظ `INSERT ... ON CONFLICT DO UPDATE`، وتعيد عمليات القراءة domain entities مطابقة للعقود الحالية مع parsing متحقق من `safe_area_json`. لا ينفذ هذا المسار scripts أو `postinstall` أو native toolchains من مشاريع الهاتف.

يكتب `SqliteEventBus` في `domain_events` قبل إخطار subscribers داخل العملية. يُنشئ event id عبر `IdGenerator` ويشتق aggregate/correlation id من هوية الكيان المرتبط بالحدث. وتُمرر الحمولة عبر redaction قبل التخزين، مع إبقاء `history` in-process للاختبارات والمراقبة المحلية.

## Redaction وObservability

تستخدم طبقة redaction denylist دفاعية لمفاتيح مثل `token` و`secret` و`password` و`apiKey` و`authorization` و`prompt` و`privateKey`. تنطبق القاعدة recursively على الكائنات والمصفوفات قبل كتابة JSON إلى `domain_events` أو `observability_logs`. لا تعتبر هذه القائمة بديلًا عن سياسة أسرار كاملة؛ بل هي boundary محلية أولى يجب أن تتبعها secret provider وpolicy layer في المرحلة التالية.

يحفظ `SqliteObservabilitySink` السجلات structured داخل SQLite ويعيد أحدث السجلات بترتيب زمني عكسي، مع حد أقصى 500 سجل للقراءة الواحدة. يوجد `InMemoryObservabilitySink` للاختبارات السريعة، مما يسمح بتبديل adapter دون تغيير use cases.

## Backup وRestore

ينشئ `LocalSqliteBackupProvider` نسخة snapshot من الاتصال المفتوح باستخدام `VACUUM INTO` إلى ملف مؤقت ثم ينقله إلى `studio.sqlite` عبر rename ذري، ويكتب `manifest.json` بالطريقة نفسها. توضح وثائق SQLite أن `VACUUM INTO` ينشئ ملفًا جديدًا يحوي محتوى منطقيًا متسقًا، وأن الملف الهدف يجب ألا يكون موجودًا مسبقًا، وأن الناتج لا يغير الملف الأصلي [2]. لذلك يحذف التنفيذ فقط الملف المؤقت الخاص به، ولا يفتح backup الأصلي للكتابة أثناء التحقق.

يحتوي manifest على `formatVersion` ووقت الإنشاء وإصدار schema وSHA-256 للقاعدة وقائمة الملفات مع الحجم والـ hash. يتحقق `verify` من manifest، وpath safety، والحجم، والـ SHA-256، وschema version، و`PRAGMA foreign_key_check`. ثم يجري migration dry-run على نسخة مؤقتة من snapshot حتى لا يغير التحقق hash الملف الأصلي. ويمنع التنفيذ أن يكون backup أو restore destination هو directory profile الحي.

ينسخ `restore` snapshot المتحقق منه إلى directory منفصل بكتابة مؤقتة ثم rename، ويكتب manifest داخل profile المستعاد، ثم يعيد التحقق من SHA-256. لا توجد عملية overwrite تلقائية للقاعدة الحية، ولا يدعي هذا implementation encryption للنسخة؛ تشفير backup وkey management يبقيان قرارًا لاحقًا في طبقة privacy/release.

## الاختبارات ونتائج هذه الشريحة

تغطي الاختبارات ترتيب تطبيق migration 001 ثم 002، schema version، الفهارس، checksum mismatch، round-trip لجميع repositories، restart persistence، event bus persistence، redaction recursive، bounded observability listing، transaction rollback/commit، snapshot verification، restore profile، migration dry-run، checksum tampering، ومنع الكتابة إلى profile الحي.

| الفحص | النتيجة المحلية |
|---|---|
| `pnpm typecheck` | ناجح |
| `pnpm check` | ناجح، `31/31` اختبارًا |
| `python3 scripts/validate_sqlite_migration.py` | `SQLITE_MIGRATION_VALID=true`، migration count `2`، schema `002`، 10 جداول، 16 index entries بما فيها auto-indexes |
| SQLite backup/restore contract | ناجح داخل `src/sqlite.test.ts` |
| checksum mismatch / tampering | ناجح، الفشل مغلق برسالة واضحة |
| secret redaction fixture | ناجح، raw API key لا يدخل log snapshot |

## الحدود الحالية والخطوة التالية

هذه الشريحة لا تربط SQLite بعد بـ`createEmbeddedApplication` أو Electron profile picker؛ ما يزال composition يستخدم in-memory adapters إلى أن تُنفذ wiring اختيارية ومحمية مع clock وstorage lifecycle. كما لا تشمل FTS5 أو object store أو Agent Runtime أو provider gateway أو terminal sandbox. ولا تغير وضع المحاكي: الـ embedded preview الحالي compatibility/fixture mode، وليس React Native native renderer أو Metro runtime حقيقيًا؛ Android Emulator وiOS Simulator يظلان transports اختيارية لاحقة تغذي اللوحة نفسها.

الخطوة التنفيذية التالية المنطقية هي **production root picker عبر typed preload وmain-process dialog**، ثم حقن SQLite خلف composition root مع مسار fallback اختياري، على أن تسبق Agent Runtime. يجب إبقاء Android/iOS native مؤجلين إلى ما بعد doctor/resource contracts وقياسات الموارد، وعدم تشغيل أي scripts من مشاريع الهاتف تلقائيًا.

## المراجع

[1]: https://nodejs.org/api/sqlite.html "Node.js SQLite API documentation"

[2]: https://sqlite.org/lang_vacuum.html "SQLite VACUUM and VACUUM INTO documentation"
