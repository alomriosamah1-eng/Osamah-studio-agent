# تحليل UX/UI

## المبدأ التصميمي

يجب أن يشعر المستخدم بأنه يدير **مساحة عمل تفكر معه** لا نافذة chat مع أدوات مبعثرة. يستعير النظام مبادئ عامة من IDEs وتطبيقات الإنتاج والاستوديو: لوحات قابلة للتخصيص، command palette، حالات واضحة، undo، diff، وسجل نشاط. لا تُنسخ ألوان أو تخطيطات أو assets مملوكة؛ يُبنى design system مستقل.

## بنية التنقل

يظهر شريط البيئة في اليسار، ويحتوي على Development وStudio وBrain وSettings. يتغير محتوى sidebar حسب البيئة، لكن تبقى workspace switcher وsearch وactivity مشتركة. يملك المستخدم tabs وsplit panes، مع حفظ layout لكل workspace. لا يسمح التصميم بأن يختفي approval أو running job في panel غير مرئي.

## حالات الوكيل

يُعرض الوكيل في حالات مفهومة: `يفهم الطلب`, `يخطط`, `ينتظر موافقتك`, `ينفذ`, `يتحقق`, `متوقف مؤقتًا`, `فشل قابل للإعادة`, `اكتمل`. كل حالة تقدم سببًا وزمنًا وإجراءً تاليًا. يختلف لون الحالة بالنص والأيقونة لا باللون وحده.

## المحادثة والخطة

المحادثة ليست transcript فقط؛ كل طلب له بطاقة Task تحتوي الهدف والقيود والميزانية والـ artifacts. تظهر الخطة قبل التنفيذ ويمكن تحريرها. تظهر tool calls في activity timeline منفصلة عن نص الوكيل، مع زر «لماذا؟» يعرض policy وscope.

## التصميم العربي

يتعامل layout مع النص العربي المختلط: الاتجاه العام RTL، code/paths/commands LTR، وأرقام/تواريخ بحسب locale مع خيار ثابت. يجب عدم قلب علامات diff أو أسطر terminal. تستخدم components logical spacing وtext-align logical، وتُختبر العناوين العربية الطويلة والـ placeholders المختلطة.

## إمكانية الوصول

المعايير المستهدفة هي keyboard navigation، focus visible، contrast، reduced motion، narration labels، وعدم الاعتماد على الصوت فقط. التسجيل الصوتي له زر واضح ومؤشر حالة وtranscript قابل للتحرير. كل destructive action يعرض confirmation نصية قابلة للقراءة.

## onboarding

يبدأ onboarding باختيار profile، workspace، privacy mode، provider local/remote، وpermissions. لا يطلب GitHub token أو microphone إلا عند الحاجة. يقدم wizard مهمة اختبارية read-only، ثم يوضح كيفية الموافقة قبل أول write.

## قابلية الفهم

المستخدم يحتاج معرفة «ماذا قرأ النظام؟» و«ماذا سيكتب؟» و«إلى أين سيرسل البيانات؟». لذلك تظهر context chips، source list، permission scopes، وprovider label. لا تكتب الواجهة ادعاء «تم التحقق» إلا إذا ظهر evidence link أو test output.

إعداد: Manus AI. تاريخ الفحص: 2026-08-21.
