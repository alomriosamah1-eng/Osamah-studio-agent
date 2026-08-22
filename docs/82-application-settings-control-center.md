# إعدادات التطبيق ومركز التحكم

## القرار العام

يُعتمد التطبيق باللغة العربية افتراضيًا، مع إمكانية التبديل إلى الإنجليزية من إعدادات التطبيق. تُحفظ تفضيلات العرض محليًا خلف عقد typed، ولا يقرأ renderer ملفات الإعدادات أو قاعدة البيانات مباشرة. يبدأ التنفيذ بعقد in-memory bounded، ثم يمكن ربطه بالتخزين الدائم في شريحة مستقلة بعد تثبيت migration وbackup وprivacy gates.

## إعدادات اللغة والاتجاه

| الإعداد | القيم | الافتراضي | السلوك |
|---|---|---|---|
| `locale` | `ar` أو `en` | `ar` | يختار resource bundle ويحدث النصوص المترجمة |
| `direction` | مشتق من اللغة | `rtl` | يطبق `dir=rtl` للعناصر العامة و`dir=ltr` للكود والمسارات والأوامر |
| `numberFormat` | `locale` أو `stable` | `locale` | يعرض الأرقام حسب اللغة أو بصيغة ثابتة في logs/diffs |
| `mixedContentPolicy` | ثابتة | `code/paths/terminal=ltr` | تمنع قلب أسطر الكود وGit diff وterminal عند تغيير لغة الواجهة |

لا تُترجم قيم البروتوكول أو IDs أو أسماء الملفات أو أوامر الطرفية. الترجمة تخص labels وhelp text وempty/error states. أي نص قادم من المشروع أو provider أو user يُعامل كبيانات ويُعرض عبر DOM text APIs؛ لا يُعتبر مصدرًا للترجمة أو للتعليمات.

## المظهر وقابلية القراءة

| الإعداد | القيم المحدودة | الافتراضي | بوابة القبول |
|---|---|---|---|
| `theme` | `light` أو `dark` | `dark` للحفاظ على Workspace الحالي | contrast وfocus ring وحالة disabled في الوضعين |
| `fontScale` | 0.9 إلى 1.25 بخطوة 0.05 | `1.0` | لا يكسر الأزرار أو الجداول عند 125% |
| `density` | `comfortable` أو `compact` | `comfortable` | القوائم الطويلة تبقى قابلة للقراءة ولا تختفي approval cards |
| `reduceMotion` | boolean | `false` | لا تعتمد حالة العمل على animation فقط |

يستخدم CSS logical properties مثل `margin-inline` و`padding-inline` بدل إحداثيات يسارية ثابتة. يظل code editor وterminal وdiff في LTR حتى داخل واجهة عربية، بينما يتغير ترتيب اللوحات والتنقل العام حسب الاتجاه. لا يُضمَّن خط جديد أو asset غير موثق؛ يستخدم النظام fallback عربي/لاتيني متاحًا محليًا إلى أن يُتخذ قرار ترخيص مستقل.

## مركز التحكم

يُقسَّم مركز التحكم إلى إدارات مستقلة بدل صفحة إعدادات طويلة:

| الإدارة | مسؤوليتها | ما تُظهره | ما لا تفعله تلقائيًا |
|---|---|---|---|
| **الإعدادات العامة** | اللغة، المظهر، حجم النص، الكثافة، الحركة | حالة التفضيلات والمعاينة | لا تغيّر project policy أو صلاحيات الوكلاء |
| **إدارة الحسابات الخارجية** | provider accounts وOAuth وMCP وGitHub/Google لاحقًا | الحالة، المالك، scopes، آخر تحقق، consent state | لا تخزن أو تعرض token، ولا تتصل أو تجدد جلسة دون فعل صريح |
| **إدارة التخزين** | memory/sqlite profile وquota وbackup وretention | profile، نوع التخزين، الاستخدام، آخر backup، policy | لا تنقل profile أو تحذف بيانات أو تستعيد backup دون Human Gate |
| **إدارة الوكلاء** | Agent Catalog، capabilities، permissions، handoff | التعريف والحالة والحدود | لا تُحوّل definition إلى runtime ولا تمنح صلاحية |
| **إدارة المعرفة والتطوير الذاتي** | توجيهات واستراتيجيات ومخططات ومهارات ومراجعتها | العناصر، المصدر، scope، الحالة، diff المقترح | لا تعدل القواعد الأساسية أو تفعل skill دون مراجعة صريحة |
| **الخصوصية والأمان** | provider access، redaction، audit، consent | السياسات والإنذارات وسجل القرار | لا تعطل default-deny من واجهة عادية |
| **الأداء والتشخيص** | low-memory profile، queue، smoke وdiagnostics | حدود الموارد وحالة العمليات | لا يبدأ native toolchain أو provider/model عند فتح الصفحة |

لكل إدارة حالات `loading` و`empty` و`error` و`review_required`. يجب ألا تختفي الموافقات أو jobs قيد التشغيل بسبب تبديل الإدارة أو اللغة.

## العقد والتنفيذ المرحلي

يُعرَّف `ApplicationSettings` ككائن صغير versioned ومحدود، ويُحدَّث عبر `settings.get` و`settings.update` فقط. التحديث يعيد snapshot canonical، ويرفض الحقول الزائدة والقيم خارج allowlist، ولا ينشئ approval ticket لأنه يغير تفضيلات العرض المحلية فقط. إعدادات الحسابات والتخزين والتطوير الذاتي لا تدخل في هذا العقد الأول؛ لكل منها port وpolicy وشريحة مستقلة.

يكون `locale=ar` و`theme=dark` و`fontScale=1` و`density=comfortable` defaults صريحة في composition. يرسل core snapshot إلى Workspace عبر typed IPC، وتستعمل الواجهة `textContent` وattributes محدودة. عند فشل تحديث غير متوقع يحتفظ التطبيق بآخر snapshot صالح ولا يطبق half-state.

## الاختبارات المطلوبة

تغطي الشريحة الأولى default Arabic/RTL، التبديل إلى English/LTR، light/dark، حدود font scale، compact/comfortable، reduce motion، رفض extra keys، رفض locale أو theme غير معروفين، وno filesystem/provider/network/approval mutation. لاحقًا تضاف اختبارات localization completeness، السلاسل المختلطة، keyboard navigation، contrast، و125% text scale.

## ما لم يُنفذ بعد

لا يعني توثيق الإدارات أن التكاملات الخارجية أو إدارة التخزين أو التطوير الذاتي أصبحت منفذة. OAuth وMCP وGitHub/Google account flows، backup/restore UX، persistent settings، skill activation، policy compiler، وlocal knowledge consolidation تحتاج عقودًا وبوابات مستقلة. يظل OpenTo `UNKNOWN / REQUIRES VALIDATION`.
