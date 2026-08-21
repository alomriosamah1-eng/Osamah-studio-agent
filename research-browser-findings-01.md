# نتائج التصفح الأولية — OpenCode وHermes

> هذه مذكرة بحثية مؤقتة ستُدمج لاحقًا في الوثائق النهائية، ولا تُعد بديلاً عن التحقق من ملفات المستودعات الخام.

## OpenCode — VERIFIED FACT

المصدر الرسمي الذي ظهر في GitHub هو `https://github.com/anomalyco/opencode`، ووصفه الرسمي هو «The open source coding agent». صفحة المستودع تعرض ترخيص MIT، وفرعًا نشطًا باسم `dev`، وأكثر من 15 ألف commit، ومئات آلاف النجوم وقت الفحص. البنية الظاهرة تتضمن مجلدات مثل `.github` و`packages` و`sdks/vscode` و`specs`، كما يعرض المستودع دعماً لتطبيق سطح مكتب تجريبي وفق وصف المصدر الخارجي الرسمي المرتبط بالمشروع. لغة المستودع الغالبة TypeScript مع وجود Rust وC++ وHTML ولغات أخرى في الإحصاء الظاهر.

## Hermes Agent — VERIFIED FACT

المصدر الرسمي هو `https://github.com/NousResearch/hermes-agent`، وموقع التوثيق الرسمي هو `https://hermes-agent.nousresearch.com/`. يصف المشروع نفسه بأنه وكيل مفتوح المصدر قابل للاستضافة الذاتية من Nous Research، مع دورة تعلم تتضمن إنشاء المهارات وتحسينها، وذاكرة دائمة، والبحث في المحادثات السابقة، ونمذجة المستخدم. يذكر README الرسمي واجهة طرفية كاملة، وبوابة رسائل لقنوات متعددة، وتحويل المذكرات الصوتية إلى نص، وجدولة cron، واستدعاء وكلاء فرعيين مع سياقات معزولة، وخلفيات طرفية محلية أو Docker أو SSH أو Singularity أو Modal أو Daytona أو Vercel Sandbox. الصفحة تعرض ترخيص MIT، فرع `main`، نشاطًا حديثًا جدًا، وحجمًا كبيرًا من تاريخ commits والمساهمين.

## حدود الدليل

هذه المذكرة تسجل ما ظهر في صفحات GitHub الرسمية أثناء التصفح. أرقام النجوم والتفرعات والنشاط متغيرة زمنياً، لذلك يجب وصفها في الوثائق النهائية بأنها «وقت الفحص» مع تاريخ الفحص، لا كقيم ثابتة. لم تُحسم بعد هوية `OpenTo Desktop`؛ نتائج البحث العامة لم تُظهر مشروعًا رسميًا واضحًا بهذا الاسم، ولذلك يجب تصنيفه مؤقتًا كـ `UNKNOWN / REQUIRES VALIDATION` إلى أن يقدّم مالك المشروع رابطًا رسميًا أو ملف تكامل.

## روابط مرجعية

1. [OpenCode repository](https://github.com/anomalyco/opencode)
2. [Hermes Agent repository](https://github.com/NousResearch/hermes-agent)
3. [Hermes Agent official site and documentation](https://hermes-agent.nousresearch.com/)

تاريخ الفحص: 2026-08-21 (وقت البيئة التنفيذية).
إعداد: Manus AI

---

## Evidence classification

| Claim | Classification | Confidence | Next validation |
|---|---|---:|---|
| OpenCode repository is `anomalyco/opencode` | VERIFIED FACT | High | Inspect raw manifest, license, and release metadata |
| Hermes repository is `NousResearch/hermes-agent` | VERIFIED FACT | High | Inspect raw manifest, license, release metadata, and docs |
| OpenTo Desktop official identity is unresolved | UNKNOWN / REQUIRES VALIDATION | High | Obtain official URL or integration contract from project owner |
| OpenCode/Hermes are suitable as complete drop-in cores | HYPOTHESIS | Low | Compare process model, APIs, licenses, and integration seams |

---

## English technical names retained for interoperability

Project identifiers, URLs, branch names, licenses, and repository paths are kept in their original form so future AI agents and engineers can search and reproduce the evidence exactly.

## OmniRoute — VERIFIED FACT

المصدر الذي يتطابق مع وصف «OmniRoute» في البرومبت هو `https://github.com/diegosouzapw/OmniRoute`. يعرض README وصفه كبوابة AI متعددة المزوّدين بنقطة نهاية واحدة، مع توجيه واعٍ بالحصص وfallback تلقائي، وضغط RTK+Caveman، ودعم MCP/A2A وDesktop/PWA. صفحة المستودع تعرض ترخيص MIT، فرع إصدار `release/v3.8.50`، آلاف commits، ومجلدات واضحة للتطبيقات والـ Electron والـ providers والـ skills والاختبارات والـ Docker. هذه الأدلة تجعل OmniRoute مرشحًا قويًا كمرجع لتصميم طبقة provider routing، لا كضرورة لإدخال كامل البوابة في تطبيق Osamah.

## DeepSeek Harness — VERIFIED FACT

المصدر الرسمي هو `https://github.com/deepseek-ai/deepseek-harness`. يصف نفسه بأنه agent harness مفتوح المصدر من DeepSeek AI، قائم على مبدأ «Everything is a Plugin»، ويعتمد على Cordis. صفحة المستودع تعرض ترخيص MIT، فرع `master`، بنية تشمل `.agents` و`.claude` و`.github` و`apps` و`docs` و`examples` و`packages` و`python` و`vendor`، كما تعرض توثيقًا لملفات `THIRD_PARTY_NOTICES.md`. توجد دلائل على أنه في مرحلة مبكرة نسبيًا مقارنة بحجم تاريخ التطوير، مع إصدار تجريبي ظاهر في سجل المشروع؛ لذلك يجب التعامل معه كمصدر معماري وتجريبي قابل للتكييف، لا كأساس إنتاجي يُدمج دون عزل.

## قرار مؤقت

| المشروع | الاستخدام المقترح في Osamah | التصنيف المؤقت | مستوى الثقة |
|---|---|---|---:|
| OpenCode | دراسة واجهة الوكيل، التكامل مع IDE، إدارة الجلسات والأدوات، وربما تشغيله كـ subprocess/adapter | ADAPT / WRAP | متوسط-عالٍ |
| Hermes | دراسة الذاكرة والمهارات والجدولة والبوابة والوكلاء الفرعيين؛ يفضّل adapter مع حدود عملية واضحة | ADAPT / WRAP | عالٍ |
| OmniRoute | مرجع provider registry/routing/fallback/cost-aware/free-first؛ لا يُضمّن كاملًا في MVP | REFERENCE / ADAPT | متوسط-عالٍ |
| DeepSeek Harness | دراسة plugin seams وCordis ونظام الإضافات؛ لا يُعتمد runtime أساسيًا قبل نضج API | REFERENCE / ADAPT | متوسط |

## روابط مرجعية إضافية

4. [OmniRoute repository](https://github.com/diegosouzapw/OmniRoute)
5. [DeepSeek Harness repository](https://github.com/deepseek-ai/deepseek-harness)
6. [DeepSeek Harness official developer preview](https://deepseek.com/harness/en/)

تاريخ الفحص: 2026-08-21 (وقت البيئة التنفيذية).
إعداد: Manus AI
