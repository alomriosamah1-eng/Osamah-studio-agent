# المساهمة في Osamah Studio Agent

## قبل التغيير

اقرأ `PROJECT_CONTEXT.md` و`docs/README.md` و`PROJECT_STATUS.md`. حدد المتطلب والقرار والخطر المتأثر. إذا كان التغيير يعتمد على مشروع خارجي، سجل المصدر والترخيص والإصدار.

## أسلوب العمل

استخدم branch قصير العمر وcommit معنويًا واحدًا لكل فكرة. لا تُدمج تغييرات كبيرة غير قابلة للمراجعة. لا تبدأ coding لميزة بلا acceptance criteria وtest plan. أي تغيير في schema يحتاج migration وbackup/recovery test.

## الأمن

لا تضع أسرارًا أو tokens أو ملفات مستخدم في commit. افحص diff و`git diff --check` وsecret scan. لا تشغل repositories غير موثوقة مع hooks أو postinstall دون عزل. أي MCP/plugin جديد يحتاج permission manifest وconsent flow.

## الوثائق

حدّث الوثيقة المتأثرة و`PROJECT_STATUS.md`. القرارات الجديدة تضاف إلى ADR. حقائق المصادر تستخدم citation مرجعيًا، وتُوسم الافتراضات بوضوح.

## الاختبارات

يجب أن يغطي التغيير unit وintegration أو contract حسب حدوده، ويضاف e2e للتدفقات الأساسية. تغييرات الواجهة تفحص keyboard/RTL/LTR/loading/error states. تغييرات provider تفحص failure/fallback/cost/privacy.

## Pull request

يجب أن يذكر PR الهدف، الأدلة، المخاطر، الترخيص، الاختبارات، وrollback. يرفض المراجع التغيير الذي يضيف اعتمادًا غامض الترخيص أو يوسع صلاحية agent دون approval.

إعداد: Manus AI.
