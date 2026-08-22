# معمارية التوثيق والتتبع ونظام التقارير

**الحالة:** قرار توثيقي موثق، مع تنفيذ يدوي حاليًا وعدم وجود report generator أو documentation agent قابل للتشغيل.

## 1. الهدف

يجب أن يستطيع مطور جديد تتبع كل قدرة من المتطلب إلى التنفيذ والاختبار والتسليم، مع تمييز `VERIFIED`, `PARTIALLY VERIFIED`, `DOCUMENTED ONLY`, `IMPLEMENTED BUT UNDOCUMENTED`, `MISSING`, `UNKNOWN`, و`CONFLICTING`. لا تُستخدم كلمة “تم” إذا كان الدليل وثيقة تخطيطية فقط.

## 2. خريطة الوثائق التدريجية

لا يُعاد تسمية مجلد `docs` دفعة واحدة لأن ذلك يكسر الروابط ويخلط التاريخ بالحالة الحالية. بدلًا من ذلك، يعتمد المشروع mapping تدريجيًا:

| النطاق | المحتوى |
|---|---|
| `00-overview` | الرؤية، الأقسام الثلاثة، vocabulary، boundaries |
| `01-product`–`05-requirements` | المنتج، business، market، feasibility، requirements/PRD |
| `06-architecture`–`08-tools` | architecture، agents، policies، tool contracts |
| `09-integrations`–`13-dependencies` | connectors، security، testing، DevOps، dependencies |
| `14-decisions`–`16-database` | ADR/TDR، API، migrations، persistence |
| `17-deployment`–`18-maintenance` | packaging، releases، backup، incident/runbook |
| `19-reports`–`20-handover` | التقارير، acceptance، handoff، continuation |

الوثائق الحالية المرقمة تبقى مصدرًا تاريخيًا صالحًا. كل وثيقة جديدة تحمل category في العنوان أو index، وتربط بالوثائق السابقة بدل نسخها أو حذفها.

## 3. Traceability Record

```text
TraceabilityRecord {
  schemaVersion
  requirementId
  specificationRefs[]
  agentId?
  toolIds[]
  implementationRefs[]
  testRefs[]
  documentationRefs[]
  deploymentRefs[]
  status
  evidenceRefs[]
  openQuestions[]
  checkedAt
}
```

`agentId` و`toolIds` اختيارية فقط للقدرات التي لا تملك Agent أو Tool بعد، لكن يجب أن يكتب السجل `MISSING` بدل ترك خانة توحي بالاكتمال. `deploymentRefs` لا تعني GitHub commit فقط؛ المقصود build/installer/release evidence عند دخول مراحل packaging.

## 4. Feature Traceability الحالية

| Feature | Requirement/spec | Agent/Tool | Code/Test | Docs | Deployment | الحكم |
|---|---|---|---|---|---|---|
| Embedded Preview | `MOB-001..005`, preview docs | Mobile/Frontend موثق فقط، preview adapter | `src/mobile`, preview tests، desktop smoke | docs mobile/preview | لا installer | `PARTIALLY VERIFIED` |
| Agent WorkCycle | WorkCycle acceptance | Planner/Critic/Human Gate، patch adapter | application + IPC + tests | docs 53/54 | لا release artifact | `PARTIALLY VERIFIED` |
| Production provenance | source/claim/artifact requirements | Production/Research موثقون | source/content/asset/artifact tests | docs 69–72 | render/export مفقود | `PARTIALLY VERIFIED` |
| Render policy | low-memory/destination policy | Production/QA موثقون | render-policy + IPC/smoke | docs 73 | execution false | `VERIFIED` bounded policy |
| Memory Capture/Review | local capture/review | Knowledge/Review موثقون | memory application/IPC/desktop tests | docs 74/75 | in-memory default | `VERIFIED` bounded |
| Agent Catalog | 46 role definitions | Agent/Tool not implemented | no code/test | docs 77 | no deployment | `MISSING` |
| Preview Sharing | client preview | Integration/Security planned | no port/adapter/test | docs 78 | no deployment | `MISSING` |
| Playwright | browser/E2E evidence | QA planned | no dependency/test | docs 78 | dev-only future | `MISSING` |
| OAuth/Google | connected accounts | Integration/Security planned | no coordinator/token store | docs 78 | no deployment | `MISSING` |
| MCP | scoped external tools | Tool/Security planned | no client/router | docs 78 | no deployment | `MISSING` |
| Reports | report outputs | Documentation/Report planned | manual Markdown only | this doc/76 | no generator | `DOCUMENTED ONLY` |

## 5. ReportDocument المقترح

```text
ReportDocument {
  reportId
  kind
  title
  scope
  generatedAt
  author
  inputs[]
  evidence[]
  claims[]
  assumptions[]
  decisions[]
  risks[]
  unresolvedQuestions[]
  reviewState
  sourceRefs[]
  artifactRefs[]
  redactionState
}
```

القيم المقترحة لـ`kind` هي `project_discovery`, `market_research`, `feasibility`, `business_model`, `product_strategy`, `technical_analysis`, `architecture`, `agent_system`, `security`, `dependency`, `testing`, `performance`, `release`, `maintenance`, و`final_handover`. يبدأ التنفيذ لاحقًا بـin-memory preview وMarkdown adapter، ولا يضيف PDF/export/provider generation أو network تلقائيًا.

## 6. متطلبات Documentation Agent لاحقًا

Documentation Agent لا يملك صلاحية تعديل الكود أو تغيير status إلى VERIFIED. يقرأ Git diff وtest outputs وtraceability records، يقترح تحديثًا، يكشف stale counts/broken links/duplicate claims، ثم يطلب مراجعة بشرية قبل commit. لا يضع secrets أو raw user files أو traces في التقرير، ويشير إلى `UNVERIFIED` و`DECISION REQUIRED` صراحة.

## 7. متطلبات التحقق

ينبغي إضافة doc checks مستقبلية للتحقق من الروابط المحلية، وجود الملفات المشار إليها، SHA format، عدم استخدام status غير معروف، اتساق feature counts في summaries الحية، uniqueness للـrequirement IDs، ومطابقة `project/*.json`. هذه checks لا تستبدل مراجعة المعنى، ولا تعدل التاريخ تلقائيًا.

## 8. Handover Minimum

حزمة handoff يجب أن تحتوي على `README/overview`, `PROJECT_STATE`, `PROJECT_STATUS`, `AI_CONTINUATION`, master plan JSON/Markdown، latest feature/docs-close SHAs، gate output summary، open risks، decisions required، known boundaries، وcommands reproducible. يجب أن تكون الشجرة نظيفة وlocal SHA == GitHub remote SHA قبل إعلان التسليم.

إعداد: Manus AI. هذه الوثيقة لا تدعي وجود generator أو Documentation Agent أو release artifact.
