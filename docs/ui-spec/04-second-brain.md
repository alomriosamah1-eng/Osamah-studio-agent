# مكونات Second Brain

## وظيفة الشاشة

تحتفظ هذه الشاشة بالمعرفة المحلية المؤقتة أو الدائمة وفق إعداد التخزين، وتوفر التقاطًا bounded وبحثًا lexical وقائمة مراجعة ومرشحات consolidation. لا تستخدم embeddings أو vector search أو مشاركة تلقائية مع providers، ولا تعتمد أي معرفة جديدة دون قرار صريح.

## مكونات الشاشة

| المكوّن | المعرف المقترح | الغرض |
|---|---|---|
| رأس Second Brain | `brainHeader` | وصف الذاكرة المحلية وسياسة الخصوصية |
| مؤشرات الذاكرة | `brainMetrics` | Backend، Retrieval، Provider Access، Review |
| التقاط الذاكرة | `memoryCapturePanel` | إدخال entry محلي للمراجعة |
| البحث المحلي | `memorySearchPanel` | بحث lexical محدود |
| قائمة الذاكرة | `memoryList` | عرض entries المسترجعة |
| قائمة المراجعة | `memoryReviewList` | entries المنتظرة لقرار المستخدم |
| دمج الذاكرة | `memoryConsolidationPanel` | إنشاء candidate من entries مؤكدة |
| قائمة المرشحين | `memoryCandidateList` | candidates وحالاتها |
| حالة الذاكرة | `memoryStatus` | نتيجة آخر إجراء |
| حالة الدمج | `memoryConsolidationStatus` | نتيجة إنشاء أو قراءة candidate |

## مؤشرات الحالة

| المؤشر | القيمة الافتراضية | المعنى |
|---|---|---|
| Backend | Memory / SQLite | التخزين المحلي اختياري؛ يجب بيان إن كان مؤقتًا |
| Retrieval | Lexical | البحث النصي المحلي فقط |
| Provider Access | Never | لا تمرير تلقائي للذاكرة إلى provider |
| Review | Explicit | الاعتماد يحتاج قرارًا صريحًا |

## Memory Capture

| الحقل | المعرف | النوع | الوصف |
|---|---|---|---|
| العنوان | `memoryTitle` | input | عنوان مختصر للمعرفة |
| النوع | `memoryKind` | select | Note، Research، Decision، Learning، Idea، Task، Summary |
| المحتوى | `memoryContent` | textarea | نص bounded قابل للمراجعة |
| الوسوم | `memoryTags` | input | وسوم مفصولة بفواصل، دون أسرار |
| الالتقاط | `captureMemoryEntry` | button | ينشئ entry بحالة مراجعة |
| الحالة | `memoryStatus` | status | ready، review_required، rejected، unavailable |
| قائمة النتائج | `memoryList` | list | entries الحالية أو نتائج البحث |

العملية هي `brain.memory.capture`. يجب قص المحتوى إلى الحد المسموح، رفض المحتوى الفارغ أو غير الآمن، وإظهار أن الالتقاط لا يعني الاعتماد. لا تحفظ الواجهة النص في provider أو network.

## البحث المحلي

| العنصر | المعرف | الوظيفة |
|---|---|---|
| عبارة البحث | `memorySearch` | نص البحث |
| تنفيذ البحث | `searchMemoryEntries` | استدعاء `brain.memory.searchLocal` |
| عرض الكل | `listMemoryEntries` | استدعاء `brain.memory.list` |
| النتائج | `memoryList` | عنوان، نوع، مقتطف bounded، حالة، وسوم |

يجب أن يوضح الحقل أن البحث lexical، ولا يوحي بفهم دلالي أو بحث vector. إذا كان البحث فارغًا، يعرض entries محدودة أو يوضح عدم وجود نتائج وفق العقد. لا تظهر الملفات الخام أو مساراتها الكاملة ضمن النتائج إلا إذا كانت metadata مسموحة.

## قائمة المراجعة

| العنصر | المعرف | الوظيفة |
|---|---|---|
| سبب المراجعة | `memoryReviewReason` | تفسير قرار المستخدم |
| فتح القائمة | `listMemoryReview` | استدعاء `brain.memory.listForReview` |
| قائمة العناصر | `memoryReviewList` | entry وسبب الانتظار وحالته |
| قبول | `reviewMemoryApprove` | قرار قبول إذا وفرته العقد |
| رفض | `reviewMemoryReject` | قرار رفض مع السبب |
| أرشفة | `reviewMemoryArchive` | قرار أرشفة إذا كانت capability متاحة |

العملية هي `brain.memory.review`. لا يوجد اعتماد صامت عند انتهاء الجلسة. يجب عرض الفرق بين `pending_review` و`confirmed` و`rejected` و`archived`، ويجب إبقاء السبب جزءًا من سجل القرار.

## Memory Consolidation

هذه اللوحة لا تكتب قاعدة معرفة مباشرة. تنشئ candidate من entries مؤكدة فقط، ثم تعرضه للمراجعة.

| الحقل | المعرف | الوصف |
|---|---|---|
| عنوان المرشح | `memoryCandidateTitle` | اسم المرشح |
| نوع المرشح | `memoryCandidateKind` | Summary، Fact، Decision، Procedure، Episode |
| المحتوى | `memoryCandidateContent` | خلاصة bounded |
| مصادر الإدخال | `memoryCandidateSourceIds` | IDs مؤكدة مفصولة بفواصل |
| النطاق | `memoryCandidateScope` | مثل second-brain |
| إنشاء المرشح | `createMemoryCandidate` | إنشاء candidate review_required |
| تحديث القائمة | `listMemoryCandidates` | قراءة candidates |
| الحالة | `memoryConsolidationStatus` | نتيجة الإنشاء أو الرفض |
| القائمة | `memoryCandidateList` | المرشح ومصادره وحالته |

العمليات هي `memory-candidate.create` و`memory-candidate.preview` و`memory-candidate.review`. يجب رفض أي source ID غير مؤكد أو غير معروف، ورفض المرشح الذي يتجاوز الحدود أو يحتوي أسرارًا. لا ينشئ هذا المسار embeddings ولا يغير policy ولا يتيح provider access.

## بنية عنصر الذاكرة

| الحقل المعروض | القاعدة |
|---|---|
| ID | عرض مختصر أو أول وآخر جزء فقط |
| العنوان | النص الذي أدخله المستخدم بعد sanitization |
| النوع | label واضح |
| المحتوى | مقتطف bounded، مع إمكانية طلب مراجعة التفاصيل |
| الوسوم | قائمة قصيرة |
| الحالة | pending review أو confirmed أو rejected أو archived |
| المصدر | source IDs أو owner input، دون أسرار |
| الزمن | وقت محلي منسق، إذا توفر |

## العلاقات بين الذاكرة والإنتاج

يمكن لمكونات Production Studio استخدام source IDs أو claims المرتبطة بالمصادر، لكن لا يجب تمرير كل الذاكرة تلقائيًا إلى خطة إنتاج. عند طلب استخدام entry أو candidate يجب عرض المصادر والنطاق والسبب، ثم احترام provider access = Never ما لم توجد موافقة وعقد منفصل.

## الحالات المطلوبة

| الحالة | الرسالة والسلوك |
|---|---|
| لا توجد ذاكرة | «لا توجد entries» مع إرشاد الالتقاط |
| التقاط ناجح | entry جديدة بحالة review_required |
| محتوى فارغ | رفض محلي مع تحديد الحقل |
| حجم زائد | رفض مع بيان الحد دون عرض المحتوى كاملًا |
| بحث بلا نتائج | «لا توجد نتائج محلية» |
| مراجعة مطلوبة | زر فتح المراجعة وقائمة العناصر |
| source غير معروف | رفض candidate وإظهار source ID المسبب |
| تعارض | إبقاء candidate غير معتمد وبيان التعارض |
| تخزين غير متاح | عرض unavailable دون إسقاط القيم المدخلة تلقائيًا |
| backend مؤقت | تنبيه أن الذاكرة قد لا تبقى بعد إغلاق المضيف |

## الخصوصية

يجب إظهار رسالة ثابتة بأن الذاكرة محلية ولا تُشارك تلقائيًا. لا يظهر token أو credential أو محتوى ملف خام غير مطلوب. عند تسجيل حدث في timeline، يستخدم النظام وصفًا مختصرًا مثل `brain.memory.capture` مع النتيجة، وليس المحتوى الكامل.

## الحدود

لا تحتوي الشاشة على قناة agent مستقلة ولا زر «تدريب النموذج». إدخال instruction أو strategy أو skill يخص لوحة التطوير الذاتي في مركز التحكم ويبدأ كـcandidate يحتاج review. لا تضاف semantic search أو embeddings أو FTS migration إلى هذه الواجهة ضمن هذه المرحلة.
