# Planner وCritic Contracts

**الحالة:** منفذة ومربوطة بمسار `AgentWorkCycleService` قبل `patch.preview` وقبل إنشاء approval.

## الهدف والنطاق

تضيف هذه الشريحة مرحلة مستقلة لتحويل `goal` و`constraints` و`ProjectContextSnapshot` وtargeted files إلى خطة قابلة للمراجعة، ثم تمرير الخطة نفسها إلى ناقد مستقل. لا تستدعي الشريحة نموذجًا لغويًا أو provider خارجيًا، ولا تنفذ ملفات أو أوامر؛ التنفيذ الحالي deterministic fixture bounded ليكون أساسًا آمنًا قبل إضافة adapters فعلية.

| المكوّن | المسؤولية |
|---|---|
| `PlannerRequest` | مدخلات intent والسياق bounded إلى 32 constraint و24 targeted file |
| `PlannerPort` | عقد توليد `AgentPlan` بلا side effects |
| `CriticPort` | فحص الخطة والسياق واكتشاف blocking issues وwarnings |
| `PlannerCriticPort` | orchestration لنتيجة الخطة والنقد مع دعم proposed plan |
| `DeterministicPlanner` | توليد خطوات context → targets → proposal → verify |
| `BoundedPlanCritic` | رفض duplicate steps وunsafe paths وbyte mismatches، وتحويل truncation إلى warning |
| `AgentWorkCycleService` | استدعاء critic بعد targeted read وقبل patch preview وHuman Gate |

## ضمانات المراجعة

يمر كل `workCycle.start` الآن بالمراجعة بعد بناء context وقراءة الملفات المطلوبة. إذا احتوت الخطة على خطوة مكررة أو كان targeted path غير نسبي وآمن أو لم يتطابق byte count، ينتقل WorkCycle إلى `failed` دون إنشاء approval ودون استدعاء patch preview ودون mutation. إذا كان السياق truncated أو يحمل warnings، تبقى الخطة قابلة للتنفيذ لكن يظهر warning يتطلب مراجعة صريحة.

> **قاعدة الفصل:** Planner وCritic لا يملكان `PatchPort` أو `ApprovalWorkflow` أو filesystem access. Human Gate و`submitGuarded()` يظلان الحاجز النهائي قبل `patch.apply`، ولا يتحول قبول Critic إلى authorization للم mutation.

## الحدود

الخطوات الحالية نصوص bounded بحد أقصى 16 خطوة وطول نص 2,000 محرف. لا يوجد بعد planner يعتمد على LLM أو schema generation من provider، ولا تخطيط متعدد الدورات، ولا persistence لخطة مستقلة أو critique report. إضافة provider فعلية يجب أن تمر أولًا عبر `ProviderGateway` وtyped output validation وoffline/local-first routing، ثم تبقى النتيجة خلف Critic وHuman Gate.

## التحقق

| الفحص | النتيجة |
|---|---|
| `pnpm check` | `86/86` اختبارًا ناجحًا |
| planner/critic contracts | توليد خطة bounded وwarning للسياق truncated ورفض unsafe target وbyte mismatch وduplicate step: PASS |
| WorkCycle integration | رفض الخطة قبل approval وfilesystem mutation: PASS |
| Desktop IPC smoke | `DESKTOP_IPC_SMOKE=PASS` و`DESKTOP_SMOKE=PASS` بعد تحديث fixture بخطة صالحة |
| performance | low-memory profile، preview `12.15ms`، RSS delta حوالي `2.75MB`، PASS |
| SQLite/migration/security | schema `004`، 12 جدولًا، 24 index entry، JSON/diff/secret PASS |

## الخطوة التالية

بعد هذه العقود يمكن إضافة provider adapters الفعلية بصورة منفصلة، بدءًا من local-first adapters مثل Ollama أو llama.cpp بعد تثبيت حدود doctor/resource/quota. لا يبدأ ذلك بتشغيل تلقائي أو تحميل نماذج عند الإقلاع. تبقى Development Environment وProduction Studio وSecond Brain لاحقة وفق الخطة، ويظل Lightweight Web Preview في آخر مراحل تصميم البيئة.

إعداد: Manus AI. تاريخ الفحص: 2026-08-22.
