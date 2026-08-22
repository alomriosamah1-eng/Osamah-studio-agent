# Second Brain: Memory Entry Review وExplicit Confirmation

**الحالة:** منفذة ومدفوعة ومتحقق منها عند feature `4f1709cd927b77627c4532ec396f572f3bbedb2c`؛ docs-close مستقل ويحدّث summaries فقط. تضيف الشريحة مراجعة بشرية صريحة وانتقالات state bounded فوق Memory Capture، ولا تمنح provider access أو تنشئ mutation خارج سجل الذاكرة.

## الغرض

تحتاج Second Brain إلى فصل واضح بين ما التُقط من المستخدم، وما ينتظر المراجعة، وما أكده المستخدم صراحة. لا يجوز أن يصبح citation أو summary أو provider output حقيقة تلقائيًا. لذلك تضيف هذه الشريحة `MemoryReviewPort` بانتقالات typed من `review_required` إلى `confirmed` أو `archived`، مع سبب مراجعة ووقت القرار، مع إبقاء المحتوى محليًا وعدم فتح أي قناة provider.

> `confirmed` هنا يعني أن المستخدم أكد entry داخل Second Brain، وليس أن النظام أثبت صحة الادعاء خارجيًا أو قدّم نصيحة طبية/مالية/قانونية.

## state machine

| الحالة | المسموح | المعنى |
|---|---|---|
| `review_required` | `confirm` أو `archive` | entry ملتقطة ولم يعتمدها المستخدم بعد |
| `confirmed` | `archive` | المستخدم اختار تأكيدها؛ لا تتغير provenance تلقائيًا |
| `archived` | لا انتقال | مخفية من البحث الافتراضي ولا تحذف سجلها في هذه الشريحة |

لا توجد عملية `edit` أو `delete` أو `share` عامة في هذه الشريحة. تعديل المحتوى ينشئ entry جديدة مرتبطة بالأصل لاحقًا، والحذف الدائم يحتاج retention contract مستقل. confirmation لا ينشئ Human Gate ticket لأنه mutation داخل memory store محلي، لكنه يسجل `reviewReason` bounded و`reviewedAt` ويمكن تدقيقه محليًا.

## العقود

```ts
export interface MemoryReviewDecision {
  readonly entryId: string;
  readonly decision: "confirm" | "archive";
  readonly reason: string;
}

export interface MemoryReviewPort {
  review(request: MemoryReviewDecision): MemoryEntry;
  get(entryId: string): MemoryEntry | undefined;
  listForReview(limit?: number): readonly MemoryEntry[];
}
```

يضاف إلى `MemoryEntry` `reviewedAt?` و`reviewReason?`، وتبقى `state` هي مصدر الحقيقة. `confirm` لا يرفع `providerAccess`؛ entry التي أنشئت بـ`never` تظل `never` بعد التأكيد. visibility وretention لا تتغيران ضمن review. كل ID وreason bounded، وتُرفض الأسباب الفارغة أو التي تحتوي NUL أو تتجاوز 512 حرفًا.

## حدود الثقة والـprovenance

يبقى `provenance` مجرد روابط إلى source/artifact/task IDs معروفة أو مصرح بها، ولا يحوّلها review إلى `FACT`. واجهة المستخدم تعرض رسالة أن confirmation قرار ملكية/تنظيم شخصي وليس تحققًا موضوعيًا. لا تقوم الخدمة بإعادة قراءة source، ولا تقارن محتوى locator، ولا تنشئ citation جديدة أثناء confirmation.

`listForReview` يعيد entries ذات state `review_required` فقط وبحد أقصى 128، مع copies غير قابلة للتعديل من renderer. `get` يعيد projection bounded، ويظل البحث المحلي الافتراضي مستبعدًا للأرشيفية. لا تُسجل content الخام في logs، ويستمر redaction من Memory Capture.

## IPC وواجهة المستخدم

تضاف methods `brain.memory.review` و`brain.memory.listForReview`. validator يرفض القرارات غير المعروفة، IDs غير الآمنة، reasons غير bounded، وحقول `share`, `send`, `embed`, `provider`, `execute`, و`delete`. الـpreload يبقى allowlisted، والrenderer لا يحصل على Node أو filesystem.

يعرض Workspace زرّي `Confirm entry` و`Archive entry` بعد اختيار entry، مع dialog/field سبب قصير. لا يستخدم الزران browser submit أو network، ولا ينفذان filesystem mutation. بعد confirmation تظهر شارة `confirmed` ورسالة `User-reviewed; not externally verified`. archive يخفي entry من قائمة المراجعة دون حذف دائم.

## الاختبارات وبوابة الخروج

تثبت اختبارات Application أن confirmation لا يعمل من `archived`، وأن archive لا يعيد entry إلى review، وأن السبب redacted وbounded، وأن providerAccess وprovenance والـcontent لا تتغير. تثبت اختبارات IPC fail-closed ورفض duplicate/unknown fields، وتثبت Electron smoke أن المراجعة لا تنشئ approval ticket ولا network request ولا ملفًا. يقاس listForReview تحت `low_memory` مع history bounded.

تبقى persistence في SQLite، FTS/vector embeddings، semantic retrieval، consolidation، provider sharing، deletion/retention enforcement، وسجل audit دائم شرائح مستقلة لاحقة.

إعداد: Manus AI. تاريخ التحديث: 2026-08-22.
