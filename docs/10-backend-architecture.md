# معمارية الخلفية والنواة

## التقسيم

يُقسم core إلى modules لا services مستقلة في MVP: `workspace`, `session`, `orchestrator`, `policy`, `tools`, `providers`, `memory`, `artifacts`, `jobs`, `integrations`, `observability`, و`migration`. لكل module public contract وtests، ولا تستورد الواجهة implementation داخليًا.

## الخدمات

| الخدمة | الوظيفة | طريقة التشغيل |
|---|---|---|
| Core API | تنسيق الطلبات والـ contracts | main/worker محلي |
| Agent Runtime | loop، prompt، tool calls، context budget | process مستقل |
| Policy Engine | risk classification، approval، grants | synchronous bounded |
| Provider Router | registry، health، fallback، cost | process/worker قابل لإعادة التشغيل |
| Tool Runner | filesystem، terminal، browser، MCP | workers مع sandbox |
| Job Supervisor | queue، retry، timeout، pause، recovery | process مستقل |
| Indexer | text extraction وFTS/vector | background worker |
| Artifact Service | metadata، versions، export | worker لكل converter |
| Git Adapter | status/diff/commit/PR | gh/libgit2 adapter |

## IPC/API

يفضل JSON-RPC محلي عبر stdio أو loopback مع authentication عشوائي لكل تشغيل، ورسائل schema-validated. لا يقبل backend command من renderer دون session token وcapability check. يدعم البروتوكول `request`, `event`, `cancel`, `progress`, `approval_required`, `error`, و`result`. كل رسالة تحمل `protocol_version` و`request_id`.

## الطوابير والمهام

كل عمل طويل يصبح `Job`: يملك input references، resource budget، retry policy، checkpoint، وstate machine. الحالات هي `QUEUED`, `RUNNING`, `WAITING_APPROVAL`, `PAUSED`, `CANCEL_REQUESTED`, `SUCCEEDED`, `FAILED_RETRYABLE`, `FAILED_FINAL`, و`CANCELLED`. تُمنع retries للأفعال غير idempotent ما لم يُحفظ idempotency key.

## عمليات عالية الخطورة

`terminal.exec`, `filesystem.write`, `git.commit`, `github.push`, `mcp.tool`, `browser.submit`, و`media.publish` تعلن risk tier. Policy engine يحدد ما إذا كانت تحتاج approval. tool runner لا ينفذ نصوص tool output كـ shell. ملفات project قد تكون عدائية؛ تمرر إلى parser مع resource limits.

## التكامل مع المرجعيات

يمكن تشغيل Hermes أو OpenCode كـ adapter subprocess في مرحلة التجارب، لكن العقد الداخلي هو المصدر الوحيد للـ UI والـ audit. إذا تغير CLI أو API الخارجي، يفشل adapter health check دون كسر core. لا ينسخ المشروع المصدر إلى repo؛ يسجل version وlicense وcompatibility في `project/open-source-components.json`.

## التعافي

عند crash، يستعيد supervisor الوظائف الآمنة من آخر checkpoint. عند فساد قاعدة البيانات، يستخدم نسخة backup محلية وmigration dry-run. عند provider failure، لا يعيد إرسال mutation تلقائيًا. عند انقطاع الشبكة، تتحول المهمة إلى `WAITING_NETWORK` أو تستخدم local provider بحسب السياسة.

## مراجع

[1]: https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/architecture.md "Hermes architecture"
[2]: https://github.com/anomalyco/opencode "OpenCode repository"
[3]: https://modelcontextprotocol.io/specification/2026-07-28 "MCP Specification"

إعداد: Manus AI. تاريخ الفحص: 2026-08-21.
