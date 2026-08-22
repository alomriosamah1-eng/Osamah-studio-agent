# Human Gate UI وTyped Approval Event Stream

**الحالة:** منفذة ومختبرة داخل Electron Workspace؛ pending approvals تظهر في اللوحة اليمنى، والقرار يمر عبر `approval.decide`، والأحداث تصل من main إلى renderer عبر قناة allowlisted وpreload typed.

## نطاق الشريحة

تضيف هذه الشريحة واجهة مراجعة فعلية داخل Workspace بدل زر approval الوهمي. اللوحة تعرض حتى ثماني تذاكر pending، وتعرض نوع الفعل ومستوى الخطر ومعرّفات المراجعة والنطاق الدلالي. لا تُبنى عناصر HTML من scope أو IDs؛ تستخدم الواجهة `textContent` لحماية العرض من HTML غير موثوق.

| المكوّن | المسؤولية |
|---|---|
| `IpcEvent` | عقد `approval.changed` الذي يحمل `ApprovalTicket` بعد runtime validation |
| `APPROVAL_EVENTS_CHANNEL` | قناة main→renderer ثابتة: `osamah:approval-events` |
| Electron main | يشترك في Domain EventBus ويرسل ticket الحالي بعد `ApprovalRequested` أو `ApprovalResolved` |
| preload | يعرّض `subscribe(listener): unsubscribe` فقط؛ لا يكشف `ipcRenderer` أو Node APIs، ويفلتر payload غير الصالح |
| Workspace | يحمّل `approval.listPending` عند الإقلاع أو الضغط على Approval Queue، ويعرض أزرار Approve/Deny عبر `approval.decide` |
| smoke | ينشئ WorkCycle ينتظر approval، يقرر approved دون تطبيق patch، ويتحقق من وصول event callback فعليًا |

## تدفق الحدث

```text
AgentWorkCycle
  → ApprovalWorkflow
  → Domain EventBus: ApprovalRequested
  → main maps current ticket
  → osamah:approval-events
  → preload subscribe filter
  → Human Gate panel renders pending ticket
  → approval.decide via typed dispatch
  → ApprovalWorkflow resolves and persists
  → Domain EventBus: ApprovalResolved
  → renderer updates panel and timeline
```

يُرسل event بعد تحديث حالة التذكرة في workflow، لذلك تصل `ApprovalResolved` بحالة `approved` أو `denied` الفعلية. لا يسمح stream بتنفيذ patch أو provider أو terminal؛ هو إشعار واجهة فقط، وتبقى mutation خلف `approvalId` المطابق وقرار Human Gate.

## حدود الأمان والأداء

الـrenderer لا يملك قناة إرسال عامة إلى main للأحداث؛ main هو المصدر الوحيد للإشعار، بينما dispatch الوارد ما زال يمر عبر sender validation وworkspace URL validation. `subscribe` يعيد unsubscribe ويُزال عند `beforeunload`، والاشتراك في main واحد فقط لتجنب listeners مكررة عند إعادة إنشاء النافذة. لا توجد network calls أو scripts من المشروع المفتوح، ولا تغييرات في lightweight preview compatibility boundary.

تظل قائمة العرض bounded بثماني تذاكر، وقراءة IPC bounded بـ32، وكل request له request ID متزايد محليًا. حالات غياب preload أو فشل القرار تظهر كرسالة تحذير ولا تتحول إلى نجاح صامت.

## التحقق

| الفحص | النتيجة |
|---|---|
| `pnpm check` | `79/79` اختبارًا ناجحًا |
| event contract | قبول `approval.changed` السليم ورفض scope الفارغ/status غير المدعوم/kind غير المعروف PASS |
| desktop security | قناة `osamah:approval-events` ثابتة، وCSP وsender validation محفوظان PASS |
| desktop smoke | WorkCycle ينتظر approval، list/decide ينجحان، event callback يصل، root picker وIPC smoke PASS |
| performance | low-memory profile وpreview تحت 20ms وRSS delta منخفض، PASS |

## الحدود التالية

لا تزال audit export/retention policy وmulti-user identity وrole-based authorization وsigned/tamper-evident audit export لاحقة. لا يزال WorkCycle checkpoint غير دائم، ولا يُدّعى native fidelity أو React Native Web/Metro parity. الخطوة التالية المنطقية هي audit export/retention policy ثم planner/critic وprovider adapters الفعلية وفق الخطة المعتمدة.

إعداد: Manus AI. تاريخ الفحص: 2026-08-22.
