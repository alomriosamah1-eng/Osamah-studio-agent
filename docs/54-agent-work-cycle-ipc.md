# Typed IPC Boundary لدورة الوكيل

**الحالة:** منفذة محليًا وقيد بوابة الاختبارات والتوثيق والدفع.

تستخدم دورة الوكيل نفس قناة `osamah:dispatch` الموحدة بدل فتح قناة Electron عامة جديدة. أضيفت methods typed إلى `IpcMethodMap`:

| method | payload | النتيجة |
|---|---|---|
| `context.index` | `rootPath` | `ProjectContextSnapshot` bounded |
| `workCycle.start` | cycle/session/root/goal/constraints/targeted paths/plan/patch و`approvalId?` | `WorkCycleResult` |
| `workCycle.inspect` | `cycleId` | snapshot أو `undefined` |
| `workCycle.cancel` | `cycleId` | `cancelled` وsnapshot اختياري |

## المسار التنفيذي

يستقبل `preload.cjs` request عبر `contextBridge` ويستدعي `ipcRenderer.invoke("osamah:dispatch", request)`. لا يحصل renderer على `ipcRenderer` أو filesystem APIs. في main process يسبق dispatch فحص `isTrustedIpcSender` الذي يتطلب تطابق `senderId` وworkspace file URL، ثم `isIpcRequest` الذي يتحقق من protocol version وrequest/correlation IDs وpayload shape.

بعد اجتياز الفحص، يوجه `InMemoryIpcTransport` الطلب إلى handlers المسجلة في composition. تسجل composition `context.index` و`workCycle.*` مع `FilesystemProjectContextIndex` و`AgentWorkCycleService`. لذلك يبقى policy والـpatch في Application/Infrastructure ولا ينتقلان إلى preload أو renderer.

## Runtime validation

لا تعتمد boundary على TypeScript وحده لأن request القادم من renderer هو runtime data. لذلك يفرض validator حدودًا عملية قبل الوصول إلى handler:

| الحقل | القيد |
|---|---|
| IDs وgoal وroot | strings غير فارغة، بلا NUL، وبطول bounded |
| constraints | حتى 32 عنصرًا، كل عنصر حتى 512 حرفًا |
| targeted paths | حتى 24 path، كل path حتى 512 حرفًا |
| plan | summary bounded وحتى 16 خطوة، وكل خطوة لها id/title/description |
| patch | proposal ID وحتى 16 operation، ومحتوى operation حتى 512KB |
| expected SHA | إن وجد، يجب أن يكون 64 hex characters |
| timeout | integer موجب حتى 120000ms |
| inspect/cancel | cycle ID غير فارغ bounded |

يفشل الطلب المخالف بـ`INVALID_REQUEST` قبل handler. الطلب الصحيح شكليًا لكن cycle أو root غير صالح يعاد له خطأ من application boundary، ولا تُعرض raw secrets أو transcript إلى response.

## الموافقة والإلغاء

`workCycle.start` لا يطبق patch مباشرة. إذا كانت العملية غير فارغة، يطلب `filesystem.write` عالي المخاطر عبر `submitGuarded`. عند غياب الموافقة، يعيد `waiting_approval` دون queue أو filesystem mutation. بعد Human Gate خارجي يرسل caller `approvalId` المطابق في request جديد، ثم ينفذ runtime checkpoint وrevalidation وapply.

`workCycle.cancel` يضع cycle في `cancelled`، ويطلب إلغاء job من `BoundedAgentRuntime`، ويمنع استبدال الحالة بـ`applied` بعد عودة job. إذا كانت الدورة waiting approval أو لم تصل إلى runtime بعد، تكون النتيجة cancelled ولا يتغير أي ملف. الدورة terminal لا تعاد معالجتها؛ يعاد `cancelled: false` أو conflict عند محاولة start جديد.

## الأمان والحدود

كل methods تمر عبر sender validation وCSP و`contextIsolation: true` و`sandbox: true` و`nodeIntegration: false`. لا تضيف هذه الشريحة قناة تنفيذ أو terminal أو Git write أو provider invocation. لا تشغل project scripts أو native toolchains، ولا تمنح renderer وصولًا مباشرًا إلى `fs` أو `child_process`.

قناة `InMemoryIpcTransport` تمنع إعادة استخدام `requestId` بعد اكتمال الطلب. هذا يمنع replay على مستوى IPC، لكنه لا يستبدل `approvalId` matching أو patch `expectedSha` أو idempotency key. دورة الوكيل تستخدم `patch.proposalId` كـidempotency key لفعل الكتابة.

## الاختبارات

تغطي contract tests فتح context، start → waiting approval، explicit approval → resume → apply، inspect، cancel قبل الموافقة، عدم تغير الملف عند cancel، malformed context/cycle payloads، unknown method، duplicate request، وsender boundary القائمة. كما تغطي اختبارات Application path safety وsymlink وstale hash وcheckpoint events.

الـIPC الحالي typed application boundary وليس UI كاملًا. ما زال Human Gate UI وpersistent cycle state وIPC streaming للأحداث وplanner/critic وprovider adapters الفعلية خارج النطاق. تبقى Lightweight Web Preview في compatibility/fixture mode ومؤجلة إلى آخر مراحل تصميم البيئة.

## المراجع

[1]: ./10-backend-architecture.md "Backend Architecture"
[2]: ./45-master-implementation-plan.md "Master Implementation Plan"
[3]: ./53-agent-work-cycle.md "Agent Work Cycle وProject Context Index"
[4]: ./52-provider-approval-contracts.md "Provider وApproval Contracts"

إعداد: Manus AI. تاريخ الفحص: 2026-08-22.
