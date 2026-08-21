# محرك الأتمتة

## القرار

الأتمتة داخل التطبيق **job/workflow engine محلي محدود** وليست microservice ولا scheduler سحابيًا دائمًا في MVP. كل workflow يملك trigger وsteps وconditions وapproval gates وresource budget وretry policy وdelivery policy. عند الحاجة إلى workflows موزعة طويلة المدى، يُدرس Temporal كمرجع خارجي، لا يُضمّن تلقائيًا [1].

## أوضاع التشغيل

| الوضع | ما يفعله | حدود السلامة |
|---|---|---|
| Manual | ينفذ بعد طلب مباشر | لا schedule ولا autonomous loop |
| Assisted | يقترح الخطوات وينفذ منخفض الخطورة | approval للأفعال الخارجية أو الكتابة |
| Autonomous | ينفذ workflow allowlisted | سقف وقت/عدد/تكلفة، pause تلقائي، audit |

## نموذج workflow

```yaml
id: project-daily-review
trigger: manual-or-schedule
steps:
  - agent: project-manager
    action: summarize_changes
    approval: false
  - agent: security-reviewer
    action: inspect_diff
    approval: false
  - action: write_report
    approval: true
limits:
  max_runtime_minutes: 20
  max_retries: 1
  network: denied
```

هذا YAML توضيحي، ويجب أن يمر validation وpolicy compiler قبل التشغيل. لا تسمح workflow بأن يغير policy أو يمنح نفسه صلاحيات أو ينشئ trigger لا نهائيًا.

## الجدولة

تخزن jobs محليًا مع timezone وnext_run وlast_run وfailure_streak. يتعامل scheduler مع sleep/resume وclock drift. لا تُستخدم جدولة التطبيق لفحص كل دقيقة باستمرار؛ الأعمال عالية التواتر تحتاج عملية دائمة واضحة أو حلًا خارجيًا. تستلزم كل job شاشة pause وrun now وhistory وdelete.

## event triggers

يدعم MVP file changed وGit status changed وmanual. webhooks وcalendar وexternal integrations خارج MVP حتى تثبت auth وsignature verification. أي event external يجب أن يحمل replay protection وdeduplication key.

## failures

تسجل كل خطوة state وoutput ref. retry فقط إذا كان الخطأ retryable. عند فشل متتالٍ، يوقف workflow ويطلب مراجعة. عند انتهاء الوقت، يترك checkpoint ويعرض resume/restart. لا يرسل notification خارجية أو ينفذ push ضمن auto mode دون policy صريحة.

## References / المراجع

[1]: https://github.com/temporalio/temporal "Temporal repository"
[2]: https://github.com/n8n-io/n8n "n8n repository"
[3]: https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/architecture.md "Hermes cron architecture"

إعداد: Manus AI. تاريخ الفحص: 2026-08-21.
