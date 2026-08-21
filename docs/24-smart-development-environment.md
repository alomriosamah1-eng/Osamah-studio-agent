# بيئة التطوير الذكية

## الوظائف

تقدم البيئة file explorer وMonaco editor وterminal وGit diff وtest runner وagent activity وplan view. الوكيل لا يتجاوز IDE؛ كل تغيير يظهر كـ patch مع مسار وتفسير واختبار. يمكن للمستخدم تحرير الملف يدويًا ثم إعادة حساب الخطة.

## دورة تغيير الكود

```text
طلب المستخدم → قراءة قيود المشروع → خطة → قراءة محددة
→ اقتراح patch → approval → checkpoint → تطبيق
→ format/typecheck/test → diff review → commit اختياري
```

## Git/GitHub

يستخدم `git` أو `gh` عبر adapter محدد. يعرض branch وworktree وuncommitted changes. commit وpush أفعال حساسة: تعرض الرسالة والملفات والمخاطر وتحتاج approval. GitHub token لا يمر إلى agent prompt، وتستعمل CLI scopes محددة [1].

## terminal

الطرفية تدعم sessions مستمرة، output streaming، cancel، وbackground processes. policy تمنع الكتابة خارج root، وتراقب ANSI/escape sequences، وتحد output حتى لا ينهار UI. الأوامر من repository لا تشغل تلقائيًا postinstall أو hooks.

## agent skills

المهارة development skill تقدم commands وconventions وtest strategy. skill registry يسجل version وdependencies وpermissions. يستفيد التصميم من skills وtool registry في OpenCode/Hermes [2] [3]، لكن لا يحمّل skill غامضًا دون عرض مصدره وscope.

## debugging

يحفظ كل run command وexit code وenvironment fingerprint وartifact. يدعم watch mode وproblem markers، مع عدم إرسال source كامل إلى provider إلا إذا policy تسمح.

## OpenTo

لا يظهر OpenTo في IDE surface إلا عند نجاح adapter detect. غير ذلك يعرض integration status: `Unavailable / Needs official endpoint`. لا يبنى editor integration على reverse engineering.

## References / المراجع

[1]: https://github.com/cli/cli "GitHub CLI repository"
[2]: https://github.com/anomalyco/opencode "OpenCode repository"
[3]: https://github.com/NousResearch/hermes-agent "Hermes Agent repository"

إعداد: Manus AI. تاريخ الفحص: 2026-08-21.
