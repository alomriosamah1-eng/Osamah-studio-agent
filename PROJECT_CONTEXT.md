# سياق مشروع Osamah Studio Agent

## الهوية

المشروع: `Osamah Studio Agent`.
المستودع: `https://github.com/alomriosamah1-eng/Osamah-studio-agent`.
الحالة: Discovery/Architecture، والمستودع بدأ فارغًا.
اللغة التوثيقية الحالية: العربية مع الاحتفاظ بأسماء البرمجيات والعقود بالإنجليزية.

## الرؤية

تطبيق Desktop محلي أولًا يجمع بيئة تطوير ذكية، Production Studio، وSecond Brain في ecosystem واحد. تشارك البيئات workspace وprojects وfiles وagents وmemory وproviders وskills وtasks وpermissions وactivity.

## القرارات الحالية

المعمارية المقترحة modular monolith + process isolation. Electron هو MVP shell المؤقت. SQLite + FTS5 هي طبقة البيانات الأولى. Provider routing محايد، وMCP خلف consent/policy. OpenTo خلف adapter unknown. الصوت والوسائط الثقيلة مؤجلة.

## مصادر الحقيقة

الحقائق الخارجية موثقة في `docs/29-research-sources.md` وملفات `research/sources`. القرارات في `docs/27-technology-decision-records.md`. الحالة المتغيرة في `PROJECT_STATUS.md`. مخاطر المشروع في `docs/26-risk-register.md` و`project/risks.json`.

## ممنوعات

لا تبدأ بناء التطبيق الكامل. لا تنسخ كودًا من مشروع خارجي دون license review. لا تضع أسرارًا أو ملفات مستخدم أو أوزان نماذج في Git. لا تدّع دعم OpenTo أو Arabic dialect quality قبل الدليل. لا تجعل auto mode افتراضيًا.

إعداد: Manus AI. تاريخ الفحص: 2026-08-21.
