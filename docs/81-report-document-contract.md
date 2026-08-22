# ReportDocument Contract وBounded Reporting Preview

## القرار

أضيف `ReportDocument` كطبقة Application bounded فوق `ContentPlan` و`SourceRegistry` و`ArtifactAssembly`. الغرض هو إنشاء مسودة تقرير محلية قابلة للتتبع والمراجعة، لا إنشاء ملف نهائي أو نشره. يعتمد العقد على بيانات معروفة داخل التطبيق، ويمنع تحويل claim غير المدعوم إلى حقيقة.

> **قاعدة التتبع:** كل claim في التقرير يكون `supported` أو `unresolved` أو `conflicted` بناءً على evidence مرتبطة بمصدر أو citation أو artifact معروف. المراجعة المحلية لا تعني تحققًا خارجيًا.

## مكونات العقد

| المكون | المحتوى | قاعدة القبول |
|---|---|---|
| الهوية | `reportId`, `kind`, `title`, `scope`, `generatedAt`, `author` | IDs ونصوص bounded، و`kind` من allowlist ثابتة |
| inputs | plan IDs وartifact IDs ومدخلات نصية محدودة | لا يقرأ التقرير filesystem أو network تلقائيًا |
| evidence | label مع `sourceId` أو `citationId` أو `artifactId` | كل reference يجب أن يكون معروفًا في registry المناسب |
| claims | نص claim و`evidenceIds` وحالة التحقق والتحذيرات | غياب الدليل unresolved، والدليل invalid conflicted |
| السياق | assumptions وdecisions وrisks وunresolvedQuestions | نصوص محدودة ومنقحة من أشكال الأسرار الشائعة |
| المراجعة | `review_required`, `approved`, `blocked` مع reason/time | approve يتطلب claims مدعومة، وblock لا ينشئ artifact نهائيًا |
| provenance | `sourceRefs` و`artifactRefs` | مشتقة deterministic من evidence وContent Plan وArtifact Manifest |
| الخصوصية | `redactionState` وwarnings | يبقى provider access خارج المسار ولا يوجد external verification |

## حدود التنفيذ

تنفذ `InMemoryReportDocumentService` خلف `ReportDocumentPort`. تربط الخدمة Content Plan اختياريًا، وتحوّل citations المعروفة إلى evidence، وتستخرج claims من الخطة، وتضمّن مصدر artifact المعروف دون قراءة locator أو كتابة output. حدود الخدمة هي 64 تقريرًا، و256 evidence، و128 claim، و32 قيمة لكل قائمة سياقية، و64 تحذيرًا.

تتعامل الخدمة مع source/citation verification كالآتي: المصدر أو citation في حالة `invalid` ينتج evidence وclaim متعارضين؛ الحالة `unverified` تبقى قابلة للعرض مع warning ولا تُعرض كتحقق خارجي؛ والحالة `content_validated` تسمح بـ` supported` داخل نطاق الأدلة المحلية. عند وجود claim unresolved أو conflicted لا يسمح مسار `approve` بالتقدم.

## IPC وWorkspace

أضيفت المسارات التالية إلى protocol v1:

| method | payload | الوظيفة | التأثير |
|---|---|---|---|
| `production.report.create` | `CreateReportDocumentRequest` | إنشاء مسودة تقرير | in-memory فقط |
| `production.report.get` | `{ reportId }` | استعادة مسودة واحدة | read-only |
| `production.report.list` | `{ limit? }` | عرض أحدث المسودات bounded | read-only |
| `production.report.review` | `{ reportId, decision, reason }` | approve محلي أو block | لا export ولا publish |

تستخدم validators exact-key وallowlist للـkind والقوائم والأدلة والـreview decision. تعرض لوحة Workspace حالة التقرير وعدد claims والأدلة والمصادر وredaction، وتعرض claim text عبر `textContent`. زر `Approve locally` يحتاج سببًا واضحًا ويضيف `user_approved_not_externally_verified`.

## ما لم يُنفذ

لا توجد Markdown/PDF generation، ولا converter أو renderer، ولا output file، ولا remote publication، ولا provider generation، ولا Documentation Agent مستقل، ولا persistence جديدة أو FTS أو embeddings. انتقال ReportDocument إلى artifact render أو export يحتاج شريحة مستقلة مع policy وHuman Gate وevidence إضافية.

## التحقق

تغطي الاختبارات إنشاء تقرير مدعوم، claim بلا evidence، evidence invalid، الاشتقاق من Content Plan، redaction، الحدود، المراجعة، IPC malformed payload، وElectron desktop smoke. تظل `reportDocumentContract.factualVerificationIsNotImplied=true` قاعدة صريحة.

**Feature implementation:** `ReportDocument` وtyped IPC وWorkspace integration؛ feature `24144c4f2495354b5d2d8a5a880192dc251173ff` دُفع وتحقق تطابقه مع `origin/main`. **Docs-close:** commit توثيقي مستقل لهذه التسليمة، ويُعلن SHA بعد دفعه والتحقق من GitHub.
