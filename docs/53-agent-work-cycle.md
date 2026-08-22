# Agent Work Cycle وProject Context Index

**الحالة:** منفذة ومدفوعة ومتحقق منها عند `fb5d93ec87939125373dd8c450d1195af50fc911`؛ local == `origin/main`.

**النطاق:** تحويل خطة يقدّمها caller إلى دورة تنفيذ قابلة للمراجعة حول `BoundedAgentRuntime`: بناء context محدود، targeted read، patch preview، authorization، checkpoint، ثم apply. لا تنشئ هذه الشريحة planner أو LLM تلقائيًا، ولا تشغّل scripts أو native toolchains من المشروع.

## التسلسل المنفذ

```text
request
  → context index
  → targeted read + SHA-256
  → caller-supplied plan
  → patch preview
  → approval-required قبل queue
  → checkpoint
  → revalidate
  → apply
```

`AgentWorkCycleService` يحتفظ بـ`WorkCycleSnapshot` bounded لكل cycle. يبدأ الفعل الحساس بطلب `filesystem.write` عالي المخاطر، ويحوّل `approval_required` إلى حالة `waiting_approval` دون إنشاء job أو تغيير الملف. بعد أن يوافق Human Gate على ticket نفسها، يعاد إرسال payload نفسه مع `approvalId`، ثم يدخل patch إلى `BoundedAgentRuntime`. بهذا يبقى قرار policy في `ApprovalWorkflow`، بينما يبقى التزامن والمهلة والإلغاء في runtime.

> **مبدأ مهم:** وجود خطة caller-supplied لا يعني أن planner أو model inference منفذان. الشريحة الحالية تنفذ protocol وsafety boundary فقط، وتترك توليد الخطة لمرحلة لاحقة خلف Provider Gateway وسياسة صريحة.

## Project Context Index

يقوم `FilesystemProjectContextIndex` بالآتي:

| الجزء | السلوك |
|---|---|
| file inventory | يقرأ الملفات عبر `FilesystemProjectScanner` ويستبعد `.git` و`node_modules` و`dist` و`build` و`coverage`، ويحتفظ بحد أقصى 128 ملفًا في low-memory profile |
| manifest summary | يلخص `package.json` ويميز manifests معروفة مثل `pyproject.toml` و`Cargo.toml` و`go.mod` و`pom.xml`؛ لا يشغل package manager أو project script |
| Git status | يستخدم `git status --porcelain=v1 --branch` عبر `execFile` دون shell، ويعيد branch وstaged/unstaged/untracked/conflicted counts؛ فشل git لا يفشل index |
| targeted read | يقبل paths فريدة محدودة، ويعيد bytes وSHA-256 والمحتوى؛ الحد الأقصى 24 ملفًا و2MB إجماليًا و512KB للملف |
| safety | scanner يرفض path traversal، ولا تُقرأ symlinks من المسار العام، وتظهر التحذيرات bounded |

لا يرسل index محتوى المشروع إلى provider ولا يحفظ transcript. هو application port قابل للاستبدال لاحقًا بـGit adapter أو persistent index، مع إبقاء القراءة الحالية local-first.

## Patch Safety

يطبق `FilesystemPatchAdapter` مرحلتين منفصلتين. في preview يتحقق من root canonical، وpath داخل root، regular-file targets، duplicate paths، create/update semantics، expected source SHA، وحجم patch. في apply يعيد preview قبل الكتابة، يضع الملفات المؤقتة داخل target directories باستخدام `wx`، ثم يستبدل كل target بـ`rename`. يرفض traversal وbackslash ambiguity وsymlink targets، ويوقف apply عند تغير expected SHA بين preview وapply.

هذه atomicity لكل ملف staged وليست transaction متعددة الملفات أو rollback كاملًا. الـcheckpoint الحالي يحفظ plan digest وpatch digest وtarget file hashes فقط؛ لا يحتفظ بنسخة backup من المحتوى ولا يستطيع restore تلقائيًا. لذلك تبقى recovery وpersistent checkpoint store وbackup UX خطوات لاحقة.

## Checkpoint وEvents

يتضمن `Checkpoint` cycle ID وroot path ووقت الإنشاء وplan/patch digests وtarget files وsource hashes. يحفظ `InMemoryCheckpointStore` آخر 64 checkpoint. تنشر دورة الوكيل الأحداث التالية عبر `EventBus`: `WorkCycleStarted` و`WorkCycleWaitingApproval` و`WorkCycleCheckpointed` و`WorkCycleApplied` و`WorkCycleDenied` و`WorkCycleFailed`. عند استخدام SQLite، يحفظ `SqliteEventBus` هذه الأحداث بنفس redaction/persistence boundary ويستخدم `cycleId` كـaggregate ID.

## الحدود والموارد

تستخدم الدورة `ResourcePolicy("low_memory")` و`BoundedAgentRuntime`، فلا يوجد أكثر من agent job فعال واحد في low-memory profile. الحدود الحالية هي 32 constraint، و24 targeted paths، و16 plan/patch operations، و16 خطوة للخطة، و64 cycle snapshots، و64 checkpoints. لا تُشغّل الدورة project scripts، ولا تثق في manifest scripts، ولا تدعي native fidelity للمحاكي.

## التحقق

| الفحص | النتيجة |
|---|---|
| Context index | manifest summary وfile inventory وGit unavailable وtargeted SHA PASS |
| path/budget safety | traversal وoversized context وduplicate/unsafe patch وsymlink PASS |
| patch lifecycle | create/update وexpected SHA وrevalidation قبل apply PASS |
| approval lifecycle | waiting ثم explicit approval ثم checkpoint ثم apply PASS |
| denial/conflict | patch لا يتغير عند denial ويفشل قبل approval عند conflict PASS |
| empty patch | checkpoint بلا queue أو approval PASS |
| full suite | `71/71` اختبارًا ناجحًا |

## ما لم يُنفذ بعد

لا يوجد planner/critic أو LLM inference داخل هذه الدورة، ولا persistent project index، ولا file-tree UI/editor integration، ولا terminal policy أو Git write adapter أو checkpoint restore. ProviderGateway موجود كعقد وfixture adapter لكنه غير موصول تلقائيًا بتوليد الخطة. الخطوة التالية هي ربط دورة الوكيل بواجهة typed application/IPC، ثم إضافة persistent audit وHuman Gate UI وprovider adapters الفعلية خلف consent وprivacy policy.

يبقى Lightweight Web Preview مؤجلًا إلى آخر مراحل تصميم البيئة، ولا يبدأ Android/iOS native قبل doctor/resource contracts وقياسات الموارد.

## المراجع

[1]: ./10-backend-architecture.md "Backend Architecture"
[2]: ./14-provider-routing.md "Provider Routing"
[3]: ./45-master-implementation-plan.md "Master Implementation Plan"
[4]: ./52-provider-approval-contracts.md "Provider وApproval Contracts"

إعداد: Manus AI. تاريخ الفحص: 2026-08-22.
