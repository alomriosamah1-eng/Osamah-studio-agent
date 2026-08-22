# مكونات مركز التحكم

## وظيفة الشاشة

مركز التحكم هو الشاشة الإدارية المستقلة للتطبيق. تُستدعى من Global Rail أو تبويب مركز التحكم ولا تظهر داخل بيئة التطوير أو Production Studio أو Second Brain. تجمع الإعدادات العامة، الحسابات الخارجية، التخزين، كتالوج الوكلاء، المزودين، التطوير الذاتي، الخصوصية والأمان، الأداء والتشخيص.

## الهيكل العام

| المنطقة | المكوّن | الغرض |
|---|---|---|
| رأس الشاشة | `controlCenterHeader` | اسم المركز وشرح الحوكمة |
| تبويبات الإدارات | `controlSectionTabs` | اختيار إدارة واحدة داخل المركز |
| مساحة الإدارة | `controlSectionPanel` | عرض محتوى الإدارة النشطة فقط |
| حالة الإعدادات | `settingsStatus` | نتيجة التحميل أو التحديث |
| كتالوج الوكلاء | `agentCatalogPanel` | تعريفات الوكلاء وحالتها |
| المزودون | `providerPanel` | حالة التسجيل والسياسة والقدرات |
| حدود المحرر | `editorBoundaryPanel` | diff وHuman Gate وtimeline |

## الإدارة العامة

| الحقل | المعرف | القيم |
|---|---|---|
| اللغة | `appLocale` | العربية، English |
| المظهر | `appTheme` | داكن، فاتح |
| حجم النص | `appFontScale` | 90% إلى 125% |
| الكثافة | `appDensity` | مريحة، مضغوطة |
| تقليل الحركة | `appReduceMotion` | مفعّل أو غير مفعّل |
| حالة الإعدادات | `settingsStatus` | active، updated، rejected، unavailable |

عند تغيير قيمة، يجب تطبيقها على القشرة دون فتح شاشة أخرى أو إظهار المحاكي أو Inspector. الاتجاه يتبع اللغة، مع استثناء المسارات والكود والطرفية وdiff. إذا فشل التحديث، تعاد آخر قيمة سليمة ولا يبقى التطبيق في حالة نصف محدثة.

## تبويبات الإدارات

| التبويب | القيمة المنطقية | المحتوى |
|---|---|---|
| العامة | `general` | اللغة، المظهر، النص، الكثافة، الحركة |
| الحسابات الخارجية | `accounts` | metadata للحسابات وموافقة الربط |
| التخزين | `storage` | backend والموقع والسياسة والنسخ الاحتياطي |
| التطوير الذاتي | `selfDevelopment` | إدخال التوجيهات والاستراتيجيات والمخططات والمهارات |
| الخصوصية والأمان | `privacySecurity` | سياسة البيانات، الأسرار، Human Gate، سجل الأمان |
| الأداء والتشخيص | `performanceDiagnostics` | الذاكرة، الموارد، الأحداث، التشخيص |

الإدارة النشطة فقط تعرض حقولها. بقية الإدارات تبقى مخفية، ولا تُكدّس كل الحقول في صفحة طويلة واحدة.

## إدارة الحسابات الخارجية

### الحقول

| الحقل | المعرف | الوصف |
|---|---|---|
| نوع المزود | `accountProvider` | GitHub، Google، OAuth provider، MCP server |
| اسم الحساب | `accountLabel` | اسم محلي ودود |
| المالك | `accountOwner` | المالك المحلي أو الجهة المصرح بها |
| النطاقات | `accountScopes` | scopes مطلوبة بصيغة محدودة |
| نطاق الموارد | `accountResourceScope` | workspace metadata أو نطاق أضيق |
| التسجيل | `registerExternalAccount` | تسجيل metadata فقط في الشريحة المحلية |
| الحالة | `externalAccountStatus` | disconnected، consent_required، verified، rejected |
| القائمة | `externalAccountList` | حسابات metadata دون tokens |

العمليات هي `external.account.register` و`external.account.list`. التسجيل لا يبدأ OAuth ولا network ولا يعرض token. قبل أي ربط حقيقي يجب عرض provider والنطاقات والبيانات المطلوبة وسبب الوصول، ثم طلب consent وHuman Gate حسب العقد.

### الحالات

| الحالة | المحتوى |
|---|---|
| لا حسابات | «لا توجد بيانات حسابات» |
| disconnected | لا اتصال نشط |
| consent required | موافقة المستخدم مطلوبة |
| verification unknown | لم يتم التحقق الخارجي |
| rejected | الرفض وسببه دون إعادة محاولة صامتة |
| unavailable | الخدمة أو المضيف غير متاح |

## إدارة التخزين

### العناصر

| العنصر | المعرف | البيانات |
|---|---|---|
| الحالة | `storageSettingsStatus` | backend الحالي وحالة القراءة |
| القائمة | `storageSettingsList` | backend، location، profile، schema، lock، fallback، backup، retention، quota |
| إجراء مستقبلي | `backupStorage` | لا يظهر إلا بعد وجود عقد وموافقة |
| إجراء مستقبلي | `restoreStorage` | لا يظهر أو يبقى معطلًا حتى يضاف Human Gate كامل |

العملية الحالية هي `storage.get`. يجب إخفاء المسار المطلق لملف قاعدة البيانات عند عدم الحاجة. إذا كان backend هو memory، يظهر أن الحالة مؤقتة وقد لا تستمر بعد إغلاق المضيف. إذا كان SQLite مفعّلًا، يظهر schema وlock والنسخ الاحتياطي كحالة، ولا يبدأ النقل أو الحذف أو الاستعادة من هذه الشاشة دون موافقة.

## إدارة التطوير الذاتي

هذه الإدارة هي المكان المخصص لإدخال ما يريد المستخدم أن يتعرف عليه النظام ويحتفظ به كمرشح معرفي. الإدخال لا يغير القواعد أو policy تلقائيًا.

| الحقل | المعرف | القيم أو الوصف |
|---|---|---|
| النوع | `selfDevelopmentKind` | توجيه، استراتيجية، مخطط، مهارة |
| العنوان | `selfDevelopmentTitle` | عنوان المرشح |
| المحتوى | `selfDevelopmentContent` | نص bounded يشرح التوجيه أو الاستراتيجية أو المخطط أو المهارة |
| النطاق | `selfDevelopmentScope` | نطاق الاستخدام مثل second-brain |
| المصدر | `selfDevelopmentSource` | owner-input أو مصدر موثق |
| الإنشاء | `createSelfDevelopmentCandidate` | إنشاء مرشح للمراجعة |
| الحالة | `selfDevelopmentStatus` | review_required، rejected، active، archived |
| القائمة | `selfDevelopmentList` | المرشحات والمراجعة والحالة |

العمليات هي `self-development.create` و`self-development.list` و`self-development.preview` و`self-development.review`. يجب أن يبدأ كل إدخال بحالة `review_required` وأن يكون provider access = never. لا يصبح التوجيه أو الاستراتيجية أو المهارة فعالة إلا بعد مراجعة صريحة، ولا يسمح الإدخال بتعديل صلاحيات أو إزالة Human Gate أو إضافة tool capability.

### حالات التطوير الذاتي

| الحالة | السلوك |
|---|---|
| draft | قيمة محلية لم تُرسل |
| review_required | مرشح محفوظ ينتظر قرارًا |
| conflict | تعارض مع مرشح أو policy قائم |
| approved | تمت الموافقة على المرشح وفق العقد |
| active | فعّال ضمن النطاق المحدد فقط |
| archived | غير فعال ويمكن مراجعته |
| rejected | مرفوض مع سبب |

## Providers and Agent Catalog

### كتالوج الوكلاء

| العنصر | المعرف | الوظيفة |
|---|---|---|
| تحديث الكتالوج | `refreshAgentCatalog` | استدعاء `agent.catalog.list` |
| حالة الكتالوج | `agentCatalogStatus` | loading، empty، ready، rejected |
| القائمة | `agentCatalogList` | role، execution status، authority، mission، capabilities |
| تعريف محدد | `agentDefinitionDetails` | قراءة metadata عند توفر العقد |

تعريف الوكيل لا يعني تنفيذًا. يجب إظهار `decisionAuthority` و`executionStatus` والقدرات المسموح بها. لا توجد أزرار تشغيل مباشرة في الكتالوج الحالي.

### المزودون

| العنصر | المعرف | الوظيفة |
|---|---|---|
| اللوحة | `providerPanel` | عرض حالة المزودين |
| الحالة الفارغة | `providerEmpty` | لا يوجد provider مسجل |
| القائمة | `providerList` | provider ID، الحالة، capabilities، consent، verification |
| التسجيل | `registerProvider` | لا يظهر دون عقد واضح |
| الفحص | `doctorProvider` | فحص policy/health، لا يرسل سرًا للواجهة |

العقود المتاحة في المنظومة تشمل `provider.list` و`provider.configure` و`provider.doctor`، لكن الواجهة لا تعرض configure أو doctor كتنفيذ تلقائي. يجب أن يكون أي token مخفيًا، وأي اتصال خارجي صريحًا ومراجعًا.

## إدارة الخصوصية والأمان

يجب أن توفر هذه الإدارة مؤشرات واضحة، حتى لو كانت read-only في البداية.

| المكوّن | المعرف | المحتوى |
|---|---|---|
| سياسة البيانات | `privacyDataPolicy` | local-only، ما قد يغادر الجهاز، ومواضع التخزين |
| إدارة الأسرار | `secretSafetyPanel` | عدم عرض tokens أو raw secrets |
| Human Gate | `privacyHumanGate` | الأفعال الحساسة تحتاج موافقة |
| صلاحيات المضيف | `hostPermissionPanel` | filesystem، terminal، network، external accounts |
| سجل الأمان | `securityEventsList` | أحداث bounded ومُنقّحة |
| حالة الخصوصية | `privacySecurityStatus` | healthy، warning، blocked، unavailable |

تشرح الشاشة ما يقرأه النظام وما قد يكتبه وإلى أين قد تُرسل البيانات. لا تعرض أسرارًا لاختبار الواجهة، ولا تسمح بزر «السماح بكل شيء». كل صلاحية منفصلة ومحددة النطاق.

## إدارة الأداء والتشخيص

| المكوّن | المعرف | المحتوى |
|---|---|---|
| ملف الذاكرة | `performanceProfile` | low-memory أو standard |
| ميزانية الذاكرة | `memoryBudget` | حد مقترح وحالة الاستخدام |
| عدد الأعمال المتزامنة | `concurrencyLimit` | preview وagent jobs وفق policy |
| حالة المحاكي | `previewResourceState` | موارد المعاينة الحالية |
| حالة التخزين المؤقت | `cacheState` | الحجم، retention، clear policy |
| الأحداث | `diagnosticEventsList` | أحدث أحداث bounded |
| فحص الأداء | `runDiagnostics` | قراءة وتشخيص فقط في البداية |
| الحالة | `performanceDiagnosticsStatus` | ready، warning، failed، unavailable |

يجب ألا تبدأ الشاشة profiler ثقيلًا عند الفتح. تعرض بيانات مخزنة أو قراءة خفيفة، وتوضح إن كان الفحص قد بدأ بطلب المستخدم. في ملف Ubuntu 8GB يجب إبقاء preview واحد وعمل agent واحد حسب policy وعدم إنشاء workers زائدة.

## المحرر والحدود

| العنصر | المعرف | المحتوى |
|---|---|---|
| الوضع | `editorState` | fixture/read-only أو loaded/proposal only |
| mutation | `editorMutationState` | Human Gate required |
| diff | `diffPreview` | اقتراح محدود |
| timeline | `timeline` | PreviewCreated، StatusChanged، waiting for input |

هذه المنطقة توضح الحدود ولا تتحول إلى محرر ثانٍ. لا commit أو push أو terminal execution من مركز التحكم.

## الحالات العامة لمركز التحكم

| الحالة | السلوك |
|---|---|
| loading | إظهار الإدارة مع حالة تحميل دون تعطيل بقية القشرة |
| empty | توضيح عدم وجود حسابات أو مزودين أو مرشحين |
| review_required | إبراز العناصر المنتظرة لقرار المستخدم |
| rejected | عرض سبب الرفض مع الاحتفاظ ببيانات آمنة |
| unavailable | توضيح أن المضيف لا يملك capability |
| degraded | استمرار القشرة مع تحذير الأداء أو التخزين |

## الحدود

لا يفتح مركز التحكم شاشات OpenCode أو Hermes أو DeepSeek، ولا يعرض routes أو renderer أو agent loop من مشروع خارجي. كل إعداد أو مرشح يمر عبر عقود Osamah، وكل قدرة مستقبلية يجب أن تحصل على مالك واحد وسياسة واضحة وحالة مراجعة.
