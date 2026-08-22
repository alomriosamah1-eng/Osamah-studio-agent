# Optional SQLite Composition وProfile Lifecycle

**الحالة:** منفذ ومدفوع ومتحقق منه عند `e9a892a42e394b92e4708847f01eafc9205b70ae`.

**النطاق:** ربط `SqliteApplicationStorage` داخل composition عند طلب صريح، مع إبقاء in-memory backend هو الافتراضي، ودعم fallback اختياري عند فشل تهيئة profile.

## القرار المعماري

لا يفتح التطبيق SQLite تلقائيًا في كل اختبار أو عند إنشاء `createEmbeddedApplication()` الافتراضي. يظل المسار الافتراضي in-memory حتى يبقى الإقلاع سريعًا وخفيفًا، خصوصًا على Ubuntu Linux بأجهزة RAM 8GB. يطلب المستهلك SQLite صراحة عبر:

```ts
createEmbeddedApplication({
  storage: {
    kind: "sqlite",
    databasePath,
    migrationsPath,
    allowFallback: true,
  },
});
```

هذا يفصل قرار persistence عن application contracts ويمنع إنشاء اتصال SQLite أو ملفات WAL عندما لا يحتاجها المسار. لا يبدأ إنشاء profile أو migration أو worker ثقيل من renderer.

## دورة الحياة

| الحالة | السلوك |
|---|---|
| لا توجد options | `storageKind = "memory"`، ولا SQLite connection |
| `kind: "memory"` | in-memory repositories وevent bus كما في المسار السابق |
| `kind: "sqlite"` مع profile سليم | تطبيق migrations ثم repositories وpersistent event bus وobservability |
| SQLite initialization failure مع `allowFallback: true` | إغلاق connection إن فُتح، ثم إنشاء in-memory backend مع `storageFallbackReason` typed |
| SQLite initialization failure دون fallback | تمرير الخطأ إلى caller بدل إخفائه أو التحول الصامت إلى backend آخر |
| إغلاق application | `close()` idempotent ويغلق SQLite connection مرة واحدة |

تطبق composition نفس `ResourcePolicy("low_memory")` في كلا المسارين. لذلك لا يؤدي اختيار SQLite إلى تغيير حدود preview أو agent queue أو زيادة concurrency. تبقى default profiles ضمن application lifecycle نفسه، بينما يعاد حفظها إلى SQLite فقط في مسار opt-in.

## Restart safety

يستخدم profile المحدد من caller ويطبق migration runner الموجود في Infrastructure. بعد إغلاق التطبيق وإعادة إنشائه بالمسار نفسه، تعود workspace والكيانات المحفوظة عبر repositories. كما تم إصلاح توليد `domain_events.event_id` ليستخدم UUID عشوائيًا، حتى لا يصطدم event ID بعد إعادة تشغيل composition أو إنشاء event bus جديد.

## Fallback policy

الفشل لا يتحول إلى fallback إلا إذا طلبه caller صراحة عبر `allowFallback: true`. تسجيل `storageFallbackReason = "sqlite_initialization_failed"` يجعل الحالة مرئية وقابلة للتدقيق بدل نجاح مضلل. لا يستخدم fallback لحالات migration checksum mismatch إلا باعتباره قرارًا صريحًا من caller؛ في الإنتاج ينبغي عادةً fail-closed وطلب إصلاح profile أو restore نظيف.

## التحقق

| الفحص | النتيجة |
|---|---|
| in-memory default | PASS؛ لا SQLite عند عدم تمرير storage |
| SQLite opt-in | PASS؛ repositories وevent bus وobservability تستخدم profile المحدد |
| restart persistence | PASS؛ workspace يعود بعد إغلاق وإعادة إنشاء application |
| fallback opt-in | PASS؛ backend يتحول إلى memory مع reason واضح |
| fallback disabled | PASS؛ initialization error لا يُخفى |
| close idempotency | PASS؛ الإغلاق المتكرر لا يرمي خطأ |
| full suite | `50/50` اختبارًا ناجحًا |
| performance smoke | PASS؛ `low_memory` وpreview compatibility ضمن حدود السلسلة السابقة |

## الحدود الحالية

لا يحدد هذا التغيير بعد profile path تلقائيًا من OS app-data، ولا يضيف encryption key management أو profile locking متعدد العمليات. كما لا يربط SQLite بعد بproduction root picker أو release packaging؛ يجب أن تأتي هذه الخطوة بعد تعريف profile ownership وmigration recovery وbackup UX. لا تزال FTS5 وobject store وprovider integrations مؤجلة.

## الملفات

الملف المركزي هو `src/composition.ts`. يمتد الاختبار في `src/composition.test.ts`، ويحافظ `src/infrastructure/sqlite.ts` على adapter وmigration lifecycle، بينما توثق `PROJECT_STATE.md` و`PROJECT_STATUS.md` الحالة التشغيلية.
