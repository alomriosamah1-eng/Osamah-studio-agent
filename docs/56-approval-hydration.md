# ApprovalStore وPersistent Approval Hydration

**الحالة:** منفذة ومختبرة ضمن full gate؛ hydration يعمل عند إنشاء التطبيق من SQLite أو `sqlite-profile`، بينما يبقى مسار memory خفيفًا بلا ملفات.

## الهدف

تمنع هذه الشريحة فقدان تذاكر الموافقة عند إغلاق التطبيق أو إعادة فتح profile. قبل الشريحة كانت `approvals` تحفظ كيان المجال الأساسي، لكن `ApprovalTicket` الذي يحتوي `actionId` و`correlationId` و`idempotencyKey` وحالة Human Gate لم يكن يُعاد إلى `InMemoryApprovalWorkflow`. أصبحت التذكرة الآن عقدًا مستقلاً خلف `ApprovalStore`، وتُحفظ كاملة في `approval_tickets` ثم تُحمّل bounded عند إنشاء workflow.

## التصميم

| الطبقة | المسؤولية |
|---|---|
| Application | `ApprovalStore` يحفظ ويقرأ `ApprovalTicket` فقط؛ `InMemoryApprovalWorkflow` يستقبل store اختياريًا ويعيد بناء خرائط التذاكر عند الإنشاء |
| Infrastructure | `SqliteApprovalStore` ينفذ upsert وقراءة newest-first عبر SQL `LIMIT` |
| SQLite | migration `004_approval_tickets.sql` تضيف جدولًا مستقلًا مع foreign key إلى `sessions` وقيود CHECK على kind/risk/status وفهرسي pending/session |
| Composition | SQLite يمرر store الدائم إلى workflow؛ memory وfallback يستخدمان `InMemoryApprovalStore` |
| Human Gate | لا يتغير العقد الخارجي؛ `listPending` و`decide` يقرآن workflow الذي تم ترميمه |

لا تحفظ hydration prompt أو transcript أو model output. كما لا تنشئ hydration أحداثًا جديدة ولا تعيد تنفيذ provider أو patch؛ هي إعادة بناء لحالة الموافقة فقط. التذاكر ذات الحقول غير الصالحة تُهمل fail-closed بدل إدخالها إلى مسار التنفيذ.

## lifecycle بعد restart

```text
createEmbeddedApplication(sqlite/sqlite-profile)
  → SQLite migration runner applies 004
  → SqliteApprovalStore.list(256)
  → InMemoryApprovalWorkflow.hydrate(ticket)
  → HumanGate.listPending()
  → caller may decide approved|denied
  → matching WorkCycle approvalId remains required before mutation
```

تُرتب القراءة من الأحدث إلى الأقدم وتُحصر في 256 تذكرة. عند وجود أكثر من ticket pending لنفس الفعل، يحتفظ workflow بأحدث mapping فقط عند hydration، ولا يسمح بتكرار ticket لنفس `actionKey`. يظل `approvalId` المطابق وحقول الفعل كاملة شرطًا للاستئناف.

## التحقق

| الفحص | النتيجة |
|---|---|
| `pnpm check` | `78/78` اختبارًا ناجحًا |
| SQLite migration validator | `MIGRATION_COUNT=4`، `SCHEMA_VERSION=004`، 12 جدولًا، 24 index |
| SQLite store | full ticket round-trip وresolved update بعد restart PASS |
| composition | pending ticket hydration، duplicate prevention، decision persistence، وغياب pending بعد approval PASS |
| full gate | build وdesktop smoke وperformance smoke وJSON validation و`git diff --check` وsecret scan PASS |

## الحدود التالية

لا تزال `Human Gate UI` وevent streaming من main إلى renderer وaudit export/retention policy لاحقة. كما أن hydration الحالي يعيد التذاكر إلى الذاكرة عند فتح profile، ولا يقدم بعد persistent in-memory checkpoint أو multi-user identity أو role-based authorization. لا يبدأ native Android/iOS transport ولا تشغيل scripts من مشاريع الهاتف بسبب هذه الشريحة.

إعداد: Manus AI. تاريخ الفحص: 2026-08-22.
