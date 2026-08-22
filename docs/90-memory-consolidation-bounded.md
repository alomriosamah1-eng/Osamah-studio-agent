# Second Brain Memory Consolidation bounded

## الحالة والنطاق

أضيفت شريحة **Memory Consolidation bounded** فوق `MemoryEntry` الحالية. تنشئ الشريحة candidate مشتقًا من واحد إلى ثمانية entries معروفة، وتتحقق من أن مصدر كل candidate موجود، وتحتفظ بحالة المصدر وprovenance، ثم تضع النتيجة في `review_required`. لا تصبح النتيجة `consolidated` إلا بعد قرار صريح من المالك. هذه ليست semantic memory كاملة، ولا تبني embeddings أو vector index أو consolidation تلقائيًا.

| المجال | القرار المنفذ |
|---|---|
| أنواع candidate | `summary`، `fact`، `decision`، `procedure`، `episode` |
| المصدر | `sourceEntryIds` bounded، وكل مصدر يجب أن يكون موجودًا في Memory Capture |
| شرط التجميع | المصدر المؤكد `confirmed` فقط؛ `review_required` و`archived` يمنعان التجميع |
| الحالة | `review_required` ثم `consolidated` أو `archived` |
| التراجع | `rollback` يحول candidate المجمع إلى `archived`؛ لا يدّعي استعادة نسخة تاريخية غير منفذة |
| الخصوصية | `visibility=private` و`providerAccess=never` |
| النطاق | `second-brain` افتراضيًا؛ scope يتضمن provider/external يُحظر محافظًا |
| الحساسية | `routine` أو `personal` أو `sensitive` أو `secret_shaped` |
| المصدر الأصلي | لا يتغير عند create أو consolidate أو rollback |
| التخزين | candidate in-memory افتراضيًا؛ persistence اختيارية عبر SQLite profile في migration 005، دون autosave من renderer |
| البحث الدلالي | `embeddingIndex=not_configured` و`retrievalEffects=[none]` |

## دورة الحياة

الدورة المنفذة هي: `MemoryEntry capture → explicit memory review → confirmed source → candidate create → preview → explicit consolidate → rollback/archive`. إنشاء candidate لا يغير حالة المصدر. وعند rollback يبقى المصدر `confirmed` وتصبح نتيجة التجميع `archived`، وهو تراجع bounded عن الـcandidate وليس حذفًا أو استعادة لإصدار قديم.

يُصنف النص تصنيفًا محافظًا. وجود assignment ذي شكل `token=...` أو `password=...` أو `api_key=...` يجعل candidate `secret_shaped` ويمنع التجميع. المصطلحات التي تشير إلى صحة أو مالية أو هوية أو سرية تجعل candidate `sensitive` وتحتاج سياسة مستقلة. كما يمنع scope الذي يشير إلى provider أو external انتقال المادة خارج Second Brain. هذا classifier حارس أولي وليس إثباتًا دلاليًا للسلامة.

## العقود والـIPC

| السطح | العقد |
|---|---|
| Application | `MemoryCandidate` و`MemoryConsolidationPort` و`InMemoryMemoryConsolidationService` |
| Create | `memory-candidate.create` |
| Read | `memory-candidate.get` و`memory-candidate.list` و`memory-candidate.consolidated` |
| Preview | `memory-candidate.preview` مع `canConsolidate` و`sourceStates` و`sourceMutation=false` و`embeddingIndex=not_configured` |
| Review | `memory-candidate.review` بقرارات `consolidate` و`archive` و`rollback` |
| Validation | exact-key وfail-closed، source IDs فريدة، limits bounded، expiry ISO إن وُجد |
| UI | Second Brain panel لإنشاء candidate من source IDs مؤكدة وعرض block reasons وقرارات المراجعة |

العقود الجديدة لا تمنح candidate أي tool أو filesystem أو provider authority. ولا تُنشئ Approval Ticket؛ فالتجميع الحالي تغيير محلي bounded في خدمة الذاكرة، بينما الأفعال الخارجية تظل خلف Human Gate والعقود المستقلة.

## الخصوصية والأمان

النص يمر عبر `sanitizeAuditText` قبل تخزين candidate في الذاكرة، ويُقص المحتوى إلى 16,000 حرف، والمصادر إلى ثمانية IDs، والأهمية إلى 1–5، والـreview reason إلى 512 حرفًا. لا تُسجل النصوص الخام في logs من خلال الشريحة. لا يفتح النظام provider أو network أو microphone أو Avatar/voice runtime، ولا يرسل محتوى candidate إلى External Accounts.

يبقى الفرق واضحًا بين `confirmed` محليًا و`externally_verified`. تأكيد MemoryEntry لا يجعلها حقيقة خارجية، وconsolidation لا يرفع الثقة أو provider access. persistence أصبحت اختيارية ومحدودة عبر `MemoryCandidatePersistencePort` وSQLite profile، مع redaction وhydration fail-closed وrestart round-trip. أما delete propagation وaudit الدائم وsemantic redaction المتقدم وscope enforcement عبر خدمات خارجية فتحتاج تصميمًا مستقلًا.

## الأداء والذاكرة

تستخدم الشريحة Map في الذاكرة وبحد أقصى ثمانية مصادر لكل candidate و128 candidate في القراءة الواحدة، دون تحميل نموذج أو تشغيل worker أو خدمة خارجية. لذلك هي أساس مناسب لمسار Ubuntu 8GB، لكن لا يجوز اعتبار ذلك benchmark للـsemantic retrieval. أي embedding أو vector index مستقبلي يجب أن يمر عبر Resource Policy وقياس RSS/heap وdegradation ladder، مع text/local retrieval fallback وعدم تعطيل Workspace.

## الاختبارات والبوابة

تغطي اختبارات Application حفظ source provenance، منع المصادر غير المؤكدة، منع الحساسية وscope escape وsecret-shaped content، bounded inputs، explicit consolidate، المحافظة على المصدر، وrollback. وتغطي اختبارات IPC create/preview/review ورفض `token` أو الحقول الزائدة. ويغطي desktop smoke التسلسل من MemoryEntry المؤكد إلى candidate preview ثم consolidate ثم rollback مع فحص أن المصدر لم يتغير.

نجحت بوابة شريحة persistence في 2026-08-22: `pnpm check` بـ`204/204`، و`pnpm build`، و`pnpm desktop:smoke`، و`pnpm performance:smoke`، وSQLite migration/JSON/Node syntax/diff/secret validation. أثبت validator: `MIGRATION_COUNT=5` و`SCHEMA_VERSION=005` و`TABLE_COUNT=14` و`INDEX_COUNT=30`. تغطي الاختبارات round-trip بعد restart وfail-closed للـJSON والمصادر غير المتسقة. نتائج الأداء smoke للمشروع والمسار الحالي وليست قياسًا لفهرس متجهي أو نموذج semantic.

## الملفات والحدود

| الملف | الدور |
|---|---|
| `src/application/memory-consolidation.ts` | النموذج والتصنيف والـpreview والـreview |
| `src/memory-consolidation.test.ts` | اختبارات المصدر والحساسية والتجميع والتراجع |
| `src/ipc/contracts.ts` | methods وvalidators |
| `src/ipc/embedded-handlers.ts` | handlers المحلية |
| `src/composition.ts` | wiring مع Memory Capture الحالية |
| `src/ipc.test.ts` | اختبار IPC والحمولات الزائدة |
| `prototypes/studio/index.html` | لوحة Second Brain |
| `prototypes/studio/workspace.js` | العرض والإنشاء والمراجعة وdesktop smoke |

تبقى **FTS/semantic retrieval، embeddings، vector database، deduplication الدلالي، external verification، provider sharing، automatic consolidation، وحقن النتائج في Agent Runtime** خارج النطاق. SQLite persistence المنفذة هنا اختيارية ومحدودة إلى `MemoryEntry` و`MemoryCandidate`، ولا تضيف FTS أو vector retrieval أو provider sharing أو automatic consolidation. كما يبقى Virtual Human / AI Avatar موثقًا ومؤجلًا حسب الخطة، ولا يتأثر بهذه الشريحة.

إعداد: Manus AI. تاريخ التنفيذ: 2026-08-22. feature: `48daaf1f83bbc4cc7f01ff2a4e873c5e1a9a31ad`.
