# منظومة وثائق Osamah Studio Agent

هذه المجلدات هي **مصدر الحقيقة الهندسي** لمشروع Osamah Studio Agent. التقرير التنفيذي النهائي موجود في `FINAL_REPORT.md`. المشروع تجاوز Discovery إلى Foundation وEmbedded Simulator وProject Preview وPresentation Renderer وIPC Project Open؛ لذلك تميّز الوثائق بين الحقائق المثبتة والقرارات المقترحة والافتراضات غير المحسومة.

## خريطة الوثائق

| الملف | الغرض |
|---|---|
| `00-project-overview.md` | تعريف المشروع وحدوده ومفرداته ومصادر الحقيقة |
| `01-executive-summary.md` | خلاصة القرار التنفيذي والجدوى والـ MVP |
| `02-feasibility-study.md` | الجدوى التقنية والتشغيلية والاقتصادية والقانونية والأمنية |
| `03-product-requirements.md` | متطلبات المنتج والمستخدمين ونطاق البيئات الثلاث |
| `04-functional-requirements.md` | المتطلبات الوظيفية المرقمة ومعايير القبول |
| `05-non-functional-requirements.md` | الأداء والأمن والاعتمادية والتوافق وإمكانية الوصول |
| `06-system-architecture.md` | المعمارية العليا وحدود العمليات ومسارات البيانات |
| `07-ai-agent-architecture.md` | تنظيم الوكلاء والتفويض والتحقق والموافقات |
| `08-open-source-landscape.md` | مشهد المكونات المفتوحة وتصنيف الاستخدام |
| `09-frontend-architecture.md` | طبقات الواجهة، الحالة، اللوحات، وcommand palette |
| `10-backend-architecture.md` | النواة، الخدمات، الطوابير، وواجهات IPC/API |
| `11-data-architecture.md` | SQLite والملفات والفهرسة والمتجهات والسجلات |
| `12-ux-ui-analysis.md` | مبادئ UX/UI الأصلية دون نسخ تصميمات مملوكة |
| `13-voice-system.md` | STT/TTS/VAD والصوت العربي والعمل المحلي |
| `14-provider-routing.md` | registry والتوجيه والـ fallback والقياس الاقتصادي |
| `15-memory-system.md` | طبقات الذاكرة والاسترجاع والخصوصية والنسيان |
| `16-automation-system.md` | الأتمتة والجدولة ودرجات الاستقلال والموافقات |
| `17-security-model.md` | نموذج التهديدات والصلاحيات والعزل وسلامة MCP |
| `18-performance-engineering.md` | أهداف القياس والعمليات والضغط والموارد |
| `19-devops-and-ci-cd.md` | دورة التطوير والبناء والتوزيع والمراقبة |
| `20-github-actions.md` | تصميم workflows للأنظمة والاختبارات والإصدارات |
| `21-open-to-integration.md` | ما ثبت وما لم يثبت عن OpenTo وخطة adapter |
| `22-second-brain.md` | نموذج المعرفة والملاحظات والمشاريع والبحث |
| `23-production-studio.md` | العروض والمستندات والصور والفيديو والتصدير |
| `24-smart-development-environment.md` | بيئة التطوير الذكية ومسارات Git وterminal |
| `25-project-roadmap.md` | مراحل 0–12، الاعتماديات، والمخرجات ومعايير القبول |
| `26-risk-register.md` | سجل المخاطر والمالكون والإجراءات البديلة |
| `27-technology-decision-records.md` | القرارات الموزونة والبدائل المرفوضة |
| `28-open-source-license-audit.md` | تدقيق التراخيص وإشارات المراجعة القانونية |
| `29-research-sources.md` | المصادر الأولية والثانوية وتاريخ الفحص |
| `30-ai-agent-handoff.md` | بروتوكول تسليم العمل لوكيل أو مهندس لاحق |
| `32-traceability-matrix.md` | ربط المتطلبات بالميزات والمعمارية والتقنية والاختبارات |
| `33`–`44` | معمارية وتنفيذ Mobile Preview وEmbedded Simulator وRenderer وIPC Project Open |
| `45-master-implementation-plan.md` | الخطة التنفيذية الشاملة للأقسام الثلاثة والمراحل والتكاملات وإعادة استخدام المصادر المفتوحة |
| `46-electron-shell-and-preload-implementation.md` | تنفيذ Electron shell وtyped preload وCSP وdesktop smoke |
| `76-comprehensive-project-audit-2026-08-22.md` | تدقيق شامل للمستودع والوكلاء ودورة lifecycle والتكاملات والفجوات |
| `77-agent-organization-architecture.md` | عقد Agent Definition والهيكل التنظيمي والـhandoff والـquality gates |
| `78-preview-browser-integrations-architecture.md` | Preview Sharing وPlaywright وOAuth/Google وMCP وحدود الأمان |
| `79-documentation-traceability-reporting.md` | taxonomy التوثيق وخريطة التتبع وReportDocument وhandoff |
| `80-agent-definition-contract-catalog.md` | عقد تعريف الوكيل والكتالوج bounded وحالات التنفيذ والحدود |
| `81-report-document-contract.md` | عقد التقرير المحلي وprovenance وclaims والمراجعة وحدود عدم التصدير |
| `82-application-settings-control-center.md` | عقد إعدادات التطبيق واللغة والمظهر ومركز التحكم والإدارات |
| `83-control-center-external-storage-self-development.md` | إدارة الحسابات الخارجية والتخزين والتطوير الذاتي وقواعد consent وHuman Gate |
| `84-virtual-human-research-and-comparison.md` | البحث الحديث والمقارنة وTop-5 scoring لنظام Virtual Human / AI Avatar |
| `85-virtual-human-architecture-and-contracts.md` | المعمارية المقترحة، state machine، العقود، الخصوصية، الأداء، والـOverlay |
| `86-virtual-human-licensing-roadmap-and-decisions.md` | License Matrix وDecision Log وخارطة Avatar المستقبلية 0–11 |
| `87-external-accounts-metadata-only.md` | تنفيذ metadata-only للحسابات الخارجية دون OAuth أو network أو secrets |
| `88-storage-settings-read-only.md` | عرض حالة التخزين والسياسة فقط دون نقل أو حذف أو backup أو restore |
| `89-self-development-candidate-review.md` | Candidate Review وRule Overlay bounded دون تنفيذ المحتوى أو رفع الصلاحيات |
| `90-memory-consolidation-bounded.md` | Memory Candidate وConsolidation Review من مصادر مؤكدة دون embeddings أو provider sharing |
| `91-memory-persistence-sqlite.md` | persistence اختيارية ومحدودة لـMemoryEntry وMemoryCandidate عبر SQLite profile وmigration 005، دون FTS أو embeddings أو provider sharing |
| `92-memory-local-retrieval-bounded.md` | local lexical retrieval عربي/إنجليزي bounded، مع visibility filter وتأجيل FTS5 بعد فشل توفره في runtime الحالي |
| `93-memory-relational-links-bounded.md` | روابط MemoryEntry الموجهة وmigration 006 وحدود visibility وfail-closed hydration دون graph أو semantic service |
| `94-memory-agent-scope-bounded.md` | agent scope filtering محلي فوق retrieval باستخدام AgentCatalog، مع حدود visibility وretention وproviderAccess ودون authorization كامل |
| `95-production-markdown-export-preview.md` | Markdown export preview bounded لتقارير Production Studio مع evidence traceability ودون كتابة ملفات أو publish |
| `96-semantic-memory-deferred-decision.md` | قرار تصميمي مؤجل لـsemantic memory وFTS5 وembeddings وvector services، مع شروط فتح المرحلة دون تنفيذها |
| `97-production-markdown-destination-review.md` | destination review/ write الآمنة لـMarkdown مع relative-path/live-profile/no-overwrite/manifest guards وreport review وHuman Gate |
| `98-open-source-integration-and-migration-plan.md` | خطة دمج المشاريع مفتوحة المصدر فعليًا عبر dependencies وSDKs وworkers وadapters، مع ترحيل OpenCode وDeepSeek وHermes وواجهة fallback |
| `99-unified-ui-and-capability-deduplication.md` | قاعدة الواجهة الموحدة الخاصة بـOsamah، وownership واحد لكل قدرة، ومنع تسريب upstream UI أو تكرار agent loops/renderers |
| `100-deepseek-harness-bridge-decision.md` | قرار إبقاء DeepSeek Harness كمرشح plugin/event spine مؤجلًا، ومنع agent loop ثالث أو dependency graph مكرر قبل بوابة توافق مستقلة |

## ملفات الحالة خارج هذا المجلد

توجد `PROJECT_STATUS.md` للحالة المستمرة، و`PROJECT_CONTEXT.md` للسياق الثابت، و`ARCHITECTURE_DECISIONS.md` للقرارات، و`CONTRIBUTING.md` لقواعد المساهمة، و`CHANGELOG.md` للتغييرات. أما البيانات الآلية فتوجد في `project/`.

## قواعد القراءة

ابدأ بـ `00-project-overview.md` ثم `01-executive-summary.md`، وبعدها انتقل إلى وثائق المعمارية والقرارات. استخدم `29-research-sources.md` للتحقق من أي ادعاء خارجي. لا تحوّل أي **HYPOTHESIS** إلى **VERIFIED FACT** دون اختبار أو مصدر أولي جديد.

## بروتوكول تحديث مختصر

عند اكتشاف معلومة جديدة، سجّل المصدر وتاريخ الفحص وتصنيف الثقة، ثم حدّث الوثيقة المتأثرة وملف الحالة وملف البيانات إن كان القرار قابلًا للآلة. عند تغيير قرار معماري، أضف ADR لا تعدّل التاريخ بصمت. وثائق Avatar 84–86 دراسة مؤجلة فقط ولا تمنح إذنًا لتعديل runtime أو تثبيت حزم. قبل الدفع، شغّل تدقيق الروابط و`git diff --check` وتحقق من عدم وجود أسرار.

إعداد: Manus AI.
