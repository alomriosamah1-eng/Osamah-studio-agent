# سجل جرد مكونات واجهات التطبيق

هذا السجل هو قائمة تحقق تنفيذية مختصرة. التفاصيل السلوكية لكل مجموعة موجودة في الملفات المتخصصة، بينما يضمن هذا الملف وجود كل مكوّن أساسي وعدم إسقاط أي حقل أو إجراء.

## القشرة العامة

| المعرّف | النوع | الوصف | الأفعال أو الحالة |
|---|---|---|---|
| `root` | حاوية | جذر التطبيق | theme، locale، direction |
| `bodyShell` | حاوية | شبكة الشريط والقائمة ومساحة العمل واللوحات السياقية | inspector-open |
| `brand` | هوية | اسم التطبيق وشعاره النصي | ثابت |
| `workspaceTabs` | تنقل | البيئات الأربع | active view |
| `openProject` | زر | اختيار جذر مشروع | canceled، selected، failed |
| `toggleInspector` | زر | فتح أو إخفاء Inspector | aria-expanded |
| `approve` | زر | فتح قائمة Human Gate | refresh queue |
| `rail` | تنقل | Global Rail | active view |
| `sidebar` | منطقة | Project Sidebar | project state |
| `projectState` | حالة | حالة جذر المشروع | ready، required، failed |
| `projectTree` | قائمة | شجرة الملفات | empty، loaded، error |
| `footerText` | حالة | اسم الشاشة الحالية | يتغير مع التنقل |
| `rightStatus` | حالة | نتيجة الإجراء العام | ready، running، stopped، blocked |
| `inspectorPanel` | لوحة | المراقبة والحوكمة | hidden افتراضيًا |
| `closeInspector` | زر | إغلاق Inspector | إغلاق فقط |
| `inspectorStatus` | حالة | سياق Inspector | screen context |
| `approvalPanel` | لوحة | Human Gate queue | empty، pending، resolved |
| `approvalEmpty` | حالة | عدم وجود موافقات | empty |
| `approvalList` | قائمة | الموافقات الحالية | review، approve، reject |
| `timeline` | سجل | أحداث bounded | ready، waiting، warning |

## بيئة التطوير

| المعرّف | النوع | الوصف | العقد أو السلوك |
|---|---|---|---|
| `developmentWorkspace` | حاوية | مساحة أدوات التطوير | preview-open |
| `openPreview` | زر | فتح أو إخفاء المحاكي | hidden toggle |
| `run` | زر | تشغيل/إظهار المعاينة المتاحة | يفتح المحاكي |
| `stop` | زر | إظهار توقف المعاينة | لا process غير مصرح بها |
| `refresh` | زر | تحديث المعاينة | يحافظ على السياق |
| `capture` | زر | التقاط محلي إن توفر | لا نشر تلقائي |
| `agentInstruction` | textarea | توجيه المستخدم للوكيل | required، bounded |
| `agentIntent` | select | نوع المهمة | review، plan، explain، propose |
| `agentScope` | input | نطاق التوجيه | workspace أو relative path |
| `agentConstraints` | input/textarea | القيود | read-only، no execution، Human Gate |
| `previewAgentCommand` | زر | معاينة التوجيه | محلي فقط |
| `clearAgentCommand` | زر | مسح التوجيه | reset safe defaults |
| `agentCommandStatus` | حالة | نتيجة المعاينة | draft، previewed، rejected |
| `agentCommandPreview` | منطقة | التوجيه المنسق | textContent فقط |
| `tabName` | تبويب | اسم الملف الحالي | fixture أو loaded |
| `path` | نص | المسار النسبي | LTR |
| `editorMeta` | حالة | revision، bytes، أو fixture | bounded |
| `editorBuffer` | textarea | buffer المستند | لا كتابة تلقائية |
| `editorState` | حالة | حالة المحرر | read-only، modified، conflict |
| `proposeDiff` | زر | اقتراح diff | `editor.propose` |
| `diffPreview` | منطقة | diff المقترح | bounded، no mutation |
| `previewPanel` | لوحة | المحاكي المدمج | hidden افتراضيًا |
| `deviceSelect` | select | profile الجهاز | Pixel، iPhone، Tablet |
| `rotate` | زر | تدوير الإطار | portrait، landscape |
| `theme` | زر | مظهر شاشة الهاتف | local preview only |
| `phone` | حاوية | إطار الجهاز | profile dimensions |
| `pill` | شارة | embedded/lightweight mode | informational |
| `previewTree` | حاوية | شجرة العرض | safe DOM |
| `deviceKv` | قائمة خصائص | platform، OS، frame، DPI، safe area، mode | read-only |
| `log` | سجل | جلسة المعاينة | ready، stopped، warning |
| `reviewTask` | زر | طلب مراجعة المهمة | `task.preview` |
| `taskReviewStatus` | حالة | نتيجة مراجعة المهمة | empty، ready، blocked |
| `taskContextFiles` | قيمة | عدد أو أسماء الملفات | bounded |
| `taskContextManifests` | قيمة | حالة manifest | bounded |
| `taskTargetCount` | قيمة | عدد الملفات المستهدفة | bounded |
| `taskContextState` | قيمة | حالة السياق | safe، blocked، rejected |
| `taskPlanList` | قائمة | خطة المراجعة | read-only |
| `taskCritiqueList` | قائمة | نقد أو ملاحظات | read-only |
| `taskTargetList` | قائمة | الملفات المستهدفة | relative paths |
| `terminalExecutable` | input | الأمر المراد فحصه | LTR، bounded |
| `terminalArgs` | input | الوسائط | LTR، bounded |
| `inspectTerminal` | زر | فحص السياسة | `terminal.inspect` |
| `terminalPolicyResult` | منطقة | allowed أو denied أو gate | لا تنفيذ |
| `refreshGit` | زر | تحديث Git | `git.status` |
| `gitRepoState` | قيمة | حالة repository | root required أو ready |
| `gitBranch` | قيمة | branch | read-only |
| `gitCounts` | قيمة | عدد التغييرات | bounded |
| `gitChanges` | قائمة | مسارات التغييرات | relative paths |
| `gitDiffPreview` | منطقة | diff للقراءة | لا commit أو push |

## Production Studio

| المعرّف | النوع | الوصف | العقد أو السلوك |
|---|---|---|---|
| `sourceRegistryStatus` | حالة | حالة سجل المصادر | empty، ready، rejected |
| `registerCurrentSource` | زر | تسجيل الملف المحدد | `production.source.register` |
| `refreshSources` | زر | تحديث المصادر | `production.source.list` |
| `sourceList` | قائمة | source IDs وhash وحجم وحالة | metadata فقط |
| `citationList` | قائمة | citations وspans وحالتها | مصدر معروف فقط |
| `contentBrief` | input | ملخص الخطة | bounded |
| `createContentPlan` | زر | معاينة الخطة | لا generation |
| `contentPlanStatus` | حالة | نتيجة الخطة | ready، unresolved، conflicted |
| `contentPlanSections` | قيمة | عدد الأقسام | read-only |
| `contentPlanClaims` | قيمة | عدد claims | read-only |
| `contentPlanSupported` | قيمة | claims المدعومة | read-only |
| `contentPlanUnresolved` | قيمة | claims غير المحسومة | read-only |
| `contentPlanConflicted` | قيمة | claims المتعارضة | read-only |
| `contentPlanClaimList` | قائمة | تفاصيل claims | evidence state |
| `registerDemoAsset` | زر | تسجيل أصل metadata | لا binary |
| `refreshAssets` | زر | تحديث الأصول | `production.asset.list` |
| `assetCatalogStatus` | حالة | حالة الكتالوج | empty، ready، rejected |
| `assetList` | قائمة | asset IDs وlicense وprovenance | metadata فقط |
| `briefTitle` | input | عنوان الـBrief | bounded |
| `briefIntent` | input | الهدف | user input |
| `createCreativeBrief` | زر | إنشاء brief review-only | asset IDs فقط |
| `creativeBriefStatus` | حالة | نتيجة الـBrief | ready، warning، rejected |
| `briefAssetCount` | قيمة | عدد الأصول | read-only |
| `briefWarningCount` | قيمة | عدد التحذيرات | read-only |
| `briefAssetList` | قائمة | روابط الأصول | license state |
| `artifactTitle` | input | عنوان manifest | bounded |
| `createArtifactDraft` | زر | بناء manifest | لا output file |
| `artifactStatus` | حالة | نتيجة المسودة | draft، review_required |
| `artifactReviewState` | قيمة | حالة المراجعة | draft، awaiting، approved |
| `artifactClaimCount` | قيمة | claims | read-only |
| `artifactAssetCount` | قيمة | assets | read-only |
| `artifactSourceCount` | قيمة | sources | read-only |
| `artifactToolCount` | قيمة | tools invoked | غالبًا صفر |
| `artifactManifestList` | قائمة | عناصر manifest | missing، ready |
| `reportTitle` | input | عنوان التقرير | bounded |
| `reportScope` | input | نطاق التقرير | bounded |
| `reportReviewReason` | input | سبب المراجعة | مطلوب عند القرار |
| `createReportDocument` | زر | إنشاء التقرير | `production.report.create` |
| `refreshReportDocuments` | زر | قراءة التقارير | `production.report.list` |
| `approveReportDocument` | زر | قرار محلي | `production.report.review` |
| `reportStatus` | حالة | حالة التقرير | draft، approved، rejected |
| `reportReviewState` | قيمة | المراجعة | read-only |
| `reportClaimCount` | قيمة | claims | read-only |
| `reportEvidenceCount` | قيمة | evidence | read-only |
| `reportSourceCount` | قيمة | sources | read-only |
| `reportRedactionState` | قيمة | redaction | safe، warning |
| `reportClaimList` | قائمة | claims والأدلة | traceable |
| `renderFormat` | select | صيغة السياسة | HTML، Markdown، PDF، PPTX، Image، Video |
| `previewRenderPolicy` | زر | فحص السياسة | `production.render.policy.preview` |
| `renderPolicyStatus` | حالة | نتيجة الفحص | allow، deny، review_required |
| `renderDecision` | قيمة | القرار | read-only |
| `renderAdapter` | قيمة | مسار Osamah | no upstream UI |
| `renderMemoryBudget` | قيمة | ميزانية الذاكرة | low-memory aware |
| `renderExecutionStarted` | قيمة | بدأ التنفيذ | false في المعاينة |
| `renderChecksList` | قائمة | checks | bounded |

## Second Brain

| المعرّف | النوع | الوصف | العقد أو السلوك |
|---|---|---|---|
| `memoryTitle` | input | عنوان entry | bounded |
| `memoryKind` | select | نوع الذاكرة | note، research، decision، learning، idea، task، summary |
| `memoryContent` | textarea | المحتوى | bounded، local |
| `memoryTags` | input | الوسوم | comma-separated |
| `captureMemoryEntry` | زر | التقاط للمراجعة | `brain.memory.capture` |
| `memorySearch` | input | عبارة البحث | lexical |
| `searchMemoryEntries` | زر | بحث محلي | `brain.memory.searchLocal` |
| `memoryReviewReason` | input | سبب القرار | bounded |
| `listMemoryReview` | زر | فتح قائمة المراجعة | `brain.memory.listForReview` |
| `memoryStatus` | حالة | نتيجة الالتقاط أو البحث | empty، ready، rejected |
| `memoryList` | قائمة | entries ونتائج البحث | snippets bounded |
| `memoryReviewList` | قائمة | entries pending | approve، reject، archive |
| `memoryCandidateTitle` | input | عنوان candidate | bounded |
| `memoryCandidateKind` | select | Summary، Fact، Decision، Procedure، Episode | bounded |
| `memoryCandidateContent` | textarea | محتوى candidate | من confirmed entries فقط |
| `memoryCandidateSourceIds` | input | مصادر مؤكدة | known IDs |
| `memoryCandidateScope` | input | النطاق | second-brain أو نطاق محدود |
| `createMemoryCandidate` | زر | إنشاء candidate | `memory-candidate.create` |
| `listMemoryCandidates` | زر | تحديث القائمة | list |
| `memoryConsolidationStatus` | حالة | نتيجة الدمج | review_required، conflict، rejected |
| `memoryCandidateList` | قائمة | candidates | review، active، archived |

## مركز التحكم

| المعرّف | النوع | الوصف | العقد أو السلوك |
|---|---|---|---|
| `controlCenter` | حاوية | إدارة المركز | section active |
| `appLocale` | select | لغة التطبيق | ar، en |
| `appTheme` | select | المظهر | dark، light |
| `appFontScale` | select | حجم النص | 90% إلى 125% |
| `appDensity` | select | الكثافة | comfortable، compact |
| `appReduceMotion` | checkbox | تقليل الحركة | boolean |
| `settingsStatus` | حالة | نتيجة الإعدادات | active، rejected، unavailable |
| `accountProvider` | select | نوع الحساب | GitHub، Google، OAuth، MCP |
| `accountLabel` | input | اسم الحساب | local label |
| `accountOwner` | input | المالك | bounded |
| `accountScopes` | input | scopes | metadata only |
| `accountResourceScope` | input | نطاق الموارد | bounded |
| `registerExternalAccount` | زر | تسجيل metadata | `external.account.register` |
| `externalAccountStatus` | حالة | connected أو disconnected أو consent | لا token |
| `externalAccountList` | قائمة | حسابات metadata | no secrets |
| `storageSettingsStatus` | حالة | قراءة التخزين | memory أو sqlite |
| `storageSettingsList` | قائمة | backend، location، schema، lock، backup، quota | read-only |
| `selfDevelopmentKind` | select | نوع المرشح | instruction، strategy، plan، skill |
| `selfDevelopmentTitle` | input | عنوان المرشح | bounded |
| `selfDevelopmentContent` | textarea | المحتوى | review_required |
| `selfDevelopmentScope` | input | النطاق | bounded |
| `selfDevelopmentSource` | input | المصدر | owner-input أو موثق |
| `createSelfDevelopmentCandidate` | زر | إنشاء مرشح | `self-development.create` |
| `selfDevelopmentStatus` | حالة | نتيجة المرشح | review_required، conflict، rejected |
| `selfDevelopmentList` | قائمة | المرشحات | review، active، archived |
| `refreshAgentCatalog` | زر | تحديث الكتالوج | `agent.catalog.list` |
| `agentCatalogPanel` | لوحة | تعريفات الوكلاء | review-only |
| `agentCatalogStatus` | حالة | حالة الكتالوج | loading، empty، ready |
| `agentCatalogList` | قائمة | role، authority، mission، capabilities | no execution |
| `providerPanel` | لوحة | المزودون | explicit registration |
| `providerEmpty` | حالة | لا مزودين | empty |
| `providerList` | قائمة | الحالة والقدرات والموافقة | no secrets |
| `editorBoundaryPanel` | لوحة | الحدود وdiff وHuman Gate | read-only |
| `editorState` | حالة | وضع المحرر | fixture، proposal only |
| `diffPreview` | منطقة | diff | no mutation |
| `timeline` | سجل | الأحداث | bounded |

## عناصر إدارية مستقبلية يجب توفير مواضعها

حتى إذا كانت capabilities غير منفذة بعد، يجب حجز مواضع مستقلة لها داخل مركز التحكم مع حالة `unavailable` أو `read-only` بدل خلطها مع الإدارة العامة.

| الإدارة | معرفات مقترحة | الحد الأدنى |
|---|---|---|
| الخصوصية والأمان | `privacySecurityPanel`, `privacyDataPolicy`, `secretSafetyPanel`, `privacyHumanGate`, `securityEventsList`, `privacySecurityStatus` | سياسة البيانات، الأسرار، الصلاحيات، Human Gate، سجل أمان |
| الأداء والتشخيص | `performanceDiagnosticsPanel`, `performanceProfile`, `memoryBudget`, `concurrencyLimit`, `previewResourceState`, `cacheState`, `diagnosticEventsList`, `runDiagnostics`, `performanceDiagnosticsStatus` | الذاكرة، التزامن، الكاش، التشخيص الخفيف |
| النسخ والاستعادة | `backupStorage`, `restoreStorage`, `backupStatus`, `restoreStatus` | لا تفعيل قبل عقد وموافقة |
| إدارة الجلسات | `sessionList`, `sessionStatus`, `closeSession` | قائمة جلسات محلية دون raw content |

## شروط اكتمال السجل

يعد السجل مستوفيًا عندما يكون لكل معرف مكوّن مقابل في الشاشة الصحيحة، وحالة ابتدائية، وحالة فارغة، وحالة فشل أو عدم توفر، وإجراء واضح إن كان مسموحًا. أي عنصر بلا عقد تنفيذية يجب أن يكون read-only أو unavailable، ولا يجوز إخفاء هذا القيد عن المستخدم.
