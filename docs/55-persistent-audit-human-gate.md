# Persistent Audit وHuman Gate

**الحالة:** منفذة ومدفوعة ومتحقق منها بعد full gate؛ آخر delivery سيُثبت في commit التوثيق النهائي.

أضيفت طبقة `SqliteAuditTrail` فوق migration `003_agent_audit.sql`، مع إبقاء `InMemoryAuditTrail` للمسار memory الافتراضي. تحفظ الطبقة الدائمة حقول القرار اللازمة للمراجعة: `correlation_id` و`action_id` و`session_id` و`kind` و`risk` و`decision` و`approval_id` و`scope` و`reason`. لا تحفظ prompt أو request payload أو transcript.

## schema 003

ينشئ migration 003 جدول `agent_audit_records` بقيود CHECK على action kind وrisk وdecision، وأربعة فهارس bounded على الوقت وcorrelation وsession وapproval. ترفع الهجرة `schema_version` إلى `003` ولا تعدّل migration منشورة سابقة. عدّل validator الرسمي ليطلب migrations `001` و`002` و`003`، و11 جدولًا و21 index entry.

| العنصر | القرار |
|---|---|
| storage | SQLite عند اختيار `sqlite` أو `sqlite-profile`، وin-memory عند default memory |
| retention | آخر 256 سجلًا في واجهة `list(limit)`؛ SQLite يحد القراءة بالـSQL LIMIT |
| ordering | الأحدث أولًا حسب `occurred_at` ثم `id` |
| redaction | sanitizer مشترك يزيل قيم assignments ذات مفاتيح token/secret/password/api-key/authorization/prompt/private-key من scope/reason |
| transaction | كل append عبارة INSERT منفصلة ضمن adapter؛ لا يوجد outbox خارجي بعد |
| restart | Audit records تبقى في قاعدة profile وتُقرأ بعد فتحها مجددًا |

> **الحد الأمني:** redaction في audit defense-in-depth وليست بديلًا عن secret provider أو منع السر من دخول action scope أصلًا. لذلك يجب أن يبقى scope قصيرًا ودلاليًا، ولا يجوز وضع prompt أو response فيه.

## Human Gate

يعرّف `HumanGatePort` العمليات `listPending(limit)` و`get(approvalId)` و`decide(approvalId, decision)`. يطبّق `InMemoryHumanGate` تحققًا من ID والقرار، ويرفض unknown أو already-resolved approvals. القرار الوحيد المقبول هو `approved` أو `denied`، ويعيد `ApprovalWorkflow` ticket بعد القرار. يقوم workflow نفسه بكتابة `AuditRecord` ونشر `ApprovalResolved`، لذلك لا يملك Human Gate مسارًا موازيًا للتدقيق.

تصل Human Gate حاليًا عبر IPC methods `approval.listPending` و`approval.decide`. لا ينفّذ `approval.decide` patch، ولا يشغّل provider أو terminal. بعد `approved` يجب على caller إعادة إرسال WorkCycle بالـ`approvalId` المطابق؛ حينها فقط يدخل filesystem write إلى `BoundedAgentRuntime`.

## lifecycle

```text
filesystem.write request
  → ApprovalWorkflow default-deny
  → persistent AuditRecord: approval_required
  → ApprovalTicket: requested
  → Human Gate listPending
  → approval.decide(approved|denied)
  → persistent AuditRecord: approved|denied
  → WorkCycle resume only with matching approvalId
```

الإلغاء أو الرفض لا يغيّران ملفات المشروع. replay للـIPC يُرفض عند إعادة استخدام `requestId`، وmismatch بين ticket والفعل يرفضه workflow، وstale patch يوقفه expected SHA. لا يتحول فشل الكتابة أو نقص ticket إلى نجاح صامت.

## حدود restart الحالية

سجل audit دائم، لكن `InMemoryApprovalWorkflow` و`InMemoryHumanGate` يحتفظان بمجموعات ticket في الذاكرة. بعد restart تكون approval rows موجودة في SQLite، لكن hydration للتذاكر إلى workflow وpending Human Gate list ما زالت خطوة لاحقة. لهذا لا يُدّعى أن الموافقات الدائمة قابلة للاستئناف بعد crash في هذه الشريحة؛ يلزم تنفيذ `ApprovalStore`/hydration صريح قبل production use.

كذلك لا يوجد event streaming من main إلى renderer، ولا UI فعلي للموافقة، ولا multi-user identity أو role-based authorization أو signed audit export أو tamper-evident hash chain. schema 003 تحسن المراجعة الدائمة ولا تعني compliance certification.

## التحقق

| الفحص | النتيجة |
|---|---|
| SQLite schema | migrations 001–003، schema `003`، جدول audit وفهارس الوقت/correlation/session/approval |
| persistent audit | append/list وredaction وrestart persistence PASS |
| Human Gate | pending listing وapproved/denied وinvalid/unknown fail-closed PASS |
| WorkCycle integration | approval ثم resume وdenial وIPC decision PASS |
| suite | `76/76` اختبارًا ناجحًا |
| full gate | build وdesktop/performance smoke وmigration/JSON/diff/secret PASS |

الخطوة التالية هي persistent approval hydration وHuman Gate UI، ثم audit export/retention policy وplanner/critic وprovider adapters الفعلية.
 يبقى Lightweight Web Preview في compatibility/fixture mode ومؤجلًا إلى آخر مراحل تصميم البيئة.

## المراجع

[1]: ./10-backend-architecture.md "Backend Architecture"
[2]: ./45-master-implementation-plan.md "Master Implementation Plan"
[3]: ./52-provider-approval-contracts.md "Provider وApproval Contracts"
[4]: ./53-agent-work-cycle.md "Agent Work Cycle وProject Context Index"
[5]: ./54-agent-work-cycle-ipc.md "Typed IPC Boundary لدورة الوكيل"

إعداد: Manus AI. تاريخ الفحص: 2026-08-22.
