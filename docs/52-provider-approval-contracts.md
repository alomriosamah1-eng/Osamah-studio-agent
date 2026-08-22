# Provider وApproval Contracts حول Agent Runtime

**الحالة:** منفذة محليًا بعد إغلاق Profile Storage، والاختبارات وfull gate ناجحة؛ قيد commit والدفع في هذه الشريحة.

**النطاق:** إضافة عقود typed لفعل الوكيل، وبوابة موافقة قابلة للتدقيق، وProvider Gateway محلي bounded. لا تضيف هذه الشريحة مزودًا شبكيًا أو نموذجًا محليًا أو تحميلًا تلقائيًا عند إقلاع Desktop.

## القرار المعماري

يبقى `BoundedAgentRuntime` مسؤولًا عن الطابور والتزامن والمهلة والإلغاء وتاريخ jobs. لا يقرر runtime صلاحيات الفعل ولا يختار provider مباشرة؛ لذلك يحقن `AgentAuthorizationPort` اختياريًا، وتُمرر الأفعال الحساسة عبر `submitGuarded()` قبل دخول الطابور. هذا يحافظ على فصل orchestrator عن policy وprovider modules كما تحدده المعمارية الأساسية [1].

يعمل `InMemoryApprovalWorkflow` كـapplication adapter أولي. هو الذي يطبع action، يحدد هل تحتاج العملية موافقة، ينشئ `ApprovalTicket` عند الحاجة، ويحفظ domain approval وينشر `ApprovalRequested` و`ApprovalResolved`. يسجل `AuditTrail` كل قرار، ولا يدخل نص الطلب أو prompt إلى سجل التدقيق.

> **قاعدة fail-closed:** إذا كانت العملية guarded ولا يوجد authorization port، أو لم تطابق الموافقة الفعل المطلوب، أو لم تكن التذكرة approved، تُرفض العملية قبل بدء التنفيذ.

## عقد فعل الوكيل والموافقة

| العقد | الحقول/السلوك | الغرض |
|---|---|---|
| `AgentActionRequest` | `actionId`, `sessionId`, `kind`, `risk`, `scope`, و`idempotencyKey` الاختياري | وصف قابل للتدقيق لفعل واحد دون تمرير transcript كامل |
| `AgentAuthorizationDecision` | `allowed` أو `approval_required` أو `denied` مع `correlationId` وسبب و`approvalId` عند الحاجة | نتيجة policy typed قابلة للعرض والتسجيل |
| `ApprovalTicket` | action immutable، status، created/resolved timestamps، correlation | ربط الموافقة بالفعل المحدد ومنع إعادة استخدام موافقة لفعل مختلف |
| `AuditRecord` | action/session/kind/risk/decision/scope/reason دون input prompt | أثر مراجعة bounded لا يسرّب البيانات الحساسة |
| `submitGuarded` | يفوض القرار أولًا؛ لا ينشئ job عند `approval_required` أو `denied` | منع mutation أو tool عالي الخطورة قبل Human Gate |

تُسمح أفعال القراءة منخفضة المخاطر افتراضيًا. أما `filesystem.write` و`terminal.exec` و`git.commit` و`github.push` و`mcp.tool` و`browser.submit` و`media.publish`، أو أي فعل يعلن risk أعلى من `low`، فينشئ طلب موافقة صريحًا. بعد قرار `approved` يجب إعادة إرسال الفعل نفسه مع `approvalId` المطابق؛ لا تكفي موافقة مرتبطة بـscope أو action مختلف.

سجل الموافقات والتدقيق bounded: يحتفظ adapter الذاكري بحد أقصى 256 سجلًا، و`AuditRecord` يذكر metadata والسبب فقط. هذا ليس بديلًا عن persistent audit store أو UI لـHuman Gate؛ وهو مقصود كعقد اختباري خفيف قبل ربط التخزين الدائم ودورة session الكاملة.

## Provider Gateway

يعلن كل `ProviderAdapter` manifest يحتوي provider identity وtransport وprivacy وoffline capability وmodels. يعلن كل model capabilities وcontext window وstreaming وlatency وoffline flag. يطلب `ProviderInvocationRequest` capability وprivacy mode وoffline mode وside-effect class وidempotency key، بينما يعيد adapter response typed مع `requestId` وprovider/model IDs ونص النتيجة.

ينفذ `ProviderGateway` مسارًا boundedًا:

```text
request validation
  → capability/model filter
  → privacy/offline filter
  → local-first ordering
  → health check
  → dispatch
  → typed response validation
  → bounded fallback
  → route audit
```

| السياسة | السلوك المنفذ |
|---|---|
| capability mismatch | استبعاد provider قبل dispatch وإرجاع `NO_PROVIDER` إن لم يبق مرشح |
| `local_only` | استبعاد remote providers بالكامل |
| `offlineMode` | قبول adapters/models التي تعلن offline فقط |
| local-first | ترتيب local قبل remote حتى لو كان remote أسرع، ما لم يطلب المنتج سياسة أخرى لاحقًا |
| health unavailable | تخطي provider وتسجيل سبب داخلي محدود ثم تجربة fallback bounded |
| timeout/unavailable/malformed output | fallback إلى مرشح لاحق ضمن `maxFallbacks` المحدد |
| auth/billing/invalid request | fail-closed دون retry تلقائي |
| mutation | يتطلب `idempotencyKey` قبل أي dispatch، فلا يعاد إرسال mutation مجهول |
| route audit | حفظ provider/model وfallback count والسبب والتوقيت دون حفظ input |

يُنشأ `ProviderGateway` في composition بسجل route فارغ، لذلك لا توجد network calls ولا local model loads عند `createEmbeddedApplication()`. يثبت `FixtureProviderAdapter` العقد محليًا deterministic لاختبارات health وfallback وmalformed output. ربط Ollama أو llama.cpp أو remote HTTP adapters يبقى خطوة لاحقة خلف consent وprivacy policy صريحة، وفق عقد routing المرجعي [2].

## التكامل مع التطبيق

يصدر `createEmbeddedApplication()` الآن `approvalWorkflow` و`auditTrail` و`providerGateway` و`providerRouteAudit`، ويحقن `approvalWorkflow` في `BoundedAgentRuntime`. لا يرفع ذلك `ResourcePolicy("low_memory")` concurrency؛ ما يزال runtime محدودًا إلى job agent نشط واحد في profile low-memory، ولا يبدأ workers أو preview أو provider processes تلقائيًا.

هذا التكامل لا ينقل policy إلى Electron renderer ولا يكشف `ipcRenderer`. عند بناء واجهة Human Gate لاحقًا، يجب أن تستعمل boundary typed وتعرض action kind وscope وrisk وسبب القرار، مع زر approval منفصل لا يمرر أسرارًا أو نص tool output إلى policy.

## التحقق

| الفحص | النتيجة |
|---|---|
| low-risk authorization | PASS؛ القراءة المعلنة low تُسمح وتُدقق |
| approval-required | PASS؛ التذكرة تُحفظ وتُنشر أحداثها قبل التنفيذ |
| mismatch/denied ticket | PASS؛ لا يمكن إعادة استخدام الموافقة لفعل مختلف أو مرفوض |
| guarded runtime | PASS؛ `submitGuarded` يرفض قبل queue ثم يعمل بعد الموافقة المطابقة |
| no authorization port | PASS؛ guarded action fail-closed |
| local-first route | PASS؛ local يسبق remote الأسرع |
| offline/privacy filter | PASS؛ remote يُستبعد في offline وlocal-only |
| fallback | PASS؛ timeout وunavailable وmalformed output تمر إلى provider لاحق ضمن الحد |
| mutation idempotency | PASS؛ mutation بلا key يُرفض قبل dispatch |
| route audit | PASS؛ provider/model/fallback محفوظة دون input prompt |
| full suite | `63/63` اختبارًا ناجحًا |

## الحدود الحالية والخطوة التالية

لا تزال التذاكر والـaudit route والـaudit approval في adapters ذاكرية، ولا توجد بعد persistence hydration بعد restart، ولا UI فعلية لـHuman Gate، ولا persistent outbox، ولا quota tracking أو circuit breaker زمني كامل. لا يوجد remote provider adapter أو Ollama/llama.cpp process adapter، ولا تُحمّل model weights تلقائيًا. لذلك لا ينبغي وصف هذه الشريحة بأنها Provider production integration أو LLM runtime مكتمل.

الخطوة التالية هي توسيع دورة agent إلى `request → constraints → plan → targeted read → patch → approval → checkpoint`، ثم إضافة provider adapters صريحة خلف policy وconsent، مع persistent audit وrecovery. يبقى استكمال Lightweight Web Preview إلى آخر مراحل تصميم البيئة، ولا يبدأ Android/iOS native قبل doctor/resource contracts وقياسات الموارد.

## المراجع

[1]: ./10-backend-architecture.md "Backend Architecture"
[2]: ./14-provider-routing.md "Provider Routing"
[3]: ./45-master-implementation-plan.md "Master Implementation Plan"
[4]: ./51-profile-path-policy.md "Profile Path Policy وExclusive Lock"

إعداد: Manus AI. تاريخ الفحص: 2026-08-22.
