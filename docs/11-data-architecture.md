# معمارية البيانات

## القرار

يبدأ المشروع بـ **SQLite + FTS5 + filesystem object store**. SQLite مناسب لحالة سطح المكتب وقابلية النقل والنسخ الاحتياطي، وFTS5 يدعم بحث الجلسات والنصوص. يضاف vector store embedded مثل LanceDB عند الحاجة، أو Qdrant كخدمة محلية اختيارية إذا تجاوز الحجم حدود SQLite. لا يصبح vector database مصدر الحقيقة؛ يظل المصدر هو النص/الوثيقة والإشارة إلى النسخة.

## طبقات التخزين

| الطبقة | التقنية المقترحة | البيانات |
|---|---|---|
| Relational | SQLite | workspaces، sessions، tasks، skills، providers، permissions |
| Full-text | SQLite FTS5 | messages، notes، extracted text |
| Vector optional | LanceDB أو Qdrant | embeddings مع source_id/version |
| Objects | filesystem content-addressed | attachments، exports، media، model cache |
| Cache | SQLite/LMDB-like bounded cache | provider responses، embeddings، thumbnails |
| Logs | structured JSONL + SQLite index | audit وdiagnostics |
| Backups | encrypted snapshots | database + manifest + selected objects |

## نموذج مرجعي

الجداول الأساسية: `workspace`, `project`, `session`, `message`, `task`, `job`, `agent_definition`, `tool_definition`, `permission_grant`, `provider`, `model`, `memory_item`, `source`, `artifact`, `checkpoint`, `audit_event`, و`migration`. كل سجل يملك `id`, `schema_version`, `created_at`, `updated_at`, و`deleted_at` عند دعم soft delete.

## الذاكرة

لا تحفظ كل رسالة طويلة كذاكرة دائمة. تمرر المرشحات عبر deduplication، sensitivity classifier، importance score، وscope check. يمكن حفظ `summary`, `facts`, `decisions`, `procedures`, و`episodes` مع source references. الذاكرة الشخصية لا تُرسل إلى provider إلا إذا صرحت policy بذلك.

## embeddings

يحفظ كل embedding مع `model_id`, `dimensions`, `content_hash`, `created_at`, و`scope`. عند تغيير model، لا تُستبدل embeddings بصمت؛ ينشأ index version جديد ويُقارن retrieval benchmark. الملفات العربية تحتاج normalization محسوبًا، مع الاحتفاظ بالنص الأصلي.

## النسخ الاحتياطي والاستعادة

ينشئ التطبيق backup atomic عبر snapshot database وmanifest وobject hashes. لا ينسخ مفاتيح API في backup غير مشفر. restoration تجري في profile منفصل أولًا، وتنفذ migrations dry-run، ثم تسمح بالاستبدال بعد تحقق checksum. يفشل backup إذا كان هناك job كتابة نشط إلا إذا كان SQLite snapshot آمنًا.

## بدائل قواعد البيانات

| البديل | الميزة | سبب عدم اختياره في MVP |
|---|---|---|
| PostgreSQL | قوي ومتعدد المستخدمين | خدمة خارجية غير لازمة لسطح مكتب واحد |
| DuckDB | تحليلات ممتازة | ليس مصدرًا طبيعيًا للجلسات والصلاحيات |
| Realm/IndexedDB | تكامل UI | أقل ملاءمة لملفات Python/CLI/backup |
| Qdrant | vector قوي | process/resource إضافي |
| LanceDB | embedded vector | يضاف بعد benchmark وليس قبل |

## References / المراجع

[1]: https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/architecture.md "Hermes session storage and FTS5 architecture"
[2]: https://github.com/lancedb/lancedb "LanceDB repository"
[3]: https://github.com/qdrant/qdrant "Qdrant repository"

إعداد: Manus AI. تاريخ الفحص: 2026-08-21.
