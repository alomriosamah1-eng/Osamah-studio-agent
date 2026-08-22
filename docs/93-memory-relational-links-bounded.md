# Second Brain: Relational Memory Links bounded

**الحالة:** منفذة ومتحقق منها في feature commit `b4658e22690cc1b69d43fc1d25c5cffa6f72844d`. هذه الشريحة تضيف روابط محلية موجهة بين `MemoryEntry` وذاكرة SQLite الاختيارية عبر migration 006، من دون تحويل الروابط إلى graph service أو semantic retrieval.

## الهدف

الهدف هو حفظ علاقة مراجعة محلية بين إدخال ذاكرة وإدخال سابق ذي صلة، مثل `supports` أو `related_to` أو `derived_from`. تستعمل الشريحة عقد Application وtyped IPC نفسها، وتبقي المصدر الأصلي وقرار المراجعة وحقول الخصوصية مستقلة. لا تعني العلاقة أن الإدخال الهدف صحيح خارجيًا، ولا تمنح أي entry صلاحية تنفيذية أو provider access.

> **قاعدة الخصوصية:** لا يسمح النظام لرابط من نطاق أوسع، مثل `workspace`، بالإشارة إلى إدخال أضيق، مثل `private`، لأن قراءة الرابط قد تكشف وجود أو metadata لمحتوى أكثر خصوصية. تبقى هذه قاعدة اتساق محلية وليست نظام authorization كاملًا.

| المجال | التنفيذ |
|---|---|
| العقد | `MemoryEntryLink { entryId, relation }`، والعلاقات `related_to` و`supports` و`derived_from` فقط |
| الإنشاء | `CaptureMemoryRequest.links` اختياري، bounded إلى 16 رابطًا، وكل target يجب أن يكون موجودًا مسبقًا |
| الاتجاه | الرابط موجه من الإدخال الجديد إلى target سابق؛ لا تُنشأ علاقات عكسية تلقائية |
| التكرار | يمنع تكرار الزوج `entryId + relation` داخل الإدخال نفسه |
| النطاق | يرفض self-link، ويفشل عند unknown target، ويرفض widening من `workspace/project` إلى `private` |
| التخزين | `memory_entries.links_json` في migration 006؛ JSON bounded، بلا جدول graph أو index جديد |
| الاستعادة | hydration يتحقق من JSON، self-link، target existence، وvisibility compatibility قبل إعادة Map |
| الأداء | لا توجد network calls أو workers أو graph traversal؛ القوائم محصورة في 256 entry و16 link لكل entry |

## مسار البيانات

تتحقق Application من العلاقة قبل إنشاء entry: تنظف target ID، تتحقق من relation، تبحث عن target في Map، ثم تقارن visibility. عند نجاح التحقق، تحفظ الخدمة entry إلى persistence الاختيارية قبل تثبيتها في Map، كما هو الحال في capture/review. إذا لم يكن SQLite مختارًا، تبقى الروابط داخل الذاكرة فقط مثل بقية MemoryEntry.

عند تشغيل SQLite profile، تضيف migration 006 عمود `links_json` إلى جدول `memory_entries` بقيمة افتراضية `[]`. لا تعدّل migration 005 أو أي migration منشورة سابقة. يقرأ repository ما يصل إلى 256 entry للتحقق من targets ثم يعيد العدد المطلوب، حتى لا يؤدي استدعاء list بحد صغير إلى إخفاء target صالح ضمن الحد التشغيلي.

```text
CaptureMemoryRequest.links
          │
          ▼
Application validation
  relation + target + visibility
          │
          ▼
MemoryEntry.links ── save ──► memory_entries.links_json
          │                         │
          └──── restart hydration ◄─┘
```

## نموذج البيانات وmigration 006

تضيف [migration 006](../db/migrations/006_memory_entry_links.sql) العمود التالي إلى `memory_entries`:

```sql
links_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(links_json))
```

تبقى الحالة المتوقعة بعد migration 006 هي **6 migrations، schema version 006، و14 جدولًا و30 فهرسًا**. لا تنشئ migration فهرسًا جديدًا، ولا تضيف FTS5 أو vector index أو dependency native. JSON ليس مصدر صلاحية مستقلًا؛ repository يعيد بناء typed links ويفشل مغلقًا عند البنية أو enum أو target غير السليم.

## الخصوصية والسلامة

تستخدم الروابط IDs داخلية bounded ولا تسمح بمسارات مطلقة أو relative traversal أو NUL. لا تحفظ `label` أو content إضافيًا داخل links، لذلك لا تضيف قناة لتكرار الأسرار. لا يغير الرابط `providerAccess` أو `retention` أو `state`، ولا يرفع entry إلى `confirmed` ولا ينشئ approval ticket.

يفشل hydration في الحالات التالية: `links_json` ليس array، عنصر الرابط ليس object، relation غير معروفة، ID غير آمن، تكرار relation والtarget، self-link، target غير موجود ضمن البيانات المستعادة، أو محاولة ربط entry أوسع visibility بإدخال private. وتظل هذه الحماية محلية؛ أي agent scope أو authorization مستقل يحتاج عقدًا إضافيًا.

## الاستعادة والاختبارات

يختبر المسار end-to-end إنشاء entry أول ثم entry مرتبط عبر typed IPC، إغلاق Embedded Application، إعادة فتح SQLite profile، ثم التحقق من عودة الرابط. تختبر اختبارات Application unknown target وduplicate links وrelation غير المعروفة وvisibility widening. وتختبر اختبارات repository malformed JSON وself-link وunknown target وwidening أثناء hydration، إضافة إلى round-trip وredaction للحقول القائمة.

| معيار القبول | الحالة |
|---|---|
| migration append-only دون تعديل 001–005 | متحقق؛ `006_memory_entry_links.sql` مستقل |
| الروابط bounded وموجهة وذات relations ثابتة | متحقق؛ الحد 16 والعلاقات الثلاث فقط |
| target موجود قبل إنشاء الرابط | متحقق في Application، مع fail-closed إضافي في repository hydration |
| عدم وجود self-link أو duplicate link | متحقق في Application وSQLite repository |
| عدم widening للخصوصية | متحقق بمقارنة visibility وباختبار workspace → private |
| restart round-trip عبر typed IPC | متحقق في `memory-persistence.test.ts` |
| لا embeddings أو vector services أو provider sharing أو FTS5 | متحقق كحدود تصميم وتنفيذ |

## الأداء والحدود

تظل القراءة من Map محلية bounded، ولا يحدث graph traversal أو recursive expansion. لا يُستنتج من links ترتيب دلالي أو relevance score، ولا تُستخدم الروابط لاستدعاء providers. عند الحاجة إلى بحث في الجوار أو graph views مستقبلًا، يجب أن يمر عبر port مستقل وحدود depth/count وscope صريح، مع قياس RSS وheap على Ubuntu 8GB.

## بوابة التحقق

نجحت البوابة في 2026-08-22 مع `pnpm check` بـ`207/207`، و`pnpm build`، و`pnpm desktop:smoke`، و`pnpm performance:smoke`. نجح SQLite validator مع `MIGRATION_COUNT=6` و`SCHEMA_VERSION=006` و`TABLE_COUNT=14` و`INDEX_COUNT=30`، كما نجحت JSON validation وNode syntax و`git diff --check` وhigh-confidence secret scan. سجل البوابة محفوظ في [research/memory-links-full-gate-output-2026-08-22.txt](../research/memory-links-full-gate-output-2026-08-22.txt).

## ما يلي هذه الشريحة

لا تزال FTS5 غير متوفرة في runtime الحالي (`no such module: fts5`). أُضيف بعد هذه الشريحة agent scope filtering في `docs/94-memory-agent-scope-bounded.md` باستخدام AgentCatalog وقيود visibility/retention/providerAccess. الخطوة التالية هي adapter FTS اختياري إذا توفر runtime مدعوم، ثم تقييم semantic memory فقط بعد قرار مستقل. لا تبدأ embeddings أو vector services أو provider sharing من هذه الشريحة. يبقى Virtual Human / AI Avatar موثقًا ومؤجلًا ولا توجد voice أو avatar runtime.

إعداد: Manus AI. تاريخ التحديث: 2026-08-22.

## مراجع داخلية

[1]: ../db/migrations/006_memory_entry_links.sql "SQLite migration 006"
[2]: ../src/application/memory-capture.ts "MemoryEntry links and validation"
[3]: ../src/infrastructure/sqlite-memory.ts "SQLite links hydration and repository validation"
[4]: ../src/memory-persistence.test.ts "Typed IPC restart link test"
[5]: ../src/sqlite.test.ts "SQLite links round-trip and fail-closed tests"
[6]: ../research/memory-links-full-gate-output-2026-08-22.txt "Memory links full gate output"
