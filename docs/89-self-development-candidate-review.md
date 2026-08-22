# Self-development Candidate Review وRule Overlay

## الحالة

أُغلقت هذه الشريحة كمسار محلي bounded داخل Control Center. تستقبل توجيهًا أو استراتيجية أو مخططًا أو وصف مهارة، وتضعه في `review_required` قبل أي استخدام. لا ينفذ النظام النص، ولا يرفع `providerAccess`، ولا يمنح صلاحيات، ولا ينشئ `ToolManifest`، ولا يعيد كتابة core policy أو Security Boundary.

## النموذج والدورة

| العنصر | القرار المنفذ |
|---|---|
| الأنواع | `instruction`، `strategy`، `plan`، `skill` |
| الحالة الأولية | `review_required` |
| الحالة بعد القرار | `active` أو `archived` |
| التراجع | `rollback` يحوّل overlay النشط إلى `archived`؛ لا يدّعي استعادة نسخة تاريخية غير موجودة بعد |
| الخصوصية | `visibility=private` و`providerAccess=never` و`retention=until_deleted` |
| المصدر | `user_submitted` افتراضيًا مع `source` و`scope` bounded |
| المحتوى | redaction للنصوص ذات الشكل السري، وحد أقصى 8,000 حرف |
| التعارضات | كشف محافظ لتجاوز approval/Human Gate/security، طلب امتيازات عامة، تنفيذ أدوات، أو محتوى سري الشكل |
| التفعيل | لا يتم إلا بقرار `activate` صريح وبلا تعارضات |
| التأثير | overlay قابل للإزالة على `second_brain` و`agent_context`؛ capability/provider/Human Gate changes = none |

الدورة هي: `create → review_required → preview → explicit review → active|archived`. التفعيل ليس تحققًا خارجيًا من الحقيقة، ولا يحول المحتوى إلى تعليمات تنفيذية. يظل الفرق قائمًا بين `user_submitted` و`local_parse` و`agent_suggestion`، وبين التأكيد المحلي والتحقق الخارجي الذي لم يُنفذ في هذه الشريحة.

## العقود المنفذة

| السطح | العقد |
|---|---|
| Application | `SelfDevelopmentCandidate` و`SelfDevelopmentCandidatePort` و`InMemorySelfDevelopmentCandidateService` |
| Create | `self-development.create` |
| Read | `self-development.get` و`self-development.list` و`self-development.active` |
| Preview | `self-development.preview` يعرض canActivate وaffectedAreas وغياب تغييرات الصلاحيات والتنفيذ |
| Review | `self-development.review` بقرارات `activate` و`archive` و`rollback` وسبب bounded |
| IPC policy | exact-key وfail-closed validators؛ details محددة الحقول والقوائم |
| UI | إدخال نوع/عنوان/محتوى/scope/source، قائمة المرشحات، أزرار تفعيل/أرشفة/إزالة overlay |

المحتوى المعروض في Workspace يمر عبر `textContent` وDOM nodes آمنة. لا يوجد `innerHTML` من بيانات المرشح، ولا يوجد event يمنح المرشح tool أو provider أو filesystem authority. تظل Agent Runtime وHuman Gate مصدر السلطة الوحيد للأفعال الحساسة.

## التعارض والـRule Overlay

التعارضات الحالية guardrails حتمية ومحدودة وليست semantic safety proof. إذا احتوى النص على نمط يطلب تجاوز approval أو security، أو تشغيل shell/terminal/tool، أو منح صلاحيات غير مقيدة، أو يحتوي secret-shaped assignment، يبقى المرشح `review_required` ويُحظر تفعيله. يمكن أرشفة المرشح المتعارض، لكن لا يمكن تفعيله حتى يُنشأ مرشح جديد نظيف.

عند تفعيل مرشح نظيف، لا يُدمج مع القواعد الأساسية كتابةً. يعرض المستقبل overlay في context packet مع scope/version/provenance، ويجب أن يظل قابلاً للإزالة. هذه الشريحة لا تنفذ بعد حقن overlay داخل Agent Runtime؛ `agent_context` هنا مجال التأثير الموصوف في preview فقط، وليس تصريحًا بأن runtime يستهلك المرشح النشط.

## الخصوصية والأمان

لا تحفظ الخدمة الحالية في SQLite أو ملف أو log دائم، ولا تتصل بشبكة أو provider. لا يسمح العقد بحقل `token` أو حقول زائدة. تُحذف NUL وتُقص النصوص والقوائم bounded، ويُطبق redaction قبل حفظ المرشح في الذاكرة. لا تُقرأ تعليمات داخل المرشح كتعليمات نظام، ولا تُتبع prompt injection داخل المحتوى.

تظل `active` حالة معرفة محلية قابلة للإزالة، وليست تفويضًا. لا يغير المرشح صلاحيات الحسابات الخارجية أو storage policy أو Avatar/voice/microphone أو Human Gate. persistence وaudit الدائم وversion diff وsemantic conflict analysis وexternal verification مراحل لاحقة.

## الاختبارات والبوابة

تغطي الاختبارات Application وIPC إنشاء المرشح الخاص في `review_required`، redaction والحدود، preview، منع تفعيل التعارض، التفعيل الصريح، archive وrollback، رفض الحقول السرية والحمولات غير الصالحة، وعدم تغيير provider access أو execution authority. يغطي desktop smoke مسار create/preview/review ورفض payload يحتوي `token`.

نجحت البوابة في 2026-08-22: `pnpm check` بـ`195/195`، و`pnpm build`، و`pnpm desktop:smoke`، و`pnpm performance:smoke`، وSQLite migration/JSON/diff/secret validation. هذه النتائج تقيس الشريحة الحالية والمسارات القائمة؛ لا تعني وجود semantic self-improvement أو autonomous skill execution.

## الملفات والحدود

| الملف | الدور |
|---|---|
| `src/application/self-development.ts` | النموذج والخدمة والـpreview والـreview |
| `src/self-development.test.ts` | اختبارات الحالة والـredaction والـconflicts |
| `src/ipc/contracts.ts` | methods وvalidators |
| `src/ipc/embedded-handlers.ts` | handlers المحلية |
| `src/composition.ts` | in-memory wiring |
| `src/ipc.test.ts` | اختبار IPC ورفض secret-shaped fields |
| `prototypes/studio/index.html` | نموذج Control Center |
| `prototypes/studio/workspace.js` | عرض المرشحات وأزرار المراجعة والـsmoke |

تبقى **persistence، SQLite migration، memory consolidation، embeddings، external verification، automatic rule editing، autonomous skill execution، provider sharing، وremote synchronization** خارج النطاق. كما يبقى Virtual Human / AI Avatar موثقًا ومؤجلًا إلى مرحلته المخططة، ولا يتأثر بهذه الشريحة.

إعداد: Manus AI. تاريخ التنفيذ: 2026-08-22.
