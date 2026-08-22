# Project Context وAgent Task Review Panel

**الحالة:** منفذة ومدفوعة ومتحقق منها عند feature `665fe76a44963736881f6f2ed519d95a2b901825`؛ إغلاق summaries النهائي مستقل في docs-close commit.

## الغرض والنطاق

تضيف هذه الشريحة سطحًا مستقلًا لمراجعة سياق المشروع وخطة مهمة الوكيل قبل أي دورة تنفيذ. يبني السطح snapshot محدودًا من `ProjectContextIndex`، ويقرأ الملفات المستهدفة وفق حدود القارئ القائم، ثم يمررها إلى planner/critic لإنتاج خطة ونقد قابلين للمراجعة. لا ينفذ هذا المسار `AgentWorkCycleService.start`، ولا `FilesystemPatchAdapter.preview/apply`، ولا `BoundedAgentRuntime`، ولا `HumanGate.authorize`، ولا terminal أو Git mutation.

> نتيجة `task.preview` هي مادة مراجعة فقط. كلمة `safeToProceed` تعني أن النقد لم يجد مخالفة blocking ضمن البيانات المحدودة؛ ولا تعني تصريحًا بالكتابة أو التشغيل أو الإرسال.

| العنصر | القرار في هذه الشريحة |
|---|---|
| Default planner | `DeterministicPlannerCritic` محلي، بلا provider call |
| Provider-backed planner | اختياري فقط عند إرسال `providerId` أو `modelId` صراحةً ومع حقن planner مناسب |
| Context | `ProjectContextSnapshot` القائم مع حدود scanner وwarnings وtruncated |
| Targeted files | `readTargeted` القائم؛ 24 مسارًا كحد أقصى |
| Mutation | غير موجودة في surface المراجعة |
| Command/runtime | غير موجودين في surface المراجعة |
| Human Gate | لا تُنشأ تذكرة؛ يبقى مطلوبًا لأي WorkCycle لاحق يغير الحالة |
| Startup | لا فهرسة ولا provider/model loading ولا network call عند startup |

## حدود Application

أضيفت خدمة `AgentTaskPreviewService` في طبقة Application. تستقبل `AgentTaskPreviewRequest`، تتحقق من النصوص والمسارات والعدد، تبني السياق، تقرأ الملفات المستهدفة، ثم تستدعي planner/critic المختار. أي provider selection غير صريح لا يستخدم planner provider-backed، وأي اختيار صريح بلا dependency provider-backed يفشل bounded بدل تجاهله بصمت.

```ts
export interface AgentTaskPreviewRequest {
  readonly rootPath: string;
  readonly goal: string;
  readonly constraints: readonly string[];
  readonly targetedPaths: readonly string[];
  readonly providerId?: string;
  readonly modelId?: string;
  readonly offlineMode?: boolean;
}

export interface AgentTaskPreviewResult {
  readonly context: ProjectContextSnapshot;
  readonly targetedFiles: readonly TargetedContextFile[];
  readonly plan: AgentPlan;
  readonly critique: PlanCritique;
  readonly safeToProceed: boolean;
  readonly warnings: readonly string[];
}
```

لا تعيد الخدمة محتوى إضافيًا خارج ما يعيده `readTargeted`، ولا تنشئ checkpoint أو audit event أو approval ticket. ويظل `ProjectContextSnapshot.rootPath` داخل طبقة التطبيق، بينما تعرض الواجهة counters وmetadata والمسارات النسبية دون الحاجة إلى عرض الجذر المطلق.

## الاختيار الافتراضي للـplanner

الاختيار الافتراضي deterministic مقصود لتكون مراجعة السياق سريعة وقابلة للتكرار وعاملة offline. إذا أرسل المستخدم `providerId` أو `modelId` صراحةً، يمكن composition حقن `ProviderBackedPlannerCritic` في الموضع الثالث من constructor؛ لا يحدث ذلك تلقائيًا من panel الحالي، الذي يرسل `offlineMode: true` ولا يرسل provider/model. لا توجد أي health check أو model loading أو network call أثناء إنشاء التطبيق أو عند فتح Workspace.

الخطة deterministic تعرض عادةً مراجعة السياق، فحص الملفات المستهدفة، إعداد proposal guarded، والتحقق قبل mutation. وإذا كان السياق truncated أو warning-bearing يضيف planner خطوة uncertainty، ويصدر critic warning قابلًا للعرض. تظل أية خطوة مستقبلية للكتابة أو الأمر منفصلة عن نتيجة هذا preview وتحتاج WorkCycle وHuman Gate مستقلين.

## typed IPC والتحقق fail-closed

أضيفت method واحدة إلى `IpcMethodMap` وembedded handlers:

| method | payload | result |
|---|---|---|
| `task.preview` | `AgentTaskPreviewRequest` | `AgentTaskPreviewResult` |

يتحقق validator من root والهدف والقيود والمسارات والحقول الاختيارية قبل الوصول إلى handler. المسارات المستهدفة relative فقط؛ يرفض validator المسار المطلق، وbackslash، و`.`، و`..`، وsegment الفارغ. وتعيد الطلبات الفاسدة `INVALID_REQUEST` بدل تمريرها إلى Application. تعيد طبقة Application التحقق مرة ثانية لضمان السلامة عند استدعائها خارج IPC.

| الحد | القيمة | السلوك |
|---|---:|---|
| constraints | 32 | رفض fail-closed عند التجاوز |
| targeted paths | 24 | رفض fail-closed عند التجاوز |
| rootPath | 4096 حرفًا | رفض النص الفارغ أو null أو newline |
| goal | 2000 حرف | رفض النص الفارغ أو null أو newline |
| constraint | 2000 حرف | رفض النص الفارغ أو null أو newline |
| targeted path | 512 حرفًا | relative-only ورفض traversal |
| provider/model id | 256 حرفًا | لا اختيار ضمني |
| warnings المعروضة | 32 | تقليم bounded |

## Workspace panel

أضيفت لوحة `Context · Agent Task Review` في inspector الجانبي. لا تطلب المراجعة إلا بعد ضغط المستخدم على `Review current task` وبعد وجود project root. تعرض اللوحة عدد ملفات السياق وmanifest، حالة truncation/warnings، metadata لكل ملف مستهدف (`relativePath` وbytes وبادئة hash)، خطوات الخطة، ونقد planner/critic. تستخدم عناصر DOM منفصلة و`textContent` و`replaceChildren` للمخرجات القادمة من المشروع أو planner؛ لا تُحوّل أسماء الملفات أو الرسائل أو الخطة إلى HTML.

الرسالة الثابتة في اللوحة توضح أن المسار لا ينفذ patch أو command أو runtime ولا ينشئ approval ticket. ولا يوجد زر Apply أو Run أو Approve داخل panel. إذا احتاج المستخدم تنفيذًا لاحقًا، يمر ذلك عبر WorkCycle surface القائمة، ثم Human Gate المناسب، وليس عبر إعادة تفسير task preview كإذن.

## الاختبارات ومعايير القبول

تغطي اختبارات Application نجاح النتيجة، propagation للتحذيرات وtruncation، رفض traversal، ورفض الحدود. وتغطي اختبارات IPC التكامل مع تطبيق حقيقي، بقاء الملف دون تغيير، عدم إنشاء approval ticket، ورفض malformed targeted path قبل Application. وتم توسيع desktop smoke لطلب `task.preview` من renderer والتحقق من الخطة والنقد والهدف وعدم زيادة approval queue.

| الفحص | النتيجة الحالية |
|---|---|
| `pnpm typecheck` | PASS |
| `pnpm test` | `136/136` PASS |
| `pnpm build` | PASS |
| `pnpm desktop:smoke` | PASS؛ `DESKTOP_IPC_SMOKE=PASS` و`DESKTOP_SMOKE=PASS` |
| filesystem mutation خلال task preview | PASS؛ fixture بقي دون تغيير |
| approval ticket خلال task preview | PASS؛ لا ticket ينشأ |
| malformed traversal عبر IPC | PASS؛ `INVALID_REQUEST` |

## الحدود المفتوحة

لا تقدم هذه الشريحة تنفيذًا فعليًا لخطة الوكيل، ولا patch generation، ولا terminal worker، ولا Git mutation، ولا provider configuration جديدة. لا تثبت هذه الشريحة parity مع Android Emulator أو iOS Simulator أو Metro؛ يظل Lightweight Web Preview مؤجلًا إلى آخر مراحل تصميم البيئة كما اتُّفق عليه. كما أن `safeToProceed` ليس approval ولا commit ولا push ولا إذنًا لتشغيل project scripts.

عند إغلاق الشريحة، يجب التمييز بين commit التنفيذ وcommit إغلاق التوثيق، والتحقق بعد كل push من أن `local_sha == remote_sha` مع بقاء working tree نظيفًا.
