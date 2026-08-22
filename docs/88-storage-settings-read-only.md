# Storage Settings — Read-only Snapshot

## الحالة

أُغلقت هذه الشريحة كطبقة عرض وسياسة bounded داخل Control Center. تعرض حالة backend الحالي وموقعه المنطقي وprofile وschema والـlock وbackup وretention وquota، لكنها لا تغيّر backend ولا تنقل ملفات ولا تحذف بيانات ولا تبدأ backup أو restore أو migration. العمليات الحساسة تبقى خلف عقود مستقلة وHuman Gate.

## العقد المنفذ

| العنصر | القرار |
|---|---|
| Application contract | `StorageSettings` و`StorageSettingsPort` |
| Snapshot implementation | `StaticStorageSettings`، read-only بعد التحقق |
| Composition source | `createStorageSettingsSnapshot` يقرأ `storageKind` و`profileId` ووجود profile lock وfallback reason من persistence الحالية |
| IPC | `storage.get` بpayload فارغ exact-key عبر typed IPC |
| Default backend | `memory` مع `ephemeral_memory` و`lockState=not_applicable` |
| SQLite profile | `sqlite` مع `profile_directory` و`databaseFile=studio.sqlite` و`schemaVersion=4` وlock ظاهر كحالة فقط |
| Backup | يظهر `not_configured` للذاكرة و`available_by_explicit_flow` لـSQLite، دون بدء العملية |
| Retention/quota | `not_configured` و`not_measured`؛ لا cleanup أو purge أو quota mutation |
| UI | تبويب التخزين يعرض rows للحالة والسياسة، دون أزرار تنفيذية |

## الخصوصية وحدود البيانات

لا يكشف snapshot مسار `databasePath` أو `lockPath` أو `backupsDirectory` إلى renderer، ولا يعرض مفاتيح تشفير أو محتوى ملفات أو user data. يظهر `profileId` واسم ملف قاعدة البيانات فقط عند استخدام profile storage. لا تنشئ قراءة `storage.get` مجلدًا أو lockًا، ولا تستدعي provider أو network.

تستفيد الشريحة من SQLite/profile contracts الموجودة، لكنها لا تدّعي أن backup مشفر أو أن key management منفذ. كما لا تحول وجود `available_by_explicit_flow` إلى زر restore؛ يلزم لاحقًا تصميم destination policy وchecksum وdry-run وHuman Gate.

## الملفات

| الملف | الدور |
|---|---|
| `src/application/storage-settings.ts` | العقد والتحقق وبناء snapshot |
| `src/storage-settings.test.ts` | اختبارات memory وSQLite profile والتناقضات وعدم كشف المسارات |
| `src/ipc/contracts.ts` | `storage.get` وpayload validator |
| `src/ipc/embedded-handlers.ts` | handler read-only |
| `src/composition.ts` | wiring من persistence الحالية |
| `src/ipc.test.ts` | اختبار IPC ورفض action payload |
| `prototypes/studio/index.html` | لوحة Storage Settings |
| `prototypes/studio/workspace.js` | تحميل وعرض snapshot وdesktop smoke |

## معايير القبول المتحققة

يعرض التطبيق backend الذاكرة الافتراضيًا دون side effects، ويصف SQLite profile عند طلبه دون كشف المسارات. يرفض العقد payload غير الفارغ، ويمر المسار عبر typed IPC، ويظل `storage.get` بلا filesystem mutation أو backup/restore أو deletion. نجحت اختبارات الخدمة وIPC وdesktop smoke والبوابة الكاملة.

## الحدود والخطوة التالية

تبقى الشريحة التالية في الخطة الرئيسية **Self-development Candidate Review وRule Overlay** أو localization resources حسب قرار ترتيب المالك. لا تُضاف FTS5 أو object store أو embeddings أو backup UX أو encryption/key management من هذه الشريحة. وتبقى External Accounts metadata-only، وVirtual Human / AI Avatar موثقًا ومؤجلًا ولا يتأثر بهذه الإضافة.

إعداد: Manus AI. تاريخ التنفيذ: 2026-08-22.
