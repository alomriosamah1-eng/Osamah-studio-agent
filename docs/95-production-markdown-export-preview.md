# Production Studio: Markdown Export Preview bounded

**الحالة:** منفذة ومتحقق منها في feature commit `194730e0c5777f8ff50e184345fca1518492c49e`. تضيف هذه الشريحة معاينة Markdown قابلة للتتبع لتقرير `ReportDocument`، وتبقي الكتابة إلى filesystem والتصدير النهائي والنشر خلف مراحل مستقلة ومراجعة بشرية.

## الهدف

تجمع الخدمة عنوان التقرير ونطاقه وحالته والادعاءات والأدلة والافتراضات والقرارات والمخاطر والأسئلة غير المحسومة في نص Markdown محدود. كل claim يحتفظ بحالته `supported` أو `unresolved` أو `conflicted`، ويرتبط بمعرفات evidence وsource وcitation وartifact الموجودة أصلًا. لا تُنشئ الخدمة دليلًا جديدًا ولا تقرأ source spans خامًا ولا تستدعي provider.

> **قاعدة الحقيقة:** `production.report.markdown.preview` معاينة metadata-only. نجاح توليد النص لا يعني أن التقرير صحيح خارجيًا، ولا يعني أنه منشور أو محفوظ في ملف أو جاهز للتوزيع.

| المجال | التنفيذ |
|---|---|
| المصدر | `ReportDocumentPort.get(reportId)` بعد validation التقرير الموجودة |
| الناتج | `MarkdownExportPreview` يحوي `filename` و`markdown` و`characterCount` و`reviewState` و`redactionState` و`warnings` |
| التتبع | evidence IDs وsource IDs وcitation IDs وartifact IDs تظهر نصيًا دون جلب محتوى خارجي |
| redaction | يعتمد على التقرير المنظف مسبقًا، ويحافظ على `redactionState` والتحذيرات |
| الحجم | حد افتراضي أقصى 256 KiB للنص، ومعرف التقرير bounded وsafe filename |
| IPC | `production.report.markdown.preview` خلف typed allowlist وpayload يحوي `reportId` فقط |
| side effects | لا filesystem mutation ولا commands ولا network/provider calls ولا approval ticket |
| review | يسمح بالمعاينة قبل approval، ويضيف `report_review_required_before_publish` ما لم يكن التقرير approved |

## المعمارية ومسار البيانات

تقع الخدمة في Application خلف `MarkdownExportPort`. يربط Composition الخدمة بـ`InMemoryReportDocumentService`، ويعرض Interface Adapter method واحدة عبر typed IPC. لا يعرف renderer مسار profile أو SQLite أو filesystem؛ ولا يحمل serializer أي dependency native أو renderer خارجي.

```text
ReportDocument
     │ get(reportId)
     ▼
MarkdownExportPort.preview
     │ bounded sections + evidence references
     ▼
MarkdownExportPreview
     │ typed IPC: production.report.markdown.preview
     ▼
Workspace review surface / caller
```

يُكتب Markdown من حقول التقرير المنظفة فقط. قسم الأدلة يعرض الحالة والمعرفات، وقسم الادعاءات يعرض نص claim وحالة التحقق وقائمة الأدلة. يضيف الناتج تحذيرًا ثابتًا بأن المعاينة metadata-only وأن factual verification غير implied، ويضيف تحذير review قبل أي publish مستقبلي إذا لم يكن التقرير approved.

## الخصوصية والسلامة

لا تحمل المعاينة source content أو quote spans أو secrets من filesystem. تعتمد على redaction الموجود في `ReportDocument`; لذلك لا ينبغي استدعاؤها قبل إنشاء تقرير يمر عبر validation. لا تغير المعاينة review state ولا evidence state ولا source registry ولا artifact manifest. لا توجد في هذه الشريحة آلية publish أو overwrite أو اختيار destination.

يُرفض `reportId` غير الصالح أو التقرير غير الموجود أو الناتج الذي يتجاوز الحد. ويُرفض payload IPC إذا أضيفت حقول مثل `path` أو `destination`، لأن هذه الحقول ستنقل الشريحة من preview إلى filesystem mutation غير مصرح به.

## الاختبارات ومعايير القبول

تثبت اختبارات Application أن Markdown يحافظ على title وsource/citation references وclaim text والحالات والتحذيرات، وأن contract يعلن عدم الكتابة وعدم command/provider invocation. ويثبت اختبار typed IPC تدفق تقرير traceable إلى approval ثم Markdown preview، مع رفض payload يحوي field زائد. تغطي البوابة أيضًا build وdesktop smoke وperformance smoke وSQLite migration validator وJSON وNode syntax وdiff hygiene وsecret scan.

| معيار القبول | الحالة |
|---|---|
| تقرير traceable ينتج Markdown bounded | متحقق |
| evidence/source/citation IDs محفوظة في النص | متحقق |
| تقرير غير approved يعرض تحذير المراجعة قبل النشر | متحقق |
| redaction وحالة factual verification محفوظتان | متحقق |
| لا كتابة ملفات أو تنفيذ أو network/provider side effects | متحقق |
| typed IPC allowlist وreject extra payload fields | متحقق |
| حد 256 KiB وعدم تخطي الذاكرة | متحقق |
| لا PDF/PPTX/media render أو publish في هذه الشريحة | متحقق |

## الأداء والتشغيل

المعاينة pure bounded transformation على تقرير in-memory؛ لا تضيف worker أو process أو startup load. الحد الافتراضي 256 KiB يضمن عدم إنشاء artifact نصي غير محدود. عند إضافة كتابة ملفات مستقبلًا يجب إنشاء port منفصل يمر عبر destination policy وHuman Gate وatomic write وmanifest/hash، مع إبقاء preview الحالية بلا mutation.

## بوابة التحقق

نجحت البوابة في 2026-08-22 مع `pnpm check` بـ`209/209`، و`pnpm build`، و`pnpm desktop:smoke`، و`pnpm performance:smoke`. بقي SQLite عند `MIGRATION_COUNT=6` و`SCHEMA_VERSION=006` و`TABLE_COUNT=14` و`INDEX_COUNT=30`. نجحت كذلك JSON validation وNode syntax و`git diff --check` وhigh-confidence secret scan. سجل البوابة محفوظ في [research/markdown-export-full-gate-output-2026-08-22.txt](../research/markdown-export-full-gate-output-2026-08-22.txt).

## ما يلي هذه الشريحة

المرحلة التالية هي تقييم كتابة Markdown إلى destination آمن فقط إذا ظهر احتياج فعلي، ثم PDF/HTML/PPTX render workers خلف policy وHuman Gate. لا تبدأ embeddings أو vector services أو provider sharing أو Avatar runtime بسبب هذه الشريحة. تبقى دراسة Virtual Human / AI Avatar موثقة ومؤجلة.

إعداد: Manus AI. تاريخ التحديث: 2026-08-22.

## مراجع داخلية

[1]: ../src/application/report-document.ts "ReportDocument validation and review"
[2]: ../src/application/markdown-export.ts "Bounded Markdown export preview service"
[3]: ../src/ipc/contracts.ts "Typed IPC contracts and validators"
[4]: ../src/ipc/embedded-handlers.ts "Embedded report Markdown handler"
[5]: ../src/report-document.test.ts "Application Markdown preview tests"
[6]: ../src/ipc.test.ts "Typed IPC Markdown preview test"
[7]: ../research/markdown-export-full-gate-output-2026-08-22.txt "Markdown export full gate output"
