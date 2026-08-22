# تحليل تصميم local retrieval وFTS — 2026-08-22

## النتيجة

تم اختبار `node:sqlite` المضمن في Node.js 22.13 بإنشاء virtual table من نوع FTS5 وتشغيل استعلام عربي بسيط. النتيجة التشغيلية هي `ERR_SQLITE_ERROR: no such module: fts5`. لذلك لا يجوز أن تفترض شريحة التطبيق الحالية توفر FTS5، ولا يجوز إدخال native SQLite extension أو dependency بديلة إلى core الخفيف من دون مراجعة build/legal/security وقياس Ubuntu 8GB.

## القرار المرحلي

لا تُضاف migration FTS أو `CREATE VIRTUAL TABLE ... USING fts5` في الشريحة التالية. يبقى SQLite مصدر الحقيقة لـ`MemoryEntry` و`MemoryCandidate`، وتبقى `searchLocal` الحالية lexical bounded من Map بعد hydration. هذا المسار كامل ضمن حدود الخدمات الحالية: الذاكرة محلية، الحالات والخصوصية محفوظة، ولا توجد network أو provider call أو model/vector loading.

البديل الآمن المقترح هو **Bounded Local Lexical Retrieval**: تحسين normalization والبحث exact-substring داخل الذاكرة، مع `limit` وscope/visibility filters صريحة لاحقًا، من دون ادعاء stemming أو semantic recall. ويمكن لاحقًا إضافة adapter اختياري لفهرس نصي عندما يتوفر runtime مدعوم أو dependency منفصلة بعد gate مستقل؛ لا يصبح أي index مصدر الحقيقة، ويظل النص الأصلي في SQLite.

| الخيار | القرار | السبب |
|---|---|---|
| SQLite FTS5 داخل `node:sqlite` | مؤجل | module غير متوفر في runtime المثبت |
| native FTS extension أو تغيير SQLite driver | مؤجل ومشروط | يزيد binary/build/legal/security surface ولا يلزم للـMVP الحالي |
| embeddings/vector DB | مؤجل | يتعارض مع شريحة local-first الخفيفة ويحتاج provider/model/privacy/performance contracts |
| lexical search داخل Map | مستمر | متوفر، deterministic، bounded، ولا يحتاج dependency أو startup work |
| relational links/scopes | مسار تالٍ مستقل | يرفع قيمة Second Brain قبل إدخال محرك بحث ثقيل |

## حدود القبول للشريحة التالية

يجب ألا تدعي lexical retrieval أنها semantic search أو FTS. يجب أن ترفض query الفارغ أو غير المحدود، ألا تعرض entries خارج policy scope، ألا ترفع `providerAccess`، وألا تشغل provider أو network أو embeddings. يجب أن تبقى النتائج bounded وقابلة للاختبار على العربية والإنجليزية، مع الحفاظ على النص الأصلي وredaction.

## دليل التشغيل

الـfixture التنفيذي المستخدم للفحص هو `research/fts5-node-capability-check.mjs`. فشل إنشاء virtual table في Node runtime برسالة `no such module: fts5`، ولذلك يُستخدم هذا الملف كدليل قرار لا كاعتماد إنتاجي. لا يحتوي الفحص على بيانات مستخدم أو أسرار.

إعداد: Manus AI. تاريخ الفحص: 2026-08-22.
