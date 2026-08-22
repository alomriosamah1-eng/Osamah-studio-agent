# Second Brain: SQLite Memory Persistence bounded

**الحالة:** منفذة ومتحقق منها في feature commit `48daaf1f83bbc4cc7f01ff2a4e873c5e1a9a31ad`. تضيف هذه الشريحة persistence اختيارية ومحدودة لـ`MemoryEntry` و`MemoryCandidate` عبر SQLite profile، مع إبقاء الذاكرة in-memory هي المسار الافتراضي عند عدم اختيار SQLite.

## الهدف والحدود

الهدف هو ألا تفقد الإدخالات والمرشحات المحلية عند إغلاق التطبيق وإعادة فتح profile اختياري، من دون تحويل Second Brain إلى خدمة بحث دلالي أو قناة مزامنة. لا تنشئ الشريحة provider runtime، ولا network request، ولا model loading، ولا embeddings، ولا vector service، ولا FTS، ولا provider sharing، ولا automatic consolidation.

> **قاعدة أساسية:** persistence تحفظ الحالة التي أنشأها المستخدم وراجعها محليًا؛ ولا تغيّر معنى `confirmed` إلى تحقق خارجي، ولا تغيّر `providerAccess=never`، ولا تمنح candidate أي authority تنفيذية.

| القرار | التنفيذ |
|---|---|
| backend الافتراضي | `InMemoryMemoryCapture` و`InMemoryMemoryConsolidationService` دون persistence |
| backend الاختياري | SQLite عند `storage.kind=sqlite` أو `sqlite-profile` فقط |
| سطح التطبيق | `MemoryEntryPersistencePort` و`MemoryCandidatePersistencePort` اختياريان؛ IPC لم يتغير |
| الاستعادة | hydration bounded عند إنشاء application، ثم العمل من Map محلية |
| الاتساق | repository يحفظ إلى SQLite قبل تحديث Map عند capture/review/create/consolidate |
| الحماية | redaction قبل الكتابة وvalidation fail-closed عند hydration |
| البحث | local text search الحالي فقط داخل Map؛ لا FTS ولا embeddings ولا vector retrieval |
| التزامن الخارجي | لا مزامنة، لا provider sharing، ولا External Accounts integration |

## المعمارية ومسار البيانات

تظل طبقة Application مالكة للعقود والانتقالات. يحقن `composition.ts` repositories SQLite في الخدمات فقط عندما يكون profile SQLite متاحًا؛ أما مسار memory backend فلا يحصل على persistence. تبقى handlers الحالية في `embedded-handlers.ts` معتمدة على ports نفسها، لذلك لا يحتاج renderer إلى معرفة نوع التخزين ولا يحصل على filesystem أو SQL access.

```text
Typed IPC
   │
   ▼
Memory Capture / Memory Consolidation services
   │                         │
   │ optional persistence    │ bounded Map for fast reads
   ▼                         │
SQLite repositories ◄────────┘
   │
   ▼
SQLite profile: memory_entries + memory_candidates
```

عند بدء profile SQLite، يطبق `SqliteDatabase` migrations append-only داخل transaction، ثم تنشئ الخدمات Maps محلية من قوائم bounded. بعد ذلك تكون قراءات `get` و`list` و`searchLocal` من الذاكرة، بينما تكتب العمليات المقبولة إلى repository قبل تثبيت النسخة الجديدة في Map. إذا تعذر إنشاء SQLite وكان `allowFallback` مفعّلًا، يظل التطبيق على backend in-memory وفق سياسة التخزين القائمة، ولا يدّعي persistence.

## نموذج البيانات وmigration 005

تضيف [migration 005](../db/migrations/005_memory_persistence.sql) جدولين وقيودًا SQLite على enum والقوائم JSON. لا تعدّل migrations المنشورة من 001 إلى 004. يخزن JSON حقولًا bounded فقط، ويعاد تحليله عبر validators typed بدل الوثوق بـcasts TypeScript.

| الجدول | المحتوى | الحقول JSON | الفهارس |
|---|---|---|---|
| `memory_entries` | الإدخالات التي التقطها المستخدم وحالتها وخصوصيتها ومراجعتها | `tags_json`، `provenance_json`، `warnings_json` | `idx_memory_entries_state_time`، `idx_memory_entries_visibility_state` |
| `memory_candidates` | المرشح المشتق ومصادره وحالته وسبب الحظر والمراجعة | `source_entry_ids_json`، `sources_json`، `blocked_reasons_json` | `idx_memory_candidates_state_time`، `idx_memory_candidates_scope_state` |

تتحقق migration من القيم الثابتة: أنواع entries وcandidates، الحالات، visibility، provider access، retention، الحساسية، version، والأهمية. كما تستخدم `json_valid` كحاجز SQL أولي. validator التطبيق يضيف حدود العدد والطول، uniqueness، سلامة provenance IDs، تطابق `sourceEntryIds` مع `sources`، اتساق `reviewedAt` مع `reviewReason`، وصحة timestamps. بيانات SQLite غير السليمة لا تُحوّل بصمت إلى MemoryEntry أو MemoryCandidate صالح.

بعد migration 005 تكون الحالة المتوقعة في قاعدة profile هي **5 migrations، schema version 005، و14 جدولًا و30 فهرسًا**؛ يتضمن عدّاد الفهارس فهارس SQLite الداخلية، بينما تتحقق اختبارات العقد من أسماء الفهارس التطبيقية الأربعة الجديدة صراحة.

## دورة الحياة والاستعادة بعد restart

يبدأ `MemoryEntry` في `review_required`، ويبقى `providerAccess` و`visibility` و`retention` كما اختارها المسار المحلي. عند review، تُحفظ الحالة الجديدة و`reviewedAt` و`reviewReason` والتحذير المحلي قبل تحديث Map. يبدأ `MemoryCandidate` في `review_required`، ولا يصبح `consolidated` إلا بعد قرار صريح ومصادر مؤكدة وغير محظورة؛ وعند rollback أو archive يبقى المصدر الأصلي دون mutation.

الاختبار end-to-end ينفذ capture ثم review ثم candidate create ثم consolidate عبر typed IPC، يغلق التطبيق، يعيد إنشاء Embedded Application على نفس SQLite profile، ويتحقق من عودة entry المؤكدة وcandidate المجمع. كما يغطي اختبار repository round-trip إعادة فتح القاعدة، واختبار fail-closed صفوف JSON غير المصفوفية وتعارض source IDs.

## الخصوصية وredaction

تطبق الخدمات حدود المحتوى والـIDs والقوائم قبل الوصول إلى repository. يطبق repository `sanitizeAuditText` على العنوان والمحتوى والنطاق وسبب المراجعة قبل SQL binding، ولا يسجل raw secrets في log أو audit. JSON لا يسمح إلا بالبنى المتوقعة والمحدودة، وhydration يرفض enum غير معروف أو قائمة غير bounded أو provenance غير آمنة أو candidate sources غير المتسقة.

لا ترفع persistence `providerAccess`، ولا تنشئ مشاركة مع provider أو External Accounts، ولا تستنتج تحققًا خارجيًا. backup الحالي يستطيع تضمين ملف SQLite ضمن snapshot المحلي الموثق، لكن هذه الشريحة لا تضيف تشفير backup، ولا upload، ولا restore إلى profile حي، ولا delete propagation أو retention enforcement دائمًا؛ تلك عقود مستقلة تحتاج قرارًا وتحققًا منفصلين.

## الأداء والتشغيل على Ubuntu 8GB

لا تحمل الشريحة نموذجًا أو vector index أو worker. التخزين disk-backed اختياري، والقراءات التشغيلية bounded في Map، مع حد أقصى 256 entry و128 candidate لكل hydration/list من repositories. يحافظ هذا التصميم على startup خفيف عندما لا يُطلب SQLite، ويستخدم fallback واضحًا عند فشل profile إذا كانت السياسة تسمح به. لا يمثل ذلك benchmark للبحث الدلالي؛ أي انتقال لاحق إلى FTS أو embeddings يجب أن يمر عبر Resource Policy وقياس RSS/heap ومسار degradation مستقل.

## معايير القبول

| المعيار | الحالة |
|---|---|
| عدم تغيير IPC العام أو إضافة صلاحيات للـrenderer | متحقق؛ persistence شفافة خلف Application ports |
| بقاء memory backend in-memory عند عدم طلب SQLite | متحقق عبر composition wiring الاختياري |
| capture/review ثم restart يعيدان MemoryEntry بالحالة والخصوصية والمراجعة | متحقق باختبار repository وend-to-end |
| create/consolidate ثم restart يعيدان MemoryCandidate والمصادر والحالة | متحقق باختبار repository وend-to-end |
| redaction وعدم تخزين raw secret-shaped values | متحقق واختُبر عبر raw SQLite assertion |
| hydration غير السليم fail-closed | متحقق لاختبارات JSON والمصادر غير المتسقة |
| migration append-only مع schema 005 | متحقق؛ validator وmigration tests ناجحان |
| لا embeddings أو vector/FTS أو provider sharing أو automatic consolidation | متحقق كحدود تصميم وتنفيذ |

## بوابة التحقق

نجحت البوابة في 2026-08-22: `pnpm check` بـ`204/204`، ثم `pnpm build` و`pnpm desktop:smoke` و`pnpm performance:smoke`. نجح `scripts/validate_sqlite_migration.py` مع `SQLITE_MIGRATION_VALID=true` و`MIGRATION_COUNT=5` و`SCHEMA_VERSION=005` و`TABLE_COUNT=14` و`INDEX_COUNT=30`. كما نجحت JSON validation وNode syntax validation و`git diff --check` وhigh-confidence secret scan. سجل البوابة الكامل محفوظ في [research/memory-persistence-full-gate-output-2026-08-22.txt](../research/memory-persistence-full-gate-output-2026-08-22.txt).

## الملفات الرئيسية

| الملف | الدور |
|---|---|
| `src/application/memory-capture.ts` | عقد MemoryEntry وpersistence الاختيارية وcapture/review |
| `src/application/memory-consolidation.ts` | عقد candidate وpersistence الاختيارية وconsolidation/review |
| `src/infrastructure/sqlite-memory.ts` | repositories، redaction، serialization، validation، bounded hydration |
| `src/infrastructure/sqlite.ts` | إنشاء storage وإتاحة repositories |
| `src/composition.ts` | اختيار persistence عند SQLite فقط |
| `src/memory-persistence.test.ts` | اختبار restart end-to-end عبر typed IPC |
| `src/sqlite.test.ts` | migration وround-trip وredaction وfail-closed وbackup |
| `scripts/validate_sqlite_migration.py` | التحقق البنيوي من schema 005 |

## ما يلي هذه الشريحة

أُضيفت بعد هذه الشريحة شريحة **local lexical retrieval bounded** في feature `57376c3363b7d3b0670f7395bc61ea5e2613738b`: تطبيع عربي/إنجليزي وترتيب deterministic داخل `searchLocal`، دون FTS أو semantic retrieval. أظهر capability check أن FTS5 غير متوفر في `node:sqlite` الحالي (`no such module: fts5`)، لذلك يبقى FTS/فهرس نصي دائم خيارًا مستقلًا مشروطًا بمراجعة runtime وbuild/legal/security. لا تبدأ embeddings أو vector database أو provider sharing. ويظل Virtual Human / AI Avatar موثقًا ومؤجلًا حتى مرحلته في الخطة الرئيسية؛ persistence الحالية لا تفتح voice أو avatar runtime.

إعداد: Manus AI. تاريخ التحديث: 2026-08-22.

## مراجع داخلية

[1]: ../db/migrations/005_memory_persistence.sql "SQLite migration 005"
[2]: ../src/infrastructure/sqlite-memory.ts "SQLite memory repositories"
[3]: ../src/memory-persistence.test.ts "Memory persistence restart test"
[4]: ../research/memory-persistence-full-gate-output-2026-08-22.txt "Memory persistence full gate output"
