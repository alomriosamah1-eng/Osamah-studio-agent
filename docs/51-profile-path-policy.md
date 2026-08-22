# Profile Path Policy وExclusive Lock

**الحالة:** منفذة ومدفوعة ومتحقق منها عند `e8c4ecca95dd51659b30d62f740c1f67ca5701ff`؛ local == `origin/main`.

**النطاق:** تعريف مسارات profile محلية deterministic، والتحقق من معرّف profile قبل استخدامه، وامتلاك profile بقفل حصري يمنع تشغيل نسختين تكتبان إلى SQLite نفسه في الوقت ذاته.

## القرار المعماري

يُعامل profile على أنه وحدة تشغيل وبيانات مستقلة داخل مجلد بيانات التطبيق الذي يحدده caller أو طبقة Desktop. لا تُشتق المسارات من input غير موثوق ولا يُسمح لمعرّف profile بإنشاء path traversal. المسار القياسي هو:

```text
<userDataDirectory>/profiles/<profileId>/
├── studio.sqlite
├── .profile.lock
└── backups/
```

يبقى `createEmbeddedApplication()` الافتراضي in-memory حتى لا ينشئ مجلدات أو ملفات أو locks أثناء اختبارات Application والمسارات الخفيفة. عند طلب `kind: "sqlite-profile"` فقط، تحسب composition المسارات القياسية، تنشئ مجلد profile، تحصل على القفل الحصري، ثم تفتح SQLite وتطبق migrations.

## Profile ID policy

يقبل `profileId` قيمًا قصيرة ومقيدة إلى `[A-Za-z0-9_-]`، مع طول من 1 إلى 64 حرفًا. تُرفض المسافات، والفواصل، والنقاط المنفردة، وأي قيمة قد تسمح بالعبور خارج مجلد `profiles`. كما تُرفض حالة استخدام filesystem root كـ`userDataDirectory` حتى لا يصبح profile directory هو جذر النظام نفسه.

> **قاعدة الأمان:** لا يتحول path غير صالح إلى مسار بديل صامت، ولا تُستخدم string concatenation غير متحققة لفتح قاعدة البيانات أو مجلد النسخ الاحتياطية.

## Exclusive lock

ينشئ `FileProfileLock.acquire()` مجلد profile ثم ملف `.profile.lock` باستخدام فتح حصري من نوع `wx`. إذا كان الملف موجودًا، ترمي العملية `ProfileLockedError` typed بدل متابعة العمل على profile مشترك. يحتوي ملف القفل metadata تشخيصية محدودة مثل `pid` ووقت الحصول وtoken عشوائي، ولا يحتوي أسرارًا أو محتوى user files.

عند `close()` أو عند فشل تهيئة SQLite بعد الحصول على القفل، يُطلق القفل. عملية `release()` idempotent؛ ولا تحذف الملف إلا إذا بقي token المالك الحالي نفسه، لتفادي حذف lock استحوذت عليه عملية أخرى بعد recovery يدوي. لا يُستخدم stale-lock cleanup تلقائيًا في هذه الشريحة لأن قتل عملية أخرى أو حذف قفل حي أخطر من طلب recovery صريح.

## دورة composition

| الحالة | السلوك |
|---|---|
| لا توجد `storage` options | in-memory، ولا profile directory أو SQLite أو lock |
| `kind: "memory"` | in-memory كما في المسار السابق |
| `kind: "sqlite"` | database path يحدده caller؛ لا يفرض profile policy تلقائيًا للتوافق الخلفي |
| `kind: "sqlite-profile"` | يحسب المسارات القياسية، ينشئ parent، يحصل على lock، ثم يفتح SQLite |
| profile مقفل | fail-closed عبر `ProfileLockedError`؛ لا fallback صامت |
| فشل SQLite مع `allowFallback: true` | يطلق lock إن أُخذ، ثم يعود إلى memory مع `storageFallbackReason` واضح |
| `close()` | يغلق SQLite ويطلق profile lock، وهو idempotent |

يظل `ResourcePolicy("low_memory")` و`BoundedAgentRuntime` كما هما في كلا المسارين؛ profile persistence لا يرفع concurrency ولا يفتح preview أو workers إضافية. بذلك لا تتغير خصائص الخفة المستهدفة لأجهزة Ubuntu Linux ذات RAM 8GB.

## حدود التهديد والحماية

تحمي السياسة من traversal العرضي أو المتعمد، ومن تشغيل composition ثانٍ على profile واحد، ومن ترك lock بعد initialization failure أو الإغلاق الطبيعي. لا تقدم هذه الشريحة تشفيرًا للبيانات أو إدارة مفاتيح أو multi-user access control أو stale-lock recovery آليًا. تبقى صلاحيات filesystem ونموذج الثقة في userDataDirectory مسؤولية طبقة Desktop وOS.

لا تُشغّل هذه السياسة project scripts أو Metro أو Expo أو Android/iOS toolchains. كما لا تجعل Lightweight Web Preview native simulator؛ تظل النتيجة compatibility/fixture mode حتى تكتمل المراحل المؤجلة.

## التحقق

| الفحص | النتيجة |
|---|---|
| profile paths deterministic | PASS؛ المسارات القياسية تعود بقيم ثابتة |
| unsafe profile IDs | PASS؛ traversal والمسافات والجذر مرفوضة |
| exclusive lock | PASS؛ المحاولة الثانية تفشل بـ`ProfileLockedError` |
| idempotent release | PASS؛ الإطلاق المتكرر لا يرمي خطأ |
| composition lifecycle | PASS؛ lock يظهر عند الفتح ويُطلق عند `close()` ثم يمكن إعادة الفتح |
| application suite | `53/53` اختبارًا ناجحًا |
| typecheck | PASS |

## الملفات

المنطق المركزي في `src/infrastructure/profile-storage.ts`. يربطه `src/composition.ts` عبر `storage.kind = "sqlite-profile"`. تغطي `src/profile-storage.test.ts` policy والقفل، ويغطي `src/composition.test.ts` lifecycle وrestart بعد release. تبقى `src/infrastructure/sqlite.ts` مسؤولة عن adapter وmigration lifecycle دون نقل تفاصيل lock إلى Domain أو Application.

## الخطوة التالية

بعد إغلاق هذه الشريحة، تنتقل الأولوية إلى **عقود Provider Gateway وapproval workflow** حول `BoundedAgentRuntime`، مع audit trail وfail-closed approvals. يأتي backup UX وencryption/key management عندما تُحسم متطلبات المنتج والثقة، بينما يبقى استكمال Lightweight Web Preview إلى آخر مراحل تصميم البيئة وفق القرار المعتمد.
