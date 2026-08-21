# نموذج الأمن والتهديدات

## مبدأ الثقة

كل ما يأتي من ملف أو repository أو web page أو model output أو MCP tool description يُعامل كـ **بيانات غير موثوقة**. لا يملك النص القدرة على تغيير policy. MCP نفسه يؤكد أن الأدوات تمثل مسارات تنفيذ كود وأن hosts يجب أن يطلبوا consent واضحًا [1].

## أصول يجب حمايتها

الأصول هي ملفات المستخدم، Git history، GitHub tokens، API keys، الصوت، الذاكرة الشخصية، مخرجات المشاريع، session transcript، permissions، وupdate artifacts. يحدد كل أصل `classification`: public، workspace، private، secret، أو restricted.

## تهديدات أساسية

| ID | التهديد | الأثر | التخفيف |
|---|---|---|---|
| T-001 | prompt injection داخل README/PDF | تنفيذ فعل غير مقصود | فصل data/instruction، source labels، approval |
| T-002 | tool أو MCP خبيث | قراءة/تسريب/تعديل | catalog، scopes، consent، sandbox، audit |
| T-003 | repository عدائي | script postinstall أو secret leak | clone read-only، disable hooks، scan |
| T-004 | أمر shell خطر | حذف أو exfiltration | allowlist، denylist، timeout، approval |
| T-005 | GitHub token مكشوف | takeover | OS secret store، redaction، least scope |
| T-006 | provider logging | تسريب context | privacy policy، redaction، local-first |
| T-007 | dependency compromise | تنفيذ في build | lockfile، SBOM، signature، audit |
| T-008 | renderer XSS/RCE | سيطرة على الجهاز | context isolation، sandbox، CSP، IPC validation |
| T-009 | voice cloning misuse | ضرر هوية/حقوق | opt-in، provenance، no default cloning |
| T-010 | stale memory | قرار خاطئ | source/version/expiry وhuman confirmation |
| T-011 | runaway automation | تكلفة/تغيير واسع | caps، circuit breaker، pause، approvals |
| T-012 | malicious document parser | crash أو exploit | worker isolation، quotas، patched libs |

## Electron baseline

يجب تفعيل `contextIsolation` وprocess sandbox، وتعطيل Node integration في أي remote content، والتحقق من IPC sender، وتحديد navigation وwindow creation، وفرض CSP؛ هذه توصيات موثقة في دليل Electron الأمني [2]. لا تعرض الواجهة `ipcRenderer` خامًا، بل functions typed وallowlisted.

## RBAC وagent permissions

في MVP يوجد owner وagent وworker وplugin identities. كل grant يحدد `subject`, `resource`, `actions`, `conditions`, `expires_at`, و`approval_id`. default deny. لا يرث worker صلاحية supervisor كاملة. profile أو workspace منفصل عن الآخر.

## sandboxing

filesystem tool يعمل داخل workspace roots، terminal worker يعمل بمجلد وenv محدودين، browser worker يملك profile مؤقتًا، وdocument converter يعمل بحدود CPU/RAM/time. Firecracker خيار مستقبلي لـ Linux sandbox، لكنه لا يناسب Windows MVP [3].

## MCP

MCP Host هو Osamah، وClient instances تربط servers. تُظهر الواجهة server identity وtools وrequired scopes، وتطلب consent قبل الإرسال أو التنفيذ. لا تُقبل annotations على أنها موثوقة دون server trust. يدعم client cancellation وprogress، ويقطع الاتصال عند تجاوز policy.

## التهديدات التشغيلية

تستخدم Gitleaks وTrivy وScorecard في CI، وتفحص workflows والـ actions بإصدارات مثبتة. يراجع المشروع licenses وthird-party notices. لا تحفظ secrets في `project` JSON أو prompts أو Git history. أي تسريب يفعل revoke/rotate ويكتب incident.

## مراجع

[1]: https://modelcontextprotocol.io/specification/2026-07-28 "MCP specification and trust & safety"
[2]: https://www.electronjs.org/docs/latest/tutorial/security "Electron Security Recommendations"
[3]: https://github.com/firecracker-microvm/firecracker "Firecracker repository"
[4]: https://github.com/gitleaks/gitleaks "Gitleaks repository"
[5]: https://github.com/aquasecurity/trivy "Trivy repository"
[6]: https://github.com/ossf/scorecard "OpenSSF Scorecard repository"

إعداد: Manus AI. تاريخ الفحص: 2026-08-21.
