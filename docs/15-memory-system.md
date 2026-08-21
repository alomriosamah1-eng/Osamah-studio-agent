# نظام الذاكرة

## الطبقات

| الطبقة | العمر | المثال | السياسة |
|---|---|---|---|
| Short-term | دقائق | آخر tool result | لا تحفظ دائمًا |
| Working | جلسة | الخطة والسياق الحالي | يضغط عند امتلاء السياق |
| Session | جلسة/أيام | transcript والأحداث | durable وقابل للبحث |
| Project | عمر المشروع | قرارات وواجهات وملفات | يملك مصدرًا وversion |
| Agent | عبر المشاريع | skill/heuristic للوكيل | لا يشارك user secrets |
| User | تفضيلات | لغة واتجاه وأسلوب | consent وvisibility |
| Long-term | دائم اختياري | facts/procedures | retention وdelete |
| Semantic | مفهوم | embedding وtopic | model version |
| Episodic | حدث | ما حدث ومتى | source references |
| Procedural | إجراء | خطوات workflow | tests وowner |
| Organizational | مساحة | standards وpolicies | RBAC مستقبلًا |

## دورة الإدخال

تمر الرسالة أو النتيجة عبر: normalize، classify، deduplicate، sensitivity check، relevance score، scope assignment، ثم persist أو discard. لا تصبح النصوص model output حقيقة تلقائيًا. يطلب النظام source أو human confirmation للقرارات والحقائق المهمة.

## الضغط والتوفير

يُحافظ على system policy وقرارات المستخدم والأخطاء الأخيرة، ويضغط وسط transcript إلى summary يحمل source event IDs. لا يضغط tool arguments الحساسة في summary عام. عند تجاوز budget، يرسل agent `context_compaction_started` ويتيح للمستخدم عرض ما حذف وما أبقى.

## الاسترجاع

يمزج retrieval بين FTS5 وvector optional وrecency وscope وimportance. الاسترجاع يعيد مقتطفًا مع `source_id`, `memory_id`, `score`, وسبب الاختيار. يُمنع خلط user memory مع project memory إلا عند policy صريحة.

## النسيان والخصوصية

كل memory item يملك retention، visibility، `can_be_exported`، و`can_be_deleted`. يدعم النظام forget project وforget user وforget session، مع حذف vector/cache/object references. لا تكفي إزالة النص من UI؛ يجب حذف الفهارس والنسخ الاحتياطية وفق retention policy.

## تحسين الذاكرة

يمكن للوكيل إنشاء skill من تجربة، لكن skill يمر عبر review وversion وpermission. Hermes يثبت عمليًا فصل memory providers وcontext engines والمهارات كامتدادات [1]. يستفيد Osamah من النمط مع اختيار provider واحد أو أكثر وفق scope، دون ربط النواة بمنتج واحد.

## التقييم

يقاس memory recall@k، precision@k، stale recall، leakage rate، وtoken savings. لا يقاس النجاح بعدد embeddings. benchmark يحتوي أسئلة عربية/إنجليزية، ملاحظات متشابهة، حذفًا مطلوبًا، ومشاريع متعارضة.

## References / المراجع

[1]: https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/architecture.md "Hermes architecture"
[2]: https://github.com/mem0ai/mem0 "Mem0 repository"
[3]: https://github.com/getzep/graphiti "Graphiti repository"

إعداد: Manus AI. تاريخ الفحص: 2026-08-21.
