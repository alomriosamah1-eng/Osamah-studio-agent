# قرار Second Brain: semantic memory مؤجلة

**الحالة:** قرار تصميمي موثق، وليس feature تنفيذية. بعد اكتمال SQLite persistence وlocal lexical retrieval وvisibility filtering وrelational links وagent scope filtering، تبقى semantic memory وembeddings وvector retrieval خارج runtime الحالي.

## القرار

لا تُضاف embeddings أو vector database أو provider-backed semantic retrieval في المرحلة الحالية. يحتفظ التطبيق بمسار local lexical retrieval bounded، ويظل `providerAccess` وHuman Gate وscope policy منفصلين عن أي قرار مستقبلي لتمثيل المتجهات أو استدعاء نموذج.

> **قاعدة الحقيقة:** عدم وجود FTS5 في `node:sqlite` الحالي (`no such module: fts5`) لا يبرر إدخال native dependency أو خدمة vector تلقائيًا. البديل الحالي هو lexical retrieval المنفذ والمختبر، مع إبقاء semantic retrieval قرارًا مستقلًا يحتاج runtime وخصوصية وقياسًا واضحًا.

| المسار | الحالة الحالية | القرار |
|---|---|---|
| SQLite MemoryEntry/MemoryCandidate persistence | منفذ اختياريًا عبر migration 005 | يبقى مصدر الحقيقة المحلي bounded |
| local lexical retrieval | منفذ عربي/إنجليزي مع all-token matching وترتيب deterministic | يبقى fallback المحلي السريع |
| FTS5 | فشل capability check في runtime الحالي | لا native package أو migration FTS الآن؛ يعاد تقييمه فقط مع runtime مثبت |
| embeddings | غير منفذة | مؤجلة حتى versioning وprivacy/retention وbenchmark وrebuild contract |
| vector adapter | غير منفذ | اختياري ومشروط، خلف port مستقل وscope filter وHuman Gate عند أي provider use |
| provider sharing | غير منفذ في Second Brain | لا يرفع `providerAccess` تلقائيًا ولا يرسل محتوى الذاكرة |
| semantic self-development | غير منفذ | لا يدمج قواعد أو مهارات ولا يغير policy أو permissions |

## ما هو جاهز دون semantic layer

يمكن للتطبيق التقاط MemoryEntry ومراجعتها وتأكيدها محليًا، حفظها اختياريًا في SQLite profile، البحث النصي العربي/الإنجليزي، تطبيق visibility وagent scope، وإنشاء روابط directed bounded. يمر كل ذلك عبر Application ports وtyped IPC، وتبقى البيانات redacted وbounded، ولا توجد automatic consolidation أو provider sharing.

كما أن Production Studio يملك Markdown export preview metadata-only لتقارير قابلة للتتبع، لكن هذه المعاينة لا تضيف semantic indexing ولا تجعل التقرير factual verified.

## شروط فتح semantic memory مستقبلًا

لا يبدأ التنفيذ إلا بعد مراجعة مستقلة تثبت runtime مدعومًا وقابلية التشغيل على Ubuntu 8GB، وتحدد طريقة بناء embeddings وإصدارها وإعادة بنائها عند تغير النموذج، وسياسة retention/deletion، وحدود حجم الذاكرة، ومؤشر benchmark عربي/إنجليزي، ومسار فشل عند تعطل index. يجب أن يثبت كل retrieval `sourceId` أو `entryId` وversion وscope وredaction state، وأن يُمنع stale index من تجاوز visibility أو agent policy.

إذا احتاج المسار إلى provider أو model محلي، فيجب أن يكون الاختيار صريحًا ومفصولًا عن startup، مع `ProviderGateway` وoffline/local-first policy وHuman Gate وفق نوع العملية. لا يجوز أن يتحول semantic retrieval إلى authorization system؛ authorization الحقيقي يحتاج identity/session/role boundary مستقلة.

## قرار FTS5 والمسار البديل

أثبتت fixture capability check أن FTS5 غير متوفر في Node runtime الحالي. لذلك لا تُضاف migration جديدة ولا جداول FTS ولا dependency native في هذه المرحلة. يمكن لاحقًا إنشاء `LexicalSearchPort` adapter مشروط إذا ثبت توفر FTS5 في target runtime، لكن يجب أن يظل lexical fallback الحالي قابلًا للتشغيل عند غياب الموديول.

لا تستخدم هذه الوثيقة كلمة semantic للإشارة إلى local lexical retrieval، ولا تعتبر normalization العربية أو ترتيب النتائج فهمًا دلاليًا. هذا الفصل يمنع خلط التصميم المستقبلي بالتنفيذ الحالي.

## معايير القبول للمرحلة المؤجلة

| المعيار | المطلوب قبل التنفيذ |
|---|---|
| reproducibility | versioned model/index وrebuild deterministic من MemoryEntry المعتمد |
| privacy | لا إرسال افتراضي، واحترام providerAccess وvisibility وretention وagent scope |
| traceability | كل نتيجة تعود إلى entry/source معرف ومصدر صلاحية واضح |
| stale safety | رفض index القديم أو إعادة بنائه دون تسريب scope |
| Arabic quality | benchmark مُعلن للعربية والإنجليزية، لا ادعاء جودة بلا قياس |
| low-memory | لا model/network loading عند startup، وقياس ضمن Ubuntu 8GB |
| recovery | fallback lexical عند غياب provider/index، مع close/restart آمن |
| human control | لا auto-consolidation أو auto-sharing أو policy change؛ أي mutation خلف Human Gate |

## التسلسل التالي

بعد تثبيت هذا القرار، تتابع الخطة شريحة Production Studio destination review وكتابة Markdown الآمنة أو render workers المنفصلة قبل العودة إلى قرار semantic implementation. تبقى Voice وAvatar خارج التنفيذ؛ دراسة Virtual Human / AI Avatar في docs `84–86` مكتملة توثيقيًا فقط ومؤجلة بقرار مالك مستقل.

إعداد: Manus AI. تاريخ التحديث: 2026-08-23.

## مراجع داخلية

[1]: ./91-memory-persistence-sqlite.md "SQLite memory persistence bounded"
[2]: ./92-memory-local-retrieval-bounded.md "Local lexical retrieval bounded"
[3]: ./93-memory-relational-links-bounded.md "Relational MemoryEntry links bounded"
[4]: ./94-memory-agent-scope-bounded.md "Agent scope filtering bounded"
[5]: ./95-production-markdown-export-preview.md "Markdown export preview bounded"
[6]: ../research/fts5-node-capability-check.mjs "FTS5 runtime capability fixture"
[7]: ../research/memory-retrieval-fts-design-2026-08-22.md "FTS5 and local retrieval design record"
