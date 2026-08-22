# Provider-backed Planner Architecture

**الحالة:** منفذة ومدفوعة ومتحقق منها ضمن الشريحة الحالية.

## نتيجة المراجعة

المسار الحالي يفصل `ProviderGateway` عن `PlannerCriticPort`: الـGateway يستطيع تنفيذ `ProviderInvocationRequest` bounded، بينما `DeterministicPlannerCritic` يعمل محليًا وبشكل متزامن، و`AgentWorkCycleService` يستقبل `plan` إجباريًا من caller ثم يمرره إلى critic. لذلك لم تقتصر الشريحة على إضافة provider fields إلى IPC؛ بل مرّ اختيار provider/model إلى Planner port، وأصبح WorkCycle قادرًا على طلب خطة جديدة عند غياب `plan` مع استمرار approval وpatch guards كما هي.

| نقطة الربط | الوضع الحالي | التعديل المقترح |
|---|---|---|
| `ProviderInvocationRequest` | يحدد capability/privacy/model، ولا يحدد provider صراحة | إضافة `providerId?` مع filtering صريح؛ غيابه يحافظ على local-first routing |
| `PlannerPort`/`PlannerCriticPort` | synchronous، والـplan إجباري في WorkCycle | دعم نتيجة sync أو Promise، و`await` داخل WorkCycle دون كسر deterministic adapter |
| `WorkCycleRequest` | `plan` إجباري | جعله اختياريًا للـinitial start فقط؛ عند غيابه يُستدعى provider-backed planner، وعند resume بعد approval يُعاد إرسال plan الناتج أو يُرفض الطلب fail-closed |
| provider/model selection | غير موجود في WorkCycle/IPC | إضافة `providerId?`, `modelId?`, و`offlineMode?` كحقول bounded typed |
| LLM output | `ProviderInvocationResponse.text` نص bounded | parser JSON strict لخطة `AgentPlan`، يرفض fences/fields/steps غير الصالحة أو النص الأكبر من limit |
| startup | composition لا يسجل providers افتراضيًا ولا يجري probe | إبقاء التسجيل اختياريًا، وLlmPlannerPort lazy؛ لا network ولا model loading عند startup |

## التصميم

أضيف `AsyncPlannerPort` كحد Application و`LlmPlanner` كتنفيذ provider-backed يعتمد على `ProviderGateway` عبر port لا على adapter محدد، مع `ProviderBackedPlannerCritic` الذي يولد الخطة فقط عند غياب `plan` ويشغل `BoundedPlanCritic` بعدها.
 يبني prompt bounded من goal وconstraints وcontext snapshot وtargeted files، ويرسل request capability `text` أو `structured_output` حسب manifest المتاح، وprivacy `local_only`، وside effect `none`، مع `providerId/modelId/offlineMode` الممررة typed. تُحفظ حدود prompt/output ولا تدخل secrets أو ملفات كاملة خارج targeted context.

يحلل الـport الاستجابة إلى `AgentPlan` عبر JSON shape محدود: `summary` غير فارغ وبحد نصي، و`steps` بحد أقصى 16، وكل خطوة تحمل `id/title/description` نصية. لا يُنفذ أي tool call ولا filesystem mutation نتيجة الاستجابة. إذا فشل provider أو parsing، تعود `ProviderGatewayError`/خطأ planner إلى WorkCycle كحالة `failed` دون patch أو approval مزيف.

يستمر `BoundedPlanCritic` بعد توليد الخطة، ثم يبقى ترتيب WorkCycle: context build → targeted read → planner/critic → patch preview → Human Gate → checkpoint → revalidate → apply. تحفظ `WorkCycleSnapshot` اختيار provider/model/offline mode، ويرفض resume أي تغيير في هذا الاختيار.
 لا يسمح provider selection بتجاوز `Human Gate`؛ اختيار provider لا يمنح authorization للكتابة. جميع provider invokes الخاصة بالتخطيط `sideEffect: none`، أما mutation فتبقى خلف `submitGuarded` وapproval matching وidempotency.

## قواعد الاختيار

| الحالة | السلوك |
|---|---|
| لا يوجد `providerId` | يستمر Gateway في local-first/offline policy الحالية؛ deterministic planner يبقى fallback composition صريحًا إذا لم يوجد provider-backed planner |
| يوجد `providerId` | لا يسمح Gateway بالانتقال إلى provider آخر غير المختار؛ disabled/unavailable/model mismatch يفشل بوضوح |
| يوجد `modelId` | يجب أن يطابق model manifest capability المطلوبة؛ لا يوجد تخمين أو model discovery تلقائي |
| `offlineMode=true` | لا يُقبل إلا provider/model المعلنان `offline` |
| provider غير مسجل أو config disabled | لا يتحول إلى healthy/available، ولا يبدأ network probe خارج invoke/doctor الصريح |

## التنفيذ والاختبارات

تثبت الاختبارات أن prompt/output bounds وJSON parsing وprovider/model routing وoffline policy وmalformed output وprovider failure كلها fail-closed، وأن deterministic planner لا يتغير. يثبت WorkCycle أن غياب plan يطلب خطة من planner، وأن critic rejection أو planner failure لا يصل إلى patch preview أو filesystem mutation، وأن approval resume يرفض تغيير الاختيار. يمر Electron smoke بطلب typed يحدد provider/model مع fixture provider فقط، دون network حقيقي أو model loading عند startup.

| الفحص | النتيجة |
|---|---|
| `pnpm check` | `105/105` اختبارًا ناجحًا |
| ProviderGateway | providerId صريح يمنع fallback، وoffline/local-only policy محفوظة |
| LlmPlanner | structured JSON strict، bounded prompt/output، وside effect `none` |
| WorkCycle | plan-less generation، provider/model snapshot، Human Gate قبل mutation، وresume consistency |
| Electron smoke | Provider list/configure/doctor، provider-backed plan، root picker، Human Gate وIPC: PASS |
| Performance/security | low-memory profile، no startup network، migration/JSON/diff/secret scans: PASS |

الـcommit التنفيذي للشريحة هو `358e339e52f1a07e95c5e266f18bd37ba36072e3`، وهو متطابق مع `origin/main` بعد نجاح full gate؛ وسيأتي commit توثيق الحالة اللاحق لتثبيت التسليم الحي.

## الحدود

هذه الشريحة لا تضيف streaming أو tool calling أو remote providers أو model discovery أو persistence مستقلة لإعدادات providers. وستظل Ollama وllama.cpp adapters اختياريين؛ الاختبار الحقيقي يستخدم fixture adapter bounded. استكمال Lightweight Web Preview يبقى في آخر مراحل تصميم البيئة، ولا يبدأ Android/iOS native قبل doctor/resource contracts وقياسات الموارد.
