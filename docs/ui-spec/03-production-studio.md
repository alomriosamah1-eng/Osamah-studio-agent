# مكونات Production Studio

## وظيفة الشاشة

تدير هذه الشاشة دورة إنتاج قابلة للتتبع تبدأ بالمصدر وتنتهي بمسودة artifact أو تقرير قابل للمراجعة. كل مرحلة تعرض provenance وclaims وحالة التحقق، ولا تنتج ملفًا أو تنشر محتوى تلقائيًا في غياب العقد المناسبة والموافقة البشرية.

## مكونات الشاشة

| المكوّن | المعرف المقترح | الغرض |
|---|---|---|
| رأس Production Studio | `productionHeader` | اسم البيئة ووصف المسار من المصدر إلى artifact |
| مؤشرات الإنتاج | `productionMetrics` | Provenance، Render، Export، Verification |
| سجل المصادر | `sourceRegistryPanel` | تسجيل metadata للمصادر المحلية وعرضها |
| سجل الاستشهادات | `citationPanel` | عرض citations المرتبطة بمصدر معروف |
| خطة المحتوى | `contentPlanPanel` | إنشاء معاينة خطة وclaims قبل أي توليد |
| كتالوج الأصول | `assetCatalogPanel` | تسجيل metadata للأصول وlicense وprovenance |
| الـCreative Brief | `creativeBriefPanel` | تحديد الهدف البصري وربط asset IDs |
| مراجعة الـArtifact | `artifactReviewPanel` | بناء manifest قابل للمراجعة |
| مستند التقرير | `reportDocumentPanel` | إنشاء تقرير محلي وتسجيل قرار المراجعة |
| جاهزية التصيير | `renderReadinessPanel` | فحص السياسة والموارد دون تشغيل renderer |

## مؤشرات الحالة

| المؤشر | المعنى |
|---|---|
| Provenance | العلاقة بين source وclaim وartifact قابلة للتتبع |
| Render | حالة policy فقط ما لم تتوفر capability تنفيذية |
| Export | Human Gate قبل إنشاء ملف أو إخراجه |
| Verification | التحقق صريح، ولا يتحول citation إلى FACT تلقائيًا |

## Sources and Citations

### سجل المصدر

| العنصر | المعرف | البيانات |
|---|---|---|
| تسجيل الملف المحدد | `registerCurrentSource` | تسجيل metadata للمستند المحدد فقط |
| تحديث المصادر | `refreshSources` | قراءة السجل المحلي |
| حالة السجل | `sourceRegistryStatus` | ready، empty، rejected، unavailable |
| قائمة المصادر | `sourceList` | source ID، النوع، hash المختصر، الحجم، الحالة |
| قائمة citations | `citationList` | citation ID، source ID، span/page، حالة التحقق |

العملية المرتبطة بالمصدر هي `production.source.register`، وتعرض metadata وhash وbytes وفق الحدود. عملية `production.source.list` تعرض السجل دون فتح locator أو تنفيذ fetch. عملية `production.citation.list` تعرض citations للمصادر المعروفة فقط.

### قواعد المصدر

لا يُسجل مصدر بلا hash وbytes عند اشتراطهما، ولا تُعرض مسارات شخصية كاملة أو محتوى خام طويل. إذا كان المصدر غير موثوق أو citation خارج span صالح، تظهر حالة رفض مع السبب. يجب التفريق بين `UNVERIFIED` و`FACT` وعدم استخدام اللون وحده لتمييز الحالة.

## Content Plan

| العنصر | المعرف | الوظيفة |
|---|---|---|
| ملخص الخطة | `contentBrief` | وصف ما يريد المستخدم إنتاجه |
| بناء المعاينة | `createContentPlan` | إنشاء plan review-only |
| الحالة | `contentPlanStatus` | حالة الخطة وسبب الرفض |
| عدد الأقسام | `contentPlanSections` | عدد الأقسام المقترحة |
| عدد claims | `contentPlanClaims` | العدد الكلي |
| المدعوم | `contentPlanSupported` | claims ذات evidence صالح |
| غير المحسوم | `contentPlanUnresolved` | claims تحتاج مصدرًا أو تحققًا |
| المتعارض | `contentPlanConflicted` | claims لها مصادر متعارضة |
| قائمة claims | `contentPlanClaimList` | النص والحالة والمصادر المرتبطة |

العملية الأساسية هي `production.plan.create` ثم إضافة section وclaim عبر `production.plan.section.add` و`production.plan.claim.add`. زر المعاينة لا يشغل provider generation ولا يكتب ملفًا ولا ينشئ render. عند وجود claims غير محسومة يجب إبرازها قبل السماح بأي خطوة لاحقة.

## Asset Catalog

| العنصر | المعرف | الوظيفة |
|---|---|---|
| تسجيل أصل تجريبي | `registerDemoAsset` | إضافة metadata محلية لا binary |
| تحديث الكتالوج | `refreshAssets` | قراءة الأصول المسجلة |
| الحالة | `assetCatalogStatus` | empty، ready، rejected، unavailable |
| القائمة | `assetList` | asset ID، النوع، license، provenance، الحالة |

العمليات هي `production.asset.register` و`production.asset.list`. لا تفتح الواجهة locator ولا تشغل ComfyUI أو FFmpeg أو converter. لا يرفع الأصل ولا ينسخ binary. يجب أن يظهر تحذير واضح إن كان الترخيص غير معروف أو provenance ناقصًا.

## Creative Brief

| الحقل | المعرف | المحتوى |
|---|---|---|
| العنوان | `briefTitle` | اسم موجز الـBrief |
| الهدف | `briefIntent` | النتيجة المطلوبة أو الاتجاه العام |
| الإنشاء | `createCreativeBrief` | بناء brief مرتبط بالـasset IDs الموجودة |
| الحالة | `creativeBriefStatus` | ready أو review_required أو rejected |
| عدد الأصول | `briefAssetCount` | الأصول المرتبطة |
| التحذيرات | `briefWarningCount` | licenses أو provenance ناقصة |
| القائمة | `briefAssetList` | IDs وحالات الارتباط |

الـBrief يربط metadata ولا يشغل media generation. إذا لم توجد أصول، يعرض سببًا واضحًا ولا ينشئ روابط وهمية. يجب إبقاء الهدف الذي كتبه المستخدم منفصلًا عن أي نص مولد.

## Artifact Review

| العنصر | المعرف | الوظيفة |
|---|---|---|
| عنوان المسودة | `artifactTitle` | اسم manifest المحلي |
| بناء manifest | `createArtifactDraft` | تجميع claims وassets وsources للمراجعة |
| الحالة | `artifactStatus` | ready، review_required، rejected |
| حالة المراجعة | `artifactReviewState` | draft أو awaiting_review أو approved |
| claims | `artifactClaimCount` | عدد claims |
| assets | `artifactAssetCount` | عدد الأصول |
| sources | `artifactSourceCount` | عدد المصادر |
| الأدوات | `artifactToolCount` | الأدوات المستخدمة، وغالبًا صفر في المعاينة |
| manifest | `artifactManifestList` | عناصر التجميع وحالاتها |

العملية هي `production.artifact.draft.create` أو ما يقابلها في العقد الحالية. بناء manifest لا ينشئ output file ولا يشغل converter. أي عنصر ناقص يجب أن يمنع الانتقال إلى حالة جاهزة، ويعرض السبب داخل القائمة.

## Report Document

| العنصر | المعرف | الوظيفة |
|---|---|---|
| عنوان التقرير | `reportTitle` | اسم المستند |
| النطاق | `reportScope` | مجال التغطية |
| سبب المراجعة | `reportReviewReason` | سبب قرار المستخدم |
| بناء التقرير | `createReportDocument` | إنشاء مسودة تقرير محلية |
| تحديث القائمة | `refreshReportDocuments` | قراءة التقارير المحلية |
| الموافقة المحلية | `approveReportDocument` | تسجيل قرار مراجعة، لا نشر |
| الحالة | `reportStatus` | draft، awaiting_review، approved، rejected |
| حالة المراجعة | `reportReviewState` | الحالة الرسمية للمستند |
| claims | `reportClaimCount` | عدد claims |
| evidence | `reportEvidenceCount` | عدد الأدلة |
| sources | `reportSourceCount` | عدد المصادر |
| redaction | `reportRedactionState` | حالة إخفاء البيانات الحساسة |
| قائمة claims | `reportClaimList` | claim، evidence، حالة التحقق |

العمليات هي `production.report.create` و`production.report.get` و`production.report.list` و`production.report.review`. لا ينشئ التقرير PDF ولا ينشره تلقائيًا. الموافقة المحلية يجب أن تعرض للمستخدم ما تمت مراجعته وسبب القرار، ولا تعني external verification.

## Render Readiness

| العنصر | المعرف | الخيارات أو النتيجة |
|---|---|---|
| الصيغة | `renderFormat` | HTML، Markdown، PDF policy، PPTX policy، Image policy، Video policy |
| فحص السياسة | `previewRenderPolicy` | مراجعة format والموارد والـmanifest |
| الحالة | `renderPolicyStatus` | policy ready، blocked، unavailable |
| القرار | `renderDecision` | allow، deny، review_required |
| مسار adapter | `renderAdapter` | اسم مسار Osamah لا اسم شاشة upstream |
| ميزانية الذاكرة | `renderMemoryBudget` | حد مقترح أو مرفوض |
| بدأ التنفيذ | `renderExecutionStarted` | يجب أن يبقى false في المعاينة |
| الفحوص | `renderChecksList` | checks ونتائجها وأسبابها |

العملية هي `production.render.policy.preview`. لا تُستدعى renderer أو converter ولا يُنشأ output file من هذه اللوحة. إذا تجاوزت الصيغة حدود Ubuntu 8GB أو احتاجت capability غير متاحة، تظهر حالة blocked أو unavailable.

## العلاقات بين المكونات

| المرحلة | المدخل | المخرج |
|---|---|---|
| Source | ملف أو metadata محلي | source ID وhash |
| Citation | source ID وspan صالح | citation قابلة للمراجعة |
| Content Plan | brief ومصادر | sections وclaims |
| Asset Catalog | metadata أصل | asset ID وحالة الترخيص |
| Creative Brief | intent وasset IDs | brief reviewable |
| Artifact | claims وassets وsources | manifest |
| Report | plan وevidence وsources | مستند تقرير |
| Render Policy | manifest وformat وresources | قرار سياسة فقط |

## الحالات المطلوبة

| الحالة | المطلوب عرضه |
|---|---|
| لا توجد مصادر | تعليمات تسجيل metadata محليًا |
| مصدر مرفوض | سبب hash أو span أو نطاق غير صالح |
| claims غير محسومة | العدد والقائمة ومصادر النقص |
| license ناقص | تحذير يمنع الجاهزية إن كانت السياسة تتطلب ذلك |
| manifest ناقص | العناصر الناقصة وحالة review_required |
| تقرير بلا evidence | منع الجاهزية مع سبب واضح |
| render غير متاح | لا worker ولا converter، مع بيان السبب |
| موافقة مطلوبة | Human Gate ونطاق القرار |

## الحدود

لا توجد في هذه الشاشة قناة محادثة مستقلة أو UI لمشروع مفتوح المصدر. كل actions تُعرض عبر أسماء Osamah، وكل قدرة غير متاحة تظهر كسياسة أو حالة مراجعة. لا يُسمح بإنشاء agent loop أو generation route إضافي داخل Production Studio.
