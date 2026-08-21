# تسليم العمل لوكيل أو مهندس لاحق

## ما نبنيه

Osamah Studio Agent تطبيق سطح مكتب محلي أولًا بثلاث بيئات مترابطة: Development، Production Studio، وSecond Brain. النواة المشتركة هي workspace/session/context/agent/tool/policy/provider/memory/artifact/job/audit.

## لماذا

الهدف هو تحويل الطلب إلى خطة وسياق وتنفيذ قابل للمراجعة ثم معرفة أو artifact قابل لإعادة الاستخدام، مع تقليل تبديل الأدوات وحماية الملفات والأسرار.

## ما ثبت

المستودع الهدف بدأ فارغًا، وثُبتت مستودعات OpenCode وHermes وOmniRoute وDeepSeek Harness ومصادرها الأساسية. OpenCode وHermes دليلان عمليان لتغليف Desktop والعوامل والأدوات، OmniRoute دليل routing، وDeepSeek Harness دليل capability seams. OpenTo غير محدد ويجب عدم اختلاق تكامل له.

## ما تقرر

MVP يستخدم modular desktop monolith مع Electron وworkers، SQLite/FTS5، provider-neutral contracts، policy approval، Git adapter، skill registry، وMarkdown/PDF أولًا. الصوت والوسائط الثقيلة و70 definitions المتقدمة وOpenTo integration مؤجلة حتى تحقق بواباتها.

## ما لم يُنفذ

لا يوجد كود تطبيق بعد. لا يوجد `package.json` للمشروع أو CI workflows أو schema migrations. الوثائق والبيانات البحثية هي التنفيذ الوحيد الحالي. لا تعلن اكتمال MVP بناءً على وجود هذه الوثائق.

## أسئلة مفتوحة

ما OpenTo Desktop؟ ما الأنظمة والإصدارات المستهدفة؟ هل التطبيق شخصي أم متعدد المستخدمين؟ ما privacy default؟ هل التوزيع تجاري؟ ما hardware baseline؟ ما مزوّد النموذج المحلي المقبول؟ هل الصوت العربي شرط منتج أم تجربة؟

## أوامر الاستمرار

```bash
git clone https://github.com/alomriosamah1-eng/Osamah-studio-agent.git
cd Osamah-studio-agent
git log --oneline --decorate -10
find docs project -maxdepth 2 -type f | sort
git diff --check
```

قبل كتابة الكود، اقرأ `docs/00-project-overview.md`, `docs/01-executive-summary.md`, `docs/06-system-architecture.md`, `docs/17-security-model.md`, `docs/21-open-to-integration.md`, و`docs/27-technology-decision-records.md`.

## NEXT AI AGENT CONTINUATION PROTOCOL

1. تحقق من branch وremote وclean status، ولا تحذف `research/`.
2. اقرأ `PROJECT_STATUS.md` و`PROJECT_CONTEXT.md` ثم حدد phase الحالي.
3. افحص `project/project-state.json` و`project/risks.json` لمعرفة blockers.
4. لا تحوّل UNKNOWN إلى FACT؛ ابحث عن source أولي وسجله في `docs/29-research-sources.md`.
5. إذا ظهر رابط OpenTo رسمي، أنشئ adapter POC read-only وcontract tests قبل تغيير ADR-006.
6. نفذ أصغر slice: workspace + session + read-only agent + approval card + SQLite migration.
7. أضف اختبارًا لكل متطلب جديد وحدّث traceability.
8. لا تضع API keys أو ملفات المستخدم أو model weights الكبيرة في Git.
9. شغل format/lint/typecheck/test/security/license قبل commit.
10. نفذ commit معنويًا صغيرًا وادفعه، ثم حدّث `PROJECT_STATUS.md` بالـ hash وحالة push.
11. بعد كل milestone نفذ second-pass critique من architecture/security/UX/performance/compliance/QA.
12. لا تبدأ Voice أو Automation Autonomous قبل نجاح core gates.

## Definition of ready للكود

المهارة أو الميزة جاهزة للبرمجة عندما يكون لها owner، contract، threat model، acceptance criteria، test plan، license impact، وfallback. إذا نقص أحدها تبقى في Discovery.

إعداد: Manus AI. تاريخ الفحص: 2026-08-21.
