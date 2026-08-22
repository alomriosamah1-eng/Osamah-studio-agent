# Production Studio: Markdown destination review وكتابة آمنة

**الحالة:** منفذة ومتحقق منها في feature commit `1de463fadd188373eef2bc418f6a6ab6f6d7fa2a`. هذه الشريحة منفصلة عن `docs/95-production-markdown-export-preview.md`: المعاينة تبقى pure وmetadata-only، بينما الكتابة mutation محلي محدود يحتاج موافقة التقرير وHuman Gate مستقلًا.

## القرار والنطاق

تسمح الشريحة بكتابة Markdown فقط إلى `markdownDestinationRoot` اختياري يضبطه host-side composition. لا يقبل renderer أو IPC مسارًا مطلقًا؛ يقبل `relativePath` نسبيًا وينتهي بـ`.md`. تُنشأ الوثيقة في المسار النسبي المطلوب، ويُنشأ بجانبها manifest نسبي باللاحقة `.manifest.json` يحوي hash وbytes وreview/redaction state والتحذيرات.

> **قاعدة الحقيقة:** نجاح `production.report.markdown.write` يعني أن artifact Markdown محلي كُتب وفق policy، ولا يعني أن التقرير تحقق خارجيًا أو نُشر أو تحوّل إلى PDF/HTML/PPTX.

| المجال | العقد المنفذ |
|---|---|
| المصدر | `MarkdownExportPort.preview(reportId)`؛ لا تُعاد صياغة محتوى مستقل ولا يُجلب source خارجي |
| IPC | `production.report.markdown.write` مع `reportId` و`relativePath` و`approvalId` اختياريًا |
| Application | `MarkdownDestinationService` يفحص report approval، ثم يطلب `filesystem.write` approval المطابق قبل استدعاء port |
| Infrastructure | `LocalMarkdownDestinationWriter` يكتب داخل root مهيأ host-side فقط |
| الناتج | `MarkdownDestinationManifest` مع `relativePath` و`manifestRelativePath` و`sha256` و`bytes` وwarnings |
| الصيغ | Markdown فقط؛ لا PDF/HTML/PPTX/media render أو converter |
| provider/network | لا provider calls ولا network ولا commands |
| startup | root اختياري؛ لا filesystem write أو provider/model loading عند إنشاء التطبيق |

## مسار الموافقة

يُرفض التقرير الذي ليس في `reviewState=approved` قبل إنشاء Human Gate. هذا approval محلي للتقرير ولا يساوي factual verification. بعد ذلك يستدعي Application `AgentAuthorizationPort` بفعل `filesystem.write` ثابت، وscope يضم `reportId` و`relativePath` وidempotency key. الطلب الأول يعيد `approval_required` ويظهر في قائمة Human Gate. لا تبدأ الكتابة إلا عند إعادة الطلب بـ`approvalId` الموافق لتطابق action كاملة؛ التذكرة denied أو mismatched تُرفض fail-closed.

هذا الفصل يمنع أن تتحول معاينة Markdown أو موافقة التقرير إلى إذن ضمني لكتابة ملف. كما أن `production.report.markdown.write` لا ينشئ approval ticket إذا كان التقرير غير approved، ولا يرسل المحتوى إلى provider، ولا يغير review state.

## destination policy

يُقبل root مطلق آمن ومحدد خارج live profile. إذا كان التطبيق يعمل بـ`sqlite-profile`، يرفض writer أن يكون destination داخل profile أو أن يحتوي profile داخل destination. يرفض root الجذر `/`، وroot غير المطلق، وroot الرمزي الموجود مسبقًا. تُرفض `relativePath` إذا كانت مطلقة أو تبدأ بـ`~` أو تحتوي backslash أو NUL أو `:` أو segments فارغة/`.`/`..` أو لا تنتهي بـ`.md`.

يتحقق writer من أن المسارين النهائيين للـartifact والـmanifest داخل destination root، ويفحص parent directories الموجودة كي لا تمر symlink. لا يُستخدم أي path صادر من renderer أو من provider؛ المسار الوحيد يأتي من typed IPC ثم يمر validation في IPC وApplication وInfrastructure.

| الحالة | النتيجة |
|---|---|
| report غير موجود أو غير approved | رفض قبل Human Gate والكتابة |
| relative path مطلق أو traversal أو غير Markdown | `INVALID_REQUEST` في IPC أو policy error في Application |
| destination root غير آمن أو متداخل مع live profile | رفض إنشاء writer أو `DOMAIN_ERROR` |
| approval غير موجود/غير مطابق/denied | رفض الكتابة |
| artifact أو manifest موجود مسبقًا | رفض؛ `overwritten=false` دائمًا |
| فشل كتابة manifest بعد كتابة artifact | محاولة حذف artifact الذي أنشأه الطلب فقط ثم rethrow؛ لا حذف لملف متزامن لم ينشئه الطلب |
| PDF/HTML/PPTX أو converter | خارج الشريحة ومرفوض عبر العقد |

## atomic output وmanifest

يكتب writer كل ملف مؤقتًا باسم فريد باستخدام `flag=wx`، ثم ينشره عبر hard link ذري إلى المسار النهائي، ثم يحذف المؤقت. هذا يحقق no-overwrite على مستوى العملية أيضًا، وليس فقط عبر فحص مسبق. يُنشأ artifact أولًا ثم manifest؛ إذا فشل manifest بعد نجاح artifact، يُنظف artifact الذي كتبه الطلب وتفشل العملية بدل ترك ملف ناقص مكتملًا. لا تدعي الشريحة crash-durability أو directory fsync؛ تلك مراجعة مستقلة مطلوبة إذا أصبح التوزيع الإنتاجي بحاجة إليها.

يُحسب `sha256` من محتوى Markdown UTF-8، وتُحسب `bytes` من UTF-8 أيضًا. يحتفظ manifest بتحذيرات المعاينة وحالة redaction وreview، وبذلك تبقى traceability موجودة بعد الكتابة دون إدخال source spans خامة أو أسرار أو محتوى خارجي. وجود manifest لا يجعل citation verified ولا يثبت صحة التقرير.

## الحدود الأمنية والخصوصية

الـdestination root لا يُمرر إلى renderer ولا يُكشف عبر IPC؛ يُحقن في main/composition فقط. لا تكتب الشريحة في live profile ولا تسمح بالـoverwrite. لا توجد آلية delete أو replace أو publish أو upload أو external notification. لا تضع raw user files أو secrets أو model weights في Git أو logs؛ محتوى الاختبارات synthetic ومحدود.

الكتابة تغيّر filesystem ولذلك تظل خلف Human Gate. أما preview في docs/95 فتبقى بلا mutation. `approvalId` لا يمنح صلاحية عامة لمسار آخر، لأن action matching يشمل report والrelativePath وidempotency key. لا تعتبر هذه السياسة authentication أو authorization متعدد المستأجرين؛ هي guard محلي bounded فوق عقد الموافقة الموجود.

## الاختبارات ومعايير القبول

تغطي اختبارات Application منع الكتابة قبل تقرير approved، وإرجاع `approval_required`، والكتابة بعد approval المطابق فقط. وتغطي اختبارات Infrastructure إنشاء Markdown وmanifest، وتطابق SHA وUTF-8 byte count، ورفض overwrite وtraversal والمسار المطلق وتداخل live profile. ويثبت اختبار IPC إنشاء `filesystem.write` ticket، ثم approval، ثم الكتابة داخل root معزول، ورفض الحقول الزائدة والمسار المتجاوز.

| معيار القبول | الحالة |
|---|---|
| preview منفصل عن output write | متحقق؛ port وخدمة وIPC method مستقلون |
| report review approval مطلوب | متحقق؛ التقرير غير approved يُرفض قبل Human Gate |
| Human Gate مطلوب للفعل الحساس | متحقق؛ action هي `filesystem.write` وتطابق path/report |
| relative safe destination | متحقق عبر exact-key IPC وApplication/Infrastructure guards |
| live-profile guard | متحقق عبر root separation عند إنشاء writer |
| no overwrite | متحقق مسبقًا وبـ`wx`/hard-link publication، وmanifest يثبت `overwritten=false` |
| atomic bounded output | متحقق مؤقتًا ثم hard link مع cleanup عند الفشل؛ لا crash durability claim |
| manifest/hash/traceability | متحقق؛ `sha256` و`bytes` وstates وwarnings |
| provider/network/command isolation | متحقق؛ لا calls أو renderer أو converter |
| PDF/HTML/PPTX | غير منفذة ومرفوضة في هذا العقد |

## التحقق والأداء

نجحت البوابة بعد feature التنفيذ بـ`213/213` اختبارًا، و`pnpm build`، و`pnpm desktop:smoke`، و`pnpm performance:smoke`، وSQLite validator (`MIGRATION_COUNT=6`, `SCHEMA_VERSION=006`, `TABLE_COUNT=14`, `INDEX_COUNT=30`)، إضافة إلى JSON validation وNode syntax و`git diff --check` وsecret scan. سجل البوابة محفوظ في [research/markdown-destination-full-gate-output-2026-08-23.txt](../research/markdown-destination-full-gate-output-2026-08-23.txt).

لا يضيف المسار model أو network أو process عند startup. الكتابة محدودة إلى 256 KiB للمحتوى، وpath محدود إلى 512 حرفًا، وwarnings إلى 64 عنصرًا؛ لذلك لا تفتح الشريحة unbounded output أو worker دائمًا. يظل destination root اختياريًا، وإذا لم يُضبط فلا توجد كتابة صامتة.

## ما يلي هذه الشريحة

تتابع الخطة، عند وجود حاجة فعلية، مراجعة render workers وformat validators وPDF/HTML/PPTX خلف process isolation وpolicy وHuman Gate. لا تُضاف FTS migration أو embeddings أو vector services أو provider sharing بهذه الشريحة، ولا يبدأ Voice أو Avatar runtime. تبقى دراسة Virtual Human / AI Avatar في docs `84–86` توثيقية ومؤجلة بقرار مالك مستقل.

إعداد: Manus AI. تاريخ التحديث: 2026-08-23.

## مراجع داخلية

[1]: ./95-production-markdown-export-preview.md "Markdown export preview bounded"
[2]: ../src/application/markdown-destination.ts "Application Markdown destination service"
[3]: ../src/infrastructure/markdown-destination.ts "Local Markdown destination writer"
[4]: ../src/ipc/contracts.ts "Typed IPC contracts and validators"
[5]: ../src/ipc/embedded-handlers.ts "Embedded Markdown destination handler"
[6]: ../src/composition.ts "Opt-in destination root composition"
[7]: ../src/markdown-destination.test.ts "Application and Infrastructure destination tests"
[8]: ../src/ipc.test.ts "Typed IPC destination write test"
[9]: ../research/markdown-destination-full-gate-output-2026-08-23.txt "Markdown destination full gate output"
