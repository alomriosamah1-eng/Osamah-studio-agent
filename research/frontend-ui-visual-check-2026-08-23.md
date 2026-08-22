# Frontend UI Visual Check — 2026-08-23

## Scope

تم فتح `prototypes/studio/index.html` بصريًا بعد إعادة بناء الواجهة الموحدة، ثم الانتقال إلى Production Studio عبر شريط التنقل.

## Findings

- الصفحة تحمل `lang="ar"` و`dir="rtl"`، مع إبقاء المحرر وterminal وdiff في اتجاه LTR.
- الواجهة تعرض Global Workspace Tabs: بيئة التطوير، Production Studio، Second Brain، ومركز التحكم، مع Global Rail مقابل Project Sidebar وMain Workspace وInspector.
- بيئة التطوير تعرض metrics، محرر المشروع، Embedded Preview، device inspector، session console، task review، Terminal Policy، وGit read-only.
- Production Studio يعرض Provenance، Render Policy، Human Gate، Sources/Citations، Content Plan، Asset Catalog، Creative Brief، Artifact Review، Report Document، وRender Readiness.
- Inspector ثابت بصريًا ويعرض Human Gate وruntime summary وcapability map، بما في ذلك OpenCode adapter وHermes ACP وDeepSeek deferred.
- الانتقال بين البيئات يعمل من الأزرار ذات `data-view`، ويغير العنوان وfooter وحالة inspector دون إعادة تحميل أو تسريب واجهة upstream.
- عند فتح الملف مباشرة دون Electron يظهر fallback bounded ورسائل Desktop IPC unavailable بدل أخطاء أو استدعاءات خارجية.
- تم الحفاظ على جميع معرفات DOM السابقة اللازمة لمنطق `workspace.js`، مع إعادة إضافة `tabName` بعد اكتشاف غيابه في أول مقارنة.

## Next checks

تشغيل `pnpm typecheck` وJavaScript/HTML syntax checks، ثم `desktop:smoke` وfull audit gate بعد إكمال ربط التنقل والواجهة. يلزم لاحقًا التحقق البصري من Second Brain ومركز التحكم عند مقاسات viewport مختلفة، واختبار 125% وlight theme وreduced motion.

## Additional visual findings

تم فتح Second Brain ومركز التحكم عبر التنقل الموحد. Second Brain يعرض metrics واضحة لـMemory/SQLite وLexical وProvider Access وReview، مع capture/search/review queue وconsolidation في عمودين متوازنين. مركز التحكم يعرض الإدارات العامة والحسابات الخارجية والتخزين والتطوير الذاتي، إضافة إلى Providers وAgent Catalog وEditor boundary وEvent timeline. في الوضع المباشر دون Electron ظهرت رسائل IPC unavailable الآمنة بدل محاولات اتصال أو أخطاء غير مفهومة. التنقل يغير عنوان الصفحة والـfooter وحالة inspector إلى اسم البيئة الحالية. التخطيط responsive يضمّن media queries عند 1060 و760 بكسل، مع إخفاء inspector على العرض المتوسط وتحويل اللوحات إلى عمود واحد على العرض الصغير.

## Focused workspace redesign findings

أعيد فحص بيئة التطوير بعد تعديل القشرة. أصبحت مساحة العمل الأساسية هي الحالة الافتراضية بعرض عمود واحد، بينما صار المحاكي مخفيًا عبر `hidden` ولا يظهر إلا عند الضغط على «فتح المحاكي» أو «تشغيل المعاينة»، ثم يفتح بجانب المحرر في تخطيط سطح المكتب. أضيف زر صريح لإخفائه، ويغلق تلقائيًا عند الانتقال إلى بيئة أخرى أو عند الضغط على Escape.

أصبحت لوحة Inspector مخفية افتراضيًا ولا تشغل عمودًا فارغًا في الشبكة. تظهر فقط عند استدعاء «المراقبة» أو «الموافقات»، مع زر إغلاق مستقل، وتُمنع من الظهور على المقاسات المتوسطة والصغيرة لتفادي التزاحم. بقيت الأقسام الأربعة منفصلة عبر `data-app-view` بحيث تختفي الشاشة السابقة عند الانتقال.

أضيفت لوحة «توجيه الوكيل» داخل بيئة التطوير، وبها توجيه نصي، نوع المهمة، النطاق، والقيود، مع معاينة محلية آمنة لا ترسل البيانات ولا تبدأ تنفيذًا. تمت المحافظة على اتجاه RTL للنص العربي وLTR للمحرر والـterminal والـdiff، واستخدمت المعاينة DOM APIs و`textContent` للبيانات المدخلة.

تم أثناء التحقق اكتشاف خطأ عكسي في زر فتح المحاكي وإصلاحه؛ يلزم إعادة فحص المتصفح بعد الإصلاح ثم تشغيل بوابة التدقيق قبل الإغلاق.

## Interaction verification after focused redesign

أثبت الاختبار التفاعلي أن حالة المحاكي تتبدل بين `hidden=false` و`hidden=true` عبر زر واحد، وأن زر «تشغيل المعاينة» يفتحه تلقائيًا. كما أثبت أن Inspector تفتح وتغلق عبر زر «المراقبة»، وأن الانتقال من بيئة التطوير إلى Production Studio يجعل الشاشة النشطة الوحيدة هي `studio` ويعيد إخفاء المحاكي، ثم يعيد `development` عند الرجوع. لا توجد شاشة تطبيقية ثانية نشطة في الوقت نفسه.

## Agent instruction verification

تم إدخال توجيه عربي فعلي في الحقل واختبار زر «معاينة التوجيه». ظهرت معاينة محلية تحتوي نوع المهمة والنطاق والقيود والنص المدخل، وتغيرت حالة الشريط إلى أن المسودة لم تُرسل ولم يبدأ تنفيذ. لا توجد عملية IPC أو provider في هذا المسار، وهو متوافق مع سياسة review-first وfail-closed.

## DOM layout correction

كشف الفحص أن إغلاق `div` زائدًا في نهاية شاشة التطوير كان يغلق `main` و`body-shell` مبكرًا، لذلك ظهرت Production Studio والشاشات اللاحقة خارج مساحة العمل وبفراغ كبير. أزيل الإغلاق الزائد. بعد إعادة التحميل أصبحت الشاشات الأربع أبناء مباشرة لـ`main`، وبدأت شاشة التطوير من أعلى مساحة العمل، مع بقاء المحاكي وInspector مخفيين افتراضيًا. هذا الإصلاح يعالج سببًا حقيقيًا للتخطيط غير المقبول وليس مجرد تعديل بصري.

## Production Studio visual confirmation

بعد إصلاح بنية `main` تمت إعادة فتح Production Studio في المتصفح. ظهرت شاشة الإنتاج من أعلى مساحة العمل مباشرة، دون الفراغ السابق، مع شبكة واضحة من metrics وSources/Citations وContent Plan وAsset Catalog وCreative Brief وArtifact Review وReport وRender Readiness. بقيت القشرة العامة والشريط الجانبي ثابتين دون ظهور Inspector أو المحاكي غير المستدعى.

## Second Brain and Control Center visual confirmation

تم فتح Second Brain فظهرت شاشة مستقلة من أعلى مساحة العمل، وبها Capture/Search وReview Queue وMemory Consolidation في تخطيط عمودين متوازنَين دون أدوات Production Studio أو Development. ثم تم فتح مركز التحكم فظهرت إعدادات عامة وتبويبات الحسابات الخارجية والتخزين والتطوير الذاتي، مع Providers وAgent Catalog وEditor Boundary في شاشة مستقلة. المحاكي وInspector لم يظهرا تلقائيًا في أي من الشاشتين.

## Implementation pass: Home, global command bar, internal section navigation

أضيفت Home كبوابة تشغيل أولى، وأصبح Global Rail وGlobal Header يقدمان Home مع البيئات الأربع. اختفت Project Sidebar وInspector من Home، بينما بقي شريط أوامر الوكيل العام في مساحة محجوزة أسفل التطبيق دون تغطية المحتوى. نُقلت لوحة توجيه الوكيل إلى الشريط العام عند بدء الصفحة، وأضيف اختيار الوكيل، إرفاق metadata، سجل المهمة، التوسيع، الإلغاء، والمعاينة/الإرسال للمراجعة المحلية.

بعد الانتقال إلى بيئة التطوير ظهرت الشاشة الخاصة بها فقط، واختفى Home بالكامل. أضيف تنقل داخلي يفصل نظرة عامة، المحرر والمعاينة، مراجعة المهمة، والسياسات وGit. الفحص البرمجي أكد أن مجموعة `editor` ظاهرة وحدها بينما `overview` و`review` و`tools` مخفية. تم الحفاظ على المحاكي المخفي افتراضيًا.

## Internal section navigation and administration pass

أضيف تنقل داخلي لبيئة التطوير وProduction Studio وSecond Brain بحيث تظهر مجموعة واحدة في مساحة العمل. Production Studio يبدأ بمسار إنتاج واضح بدل مساحة فارغة، وSecond Brain يبدأ بملخص اليوم المحلي. مركز التحكم يعرض تبويبات العامة والحسابات والتخزين والتطوير الذاتي والوكلاء والمزودين والخصوصية والأمان والأداء والتشخيص وحدود المحرر. أظهرت المعاينة إدارة الوكلاء والمزودين وحدها عند اختيار تبويبها، وبقي الشريط العام لأوامر الوكيل منفصلًا أسفل الشاشة.

## Specialized editors pass

ظهرت Production Studio منفصلة عن Home، وبدأت بمسار الإنتاج الذي يوضح Source → Claims → Content Plan → Artifact → Review. أضيفت شاشة محررات الإنتاج الداخلية بأربعة أنواع: مستندات، عروض تقديمية، صور، وفيديو. المعاينة أظهرت محرر المستندات وحده افتراضيًا، ثم نجح تبديل التبويب إلى محرر الصور مع بقاء لوحة محرر واحدة فقط.

## Second Brain modules pass

أظهرت Second Brain ملخص اليوم وحده عند الدخول، ثم أظهر تبويب مساحات العمل وحدات Today وWork وFinance وLearning وTasks وNotes & Knowledge في لوحة مستقلة. بقيت لوحات الالتقاط والدمج غير ظاهرة حتى اختيارها من التنقل الداخلي، مع استمرار شريط توجيه الوكيل العام منفصلًا.

## Final implementation verification

أعيد تشغيل التطبيق المعاين بعد اكتمال التنفيذ، ونجح الانتقال من Home إلى Production Studio ثم إلى Second Brain. ظهرت شاشة Second Brain وحدها، ونجح فتح تبويب مساحات العمل لعرض Today وWork وFinance وLearning وTasks وNotes & Knowledge دون ظهور لوحات الالتقاط أو الدمج معها. بقي شريط الوكيل العام في مساحة مستقلة أسفل القشرة.

بوابة التدقيق الأخيرة بعد هذه الشريحة: `AUDIT_GATE=PASS`، و`224/224` اختبارًا، و`DESKTOP_SMOKE=PASS`، و`PERF_SMOKE=PASS`، و`SECRET_SCAN=PASS`.
