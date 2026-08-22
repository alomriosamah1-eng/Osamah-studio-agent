# فهرس الشاشات والوحدات الموسع

## الشاشة الرئيسية Home

Home هي بوابة التطبيق الأولى بعد التشغيل، ولا تدخل المستخدم مباشرة إلى بيئة التطوير أو الإنتاج أو الذاكرة. تعرض اسم Osamah Studio Agent وحالة النظام المختصرة، ثم ثلاثة مداخل رئيسية واسعة، ومدخلًا مستقلًا لمركز التحكم.

| المدخل | الوصف | البيانات المختصرة | الإجراء |
|---|---|---|---|
| بيئة التطوير | Code، Projects، Agents، Editor، Preview، Git، Tasks | آخر مشروع، آخر ملف، حالة المعاينة | فتح البيئة |
| Production Studio | Documents، Presentations، Images، Video، Assets، Review | آخر artifact، آخر تقرير، حالة المراجعة | فتح الاستديو |
| Second Brain | Work، Finance، Learning، Tasks، Notes، Knowledge، Life، Memory | آخر إدخال، مهام اليوم، حالة المراجعة | فتح العقل الثاني |
| مركز التحكم | General، Accounts، Storage، Agents، Providers، Self Development، Privacy، Performance | حالة النظام والموافقات | فتح المركز |

### حالات Home

| الحالة | المطلوب |
|---|---|
| أول تشغيل | شرح موجز وخيارات فتح عالم من العوالم الثلاثة |
| لا يوجد مشروع | إبقاء المداخل متاحة، مع حالة «لم يفتح مشروع» |
| توجد موافقات | إبراز عدد الموافقات وفتح Inspector عند الطلب |
| degraded | عرض سبب التدهور دون منع التنقل |
| unavailable | إظهار القسم مع سبب عدم توفره دون زر مضلل |

لا تعرض Home قوائم الملفات أو أدوات الإنتاج التفصيلية أو حقولًا طويلة. وظيفتها اختيار مساحة العمل فقط.

## شريط الوكيل العام

يظهر شريط Agent Command في أسفل مساحة العمل المحجوزة في جميع البيئات، لكن محتواه يرتبط بالشاشة الحالية. لا يسمح الشريط بتغطية المحتوى أو إدخال نص بلا معرفة النتيجة.

| العنصر | الوصف |
|---|---|
| حقل التوجيه | ما يريد المستخدم من الوكيل فهمه أو تحليله أو التخطيط له |
| اختيار الوكيل | Auto أو وكيل محدد من كتالوج Osamah عندما تتوفر القائمة |
| Scope | الشاشة الحالية، workspace، المشروع، أو عنصر محدد |
| Mode | Review First، Plan، Explain، Propose |
| إرفاق | إضافة metadata أو IDs محددة، لا رفع صامت لملفات كاملة |
| إرسال للمراجعة | ينشئ طلبًا قابلًا للمراجعة، ولا يبدأ تنفيذًا مباشرًا |
| إلغاء | إلغاء المسودة أو الطلب الجاري فقط |
| سجل المهمة | فتح Agent Activity Center عند الحاجة |
| توسيع | تحويل الشريط إلى مساحة عمل مؤقتة دون تغيير الشاشة الحالية |

في الشريحة الحالية يجب أن يبقى الشريط في وضع إعداد ومعاينة ما لم توجد عملية IPC صريحة للتوجيه والمراجعة. لا ينشئ الشريط Chat مستقلًا لكل لوحة.

## Agent Activity Center

مركز نشاط الوكلاء لوحة سياقية مستقلة تفتح عند الطلب، وليست Panel دائمة. تعرض Workflow الوكيل بطريقة timeline وstructured output، وليس فقاعة محادثة طويلة.

| الحقل | الوصف |
|---|---|
| Agent | اسم تعريف Osamah أو Auto |
| Mission | المهمة المشتقة من توجيه المستخدم |
| Status | الحالة الحالية |
| Current Step | المرحلة الحالية من الدورة |
| Input | نسخة bounded من التوجيه |
| Context | الملفات أو IDs التي تمت قراءتها |
| Action | الإجراء المقترح أو الذي ينتظر موافقة |
| Output | summary أو plan أو diff أو artifact أو report |
| Review Required | ما يحتاج قرار المستخدم |
| Events | timeline مختصر |

### حالات النشاط

`idle`، `ready`، `thinking`، `planning`، `waiting_for_approval`، `running`، `completed`، `failed`، `blocked`، و`unavailable`. لا تعرض حالة `running` إذا لم تبدأ العملية فعليًا. عند الفشل تعرض المرحلة والسبب والإجراء التالي الآمن.

## Output Surface

كل عملية يجب أن تنتهي بمنطقة مخرجات محددة. لا يضع النظام نتيجة الوكيل في فقرة طويلة فقط.

| نوع العملية | شكل المخرج |
|---|---|
| تحليل | Summary، Findings، Risks، Confidence |
| خطة | Steps، Dependencies، Open Questions |
| اقتراح كود | Diff، Files، Expected Result، Review |
| إنتاج محتوى | Claims، Sources، Artifact، Warnings |
| ذاكرة | Entry، Provenance، Visibility، Review |
| فحص سياسة | Decision، Reasons، Bounds، Next Safe Action |
| تشخيص | Metrics، Events، Warnings، Recommendations |

الأفعال الممكنة تظهر بعد المخرج وتكون محددة الاسم: Review Changes، Preview Plan، Create Draft، Inspect Policy، Approve، Reject، Export. لا تستخدم أسماء غامضة أو زرًا عامًا بلا وصف.

## Input Surface

| نوع البيانات | المكوّن المناسب | مثال الاستخدام |
|---|---|---|
| نص قصير | input | عنوان، اسم، نطاق |
| نص متعدد الأسطر | textarea | توجيه، ملاحظات، محتوى |
| قيمة محددة | select | نوع المهمة، صيغة، جهاز |
| اختيار متعدد | multi-select | tags، sources، assets |
| تاريخ | date | موعد أو فترة |
| رقم | number | ميزانية، حد، عدد |
| ملف | file selector | اختيار metadata أو مستند مصرح |
| كود | code editor | مستند برمجي |
| نص منسق | rich text | مستند إنتاج |
| توجيه | prompt editor | Agent Command |
| أمر سياسة | command input | فحص terminal فقط |

يجب أن يظهر الناتج المتوقع بجانب أو أسفل الإدخال، وأن تبقى الحقول ذات العلاقة في نطاق واحد واضح دون خلط السجل أو الأفعال الحساسة معها.

## محرر المستندات

يظهر محرر المستند داخل Production Studio عند فتح artifact أو تقرير أو مستند. يتكون من قائمة مستندات، تبويبات، عنوان، حالة المراجعة، مساحة تحرير، قائمة claims أو المصادر، ومخرجات الحفظ.

| العنصر | الوصف |
|---|---|
| Document list | المستندات المحلية وحالاتها |
| Tabs | المستندات المفتوحة والحالة غير المحفوظة |
| Breadcrumb | المسار المنطقي للمستند |
| Editor | محتوى قابل للتحرير يدويًا |
| Claims/Evidence | علاقة النص بالمصادر |
| Revision | revision وhash عند توفرهما |
| Agent suggestions | اقتراحات منفصلة لا تكتب فوق المحتوى |
| Review | مقارنة وموافقة أو رفض |
| Export | يظهر فقط بعد الجاهزية والموافقة |

أي تعديل يدوي يجب أن يبقى محفوظًا في buffer أو revision واضح، ولا يجوز لوكيل أن يستبدله دون إظهار الفرق وطلب قرار.

## محرر العروض التقديمية

يستخدم للعروض المرتبطة بخطة محتوى وclaims وassets. لا يفتح عند الدخول إلى Production Studio تلقائيًا.

| المنطقة | المحتوى |
|---|---|
| Slide navigator | قائمة الشرائح وأرقامها وحالتها |
| Canvas | الشريحة الحالية |
| Notes | ملاحظات المتحدث أو التعليقات |
| Assets | الأصول المرتبطة بالشرائح |
| Claims | claims المستخدمة في الشريحة |
| Outline | ترتيب العناوين والأقسام |
| Review | تحذيرات overflow، claims، license، وقراءته |
| Export readiness | قرار السياسة قبل التصدير |

المخرجات المحتملة هي outline وslide draft وreview checklist. لا يعرض زر PPTX نهائي إذا كانت capability غير متاحة.

## محرر الصور

هو مساحة metadata وتعديلات يدوية أو مقترحات مستقبلية، وليس بوابة تشغيل image generator تلقائي.

| العنصر | المحتوى |
|---|---|
| Asset identity | asset ID، النوع، الحجم، license |
| Canvas | معاينة أو مساحة تحرير عند توفرها |
| Properties | أبعاد، crop، orientation، metadata |
| Adjustments | تغييرات يدوية أو مقترحة |
| Provenance | المصدر والـhash والحالة |
| Review | مقارنة الأصل والنسخة المقترحة |
| Output | asset draft أو policy result |

إذا لم تتوفر image capability، تظهر المعاينة metadata-only وحالة unavailable بدل إطار فارغ يوحي بوجود محرر عامل.

## محرر الفيديو

يعرض timeline ومصادر وأصولًا وقرارات السياسة، ولا يبدأ FFmpeg أو renderer تلقائيًا.

| العنصر | المحتوى |
|---|---|
| Timeline | مقاطع مرتبة ومدة bounded |
| Tracks | video، audio، captions عند توفرها |
| Asset bin | الأصول المرتبطة وlicense |
| Preview | معاينة خفيفة عند توفر capability |
| Markers | claims أو أحداث أو مراجعات |
| Render policy | format، memory، timeout، output path |
| Review | تحذيرات الموارد والحقوق |

يجب إظهار أن الفيديو قد يكون policy-only أو unavailable على جهاز محدود الموارد، مع عدم إنشاء worker مخفي.

## وحدات Second Brain الموسعة

لا تعرض كل وحدات العقل الثاني في شاشة واحدة. يستخدم التسلسل: Navigation → Workspace → Details.

| الوحدة | الوصف |
|---|---|
| Today | ملخص اليوم، إدخالات حديثة، مهام تحتاج مراجعة |
| Tasks | المهام وحالاتها ومصادرها |
| Work | مساحة العمل والقرارات والملفات المرتبطة |
| Finance | سجلات مالية محلية أو خطط، دون تنفيذ مالي تلقائي |
| Learning | موضوعات ودروس وملاحظات ومراجعات |
| Projects | مشاريع وعلاقاتها بالملفات والـartifacts |
| Notes | ملاحظات محلية bounded |
| Knowledge | entries مؤكدة ومصادرها |
| Calendar/Timeline | أحداث وتواريخ محلية عند توفر العقد |
| Goals | أهداف ومؤشرات وتقدم يدوي |
| Reviews | قائمة المعرفة والمهام المنتظرة لقرار المستخدم |

كل وحدة تعرض: ما الذي أراه، لماذا ظهر، ما الذي أستطيع فعله، ماذا سيحدث، وأين تذهب النتيجة.

## Work Management

| المكوّن | الحقول |
|---|---|
| قائمة العمل | title، status، priority، owner، due date |
| تفاصيل العمل | description، related project، sources، notes |
| الحالة | inbox، planned، active، blocked، done، archived |
| إجراء الوكيل | summarize، plan، identify risks، review |
| المخرجات | plan، checklist، decision، memory candidate |

لا ينفذ الوكيل تغييرًا على الحالة دون قرار المستخدم إذا كان التغيير مؤثرًا أو مرتبطًا بجهة خارجية.

## Finance Management

هذه الوحدة وصفية ومحلية ما لم تضاف عقود مستقلة. تعرض الحسابات أو الميزانيات أو السجلات دون تحويل أو دفع أو استثمار.

| المكوّن | الحقول |
|---|---|
| Accounts | اسم محلي، نوع، currency، visibility |
| Transactions | date، description، amount، category، source |
| Budgets | period، limit، current total، variance |
| Reports | summary، assumptions، unresolved items |
| Privacy | private افتراضيًا، provider access never |
| Review | اعتماد تصنيف أو تقرير |

أي فعل مالي خارجي يجب أن يظهر كـHuman Gate مستقل، ولا تضاف أزرار تنفيذ إذا لم توجد عقد معتمدة.

## Learning Management

| المكوّن | المحتوى |
|---|---|
| Learning Inbox | مصادر أو أفكار بانتظار التنظيم |
| Topic | عنوان، وصف، entries، sources |
| Study Plan | أهداف وخطوات ومواعيد |
| Review Queue | أسئلة أو summaries تحتاج مراجعة |
| Progress | تقدم يدوي أو bounded |
| Agent Action | اقتراح خطة، تلخيص، استخراج أسئلة |

لا تتحول التوصية إلى خطة فعالة أو ذاكرة مؤكدة دون مراجعة.

## إشعارات وأحداث مشتركة

يوجد نظام إشعارات واحد للتطبيق. الإشعار يصف القسم، الحدث، الحالة، والإجراء، ولا يكرر نظامًا خاصًا بكل شاشة.

| النوع | مثال |
|---|---|
| info | تم تجهيز معاينة محلية |
| success | تم إنشاء مسودة للمراجعة |
| warning | توجد claims غير محسومة |
| review | موافقة بشرية مطلوبة |
| error | تعذر قراءة المصدر |
| blocked | العملية موقوفة بسبب policy |
| unavailable | capability غير متاحة في المضيف |

يجب ألا يغطي الإشعار شريط الوكيل أو Inspector أو محتوى العمل، وأن يكون له عمر واضح أو سجل قابل للفتح.

## قاعدة التوسع

كل شاشة أو وحدة جديدة يجب أن تحدد قبل إضافتها: موقعها في التنقل، مساحة العمل التي تملكها، المدخلات، الحالة، المخرج، الأفعال، minWidth، minHeight، preferredWidth، preferredHeight، resizable، collapsible، priority، وoverflowPolicy. إذا لم تتوفر مساحة كافية، يكون التسلسل: إعادة التحجيم، ثم طي العنصر الثانوي، ثم تحويله إلى تبويب، ثم فتحه كلوحة سياقية. لا يجوز تصغير كل شيء حتى يصبح غير مقروء.
