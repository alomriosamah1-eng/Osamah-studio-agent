# Second Brain: Local Lexical Retrieval bounded

**الحالة:** منفذة ومتحقق منها في feature commits `57376c3363b7d3b0670f7395bc61ea5e2613738b` و`cf3227331384ab2f5b5b126fb0cf381c6ea8b8f1`؛ docs-close مستقل قيد الإعداد. تحسن الشريحة `brain.memory.searchLocal` داخل Application بعد hydration، من دون إضافة FTS5 أو embeddings أو vector service أو provider sharing.

## القرار المعماري

أظهر capability check في runtime الحالي `node:sqlite`/Node.js 22.13 أن محاولة إنشاء FTS5 virtual table تفشل برسالة `no such module: fts5`. لذلك لم تُضف migration جديدة أو native extension أو SQLite driver بديل. يبقى SQLite مصدر الحقيقة، وتبقى القراءة التشغيلية من Map محلية bounded.

> **Local lexical retrieval ليست semantic retrieval:** النتيجة تعتمد على تطابق كلمات الاستعلام بعد normalization وترتيب deterministic، ولا تدّعي stemming أو فهم المعنى أو recall دلاليًا.

| المجال | التنفيذ |
|---|---|
| السطح العام | `MemoryCapturePort.searchLocal` و`brain.memory.searchLocal` مع `visibility` اختياري؛ لا IPC method جديد، feature `cf3227331384ab2f5b5b126fb0cf381c6ea8b8f1` |
| التطبيع | `NFKC`، lowercase، حذف التشكيل والتطويل، توحيد بعض صور الألف والياء، وتوحيد whitespace/ZWNJ |
| المطابقة | كل token من query يجب أن يظهر في title أو content أو tags |
| الترتيب | title ثم tags ثم content بأوزان ثابتة، ثم `createdAt` و`entryId` لكسر التعادل |
| الحدود | query ≤512، limit ≤128، entries محملة ≤256، بلا worker أو model أو network |
| الخصوصية | visibility filter اختياري exact-match ولا يوسع الوصول؛ لا يغير providerAccess أو retention، ولا يرسل query أو content إلى provider |
| FTS5 | مؤجل؛ capability check محفوظ في `research/fts5-node-capability-check.mjs` |

## مسار التنفيذ

يبدأ البحث من `cleanText` الذي يرفض query الفارغ أو NUL أو النص غير bounded. بعد ذلك يطبّع query ويقسمه إلى tokens. يفحص النظام كل `MemoryEntry` الموجودة في Map، ويرفض entry التي لا تطابق جميع tokens، ثم يحسب score محليًا: وجود token في العنوان أعلى من tags، وtags أعلى من content. عند تساوي score يستخدم أحدث `createdAt` ثم `entryId` لضمان نتيجة deterministic.

هذا التصميم لا يضيف فهرسًا دائمًا ولا يغيّر دورة capture/review أو hydration. يقبل `searchLocal` مرشح `visibility` من القيم `private` أو `workspace` أو `project`، ويُرفض أي مرشح آخر في IPC قبل الوصول إلى Application. الإدخال المستعاد من SQLite يظل قابلًا للبحث بالطريقة نفسها، كما يثبت اختبار restart عبر typed IPC بحثًا عربيًا بعد إغلاق وإعادة فتح profile.

## العربية والإنجليزية

يعالج التطبيع حالات شائعة في النص العربي مثل التشكيل والتطويل وبعض أشكال الألف والياء، ويطبق lowercase وNFKC للإنجليزية والرموز المتوافقة. هذه معالجة lexical محافظة وليست stemming عربيًا أو تحليلًا صرفيًا. النص الأصلي لا يُستبدل؛ normalization مؤقت للمقارنة فقط.

يجب أن تبقى النتائج داخل حدود MemoryEntry التي يملكها التطبيق، وأن تحافظ على state وvisibility وproviderAccess وprovenance كما هي. لا تضيف هذه الشريحة scope جديدًا أو agent retrieval؛ أي retrieval للوكيل يحتاج عقد scope/permission مستقلًا.

## الأداء والموارد

لا تستخدم الشريحة SQLite scan أو FTS worker أو model loading؛ فهي تمر على Map محلية bounded. هذا يحافظ على startup خفيف وعلى ملاءمة Ubuntu 8GB، لكنه لا يمثل benchmark لفهرس كبير. عند زيادة الحجم مستقبلًا يجب قياس p95 وRSS/heap، وإضافة adapter مستقل لا يغير مصدر الحقيقة أو يفرض dependency على المستخدم.

## الاختبارات والبوابة

تغطي الاختبارات query متعددة الكلمات، normalization عربيًا، ترتيب title/tag/content، عدم إظهار نتائج ناقصة، visibility filtering exact-match، رفض visibility غير المسموحة، واستمرار البحث العربي بعد restart لـSQLite profile. نجح full gate في 2026-08-22 مع `pnpm check` بـ`206/206`، و`pnpm build`، و`pnpm desktop:smoke`، و`pnpm performance:smoke`، وSQLite validator وJSON وNode syntax و`git diff --check` وhigh-confidence secret scan. سجل البوابة محفوظ في [research/memory-scope-full-gate-output-2026-08-22.txt](../research/memory-scope-full-gate-output-2026-08-22.txt).

## الحدود وما يليها

لا توجد FTS5 في runtime الحالي، ولا تُخفي الشريحة هذا القيد. أصبحت visibility filtering exact-match منفذة؛ الخطوة التالية هي تقييم relational links وagent scope/permission filtering أو adapter FTS اختياري بعد توفير runtime مدعوم ومراجعة build/legal/security. لا تبدأ embeddings أو vector services أو provider sharing أو automatic consolidation من هذه الشريحة، ولا يتغير قرار Virtual Human / AI Avatar: يظل موثقًا ومؤجلًا ولا توجد voice أو avatar runtime.

## الملفات الرئيسية

| الملف | الدور |
|---|---|
| `src/application/memory-capture.ts` | normalization وscoring وbounded searchLocal |
| `src/memory-capture.test.ts` | اختبارات العربية والإنجليزية والترتيب والتطبيع |
| `src/memory-persistence.test.ts` | اختبار searchLocal بعد SQLite restart عبر typed IPC |
| `research/fts5-node-capability-check.mjs` | دليل توفر FTS5 في runtime الحالي |
| `research/memory-retrieval-fts-design-2026-08-22.md` | تحليل البدائل وقرار عدم إضافة FTS5 |

إعداد: Manus AI. تاريخ التحديث: 2026-08-22.

## مراجع داخلية

[1]: ../src/application/memory-capture.ts "Memory Capture application service"
[2]: ../src/memory-capture.test.ts "Memory lexical retrieval tests"
[3]: ../research/fts5-node-capability-check.mjs "FTS5 capability check"
[4]: ../research/memory-retrieval-fts-design-2026-08-22.md "FTS design decision"
