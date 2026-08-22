# Lightweight Web Preview وResource Policy

**الحالة:** slice منفذة ومدفوعة ومتحقق منها عند `b9089efee33a174c3958a9295853623beae27503`؛ لا تعني ضمانًا مطلقًا ضد كل أسباب ضغط النظام.
**النطاق:** المحاكي المدمج داخل Workspace، بيئة المشاريع العامة، وحدود الذاكرة والعمليات على Ubuntu Linux.
**تاريخ التحديث:** 2026-08-22.
**إعداد:** Manus AI.

## القرار

لن يكون Osamah Studio Agent حاوية لمحاكي Android أو iOS ثقيل. المسار الأساسي هو **Lightweight Web Preview** يعمل داخل اللوحة المدمجة ويعرض واجهات React وReact Native القابلة للتوافق مع الويب. هذا الاختيار يتوافق مع طبيعة React Native for Web بوصفه compatibility layer بين React DOM وReact Native، واستخدامه React DOM وواجهات DOM للعرض في المتصفح [1]. أما React Native الأصلي فيبقى مسار بناء native مستقلًا؛ إذ تصف وثائقه مكوناته بأنها تُعرض إلى platform-native views، وهو ما لا ينبغي ادعاؤه داخل compatibility preview [2].

> **قاعدة الصدق:** Web Preview يحاكي العرض والتفاعل الأساسيين، لكنه لا يحاكي native modules أو sensors أو OS permissions أو native layout fidelity. كل feature غير مدعومة تظهر كـ capability warning، ولا تتحول إلى نجاح زائف.

ستكون بيئة التطوير عامة وليست مقصورة على مشاريع الهاتف. يدعم Workspace فتح أي مشروع نصي أو برمجي ضمن root آمن، مع file tree وeditor وInspector وConsole وagent panel. يضاف preview فقط عندما يتعرف النظام على React أو React Native أو HTML-compatible entry؛ أما Python أو Go أو Java أو مشروع backend أو ملفات Markdown فتظل قابلة للعمل والتحليل داخل البيئة دون إجبارها على mobile preview.

## الطبقات والمسارات

| المسار | التنفيذ الأساسي | ما لا يفعله |
|---|---|---|
| `general-project` | root آمن، file tree، editor، search، diagnostics، agent context | لا يحمّل المشروع كاملًا في الذاكرة |
| `react-web` | Web preview محدود من entry أو HTML-compatible artifact | لا يشغل dev server تلقائيًا في المسار الآمن الافتراضي |
| `react-native-web` | RN-compatible component mapping إلى Web Preview | لا يثبت أو يشغل Metro/Expo scripts تلقائيًا |
| `compatibility-preview` | `PreviewRenderNode` وDOM داخل embedded panel مع interactions محدودة | لا يدعي native fidelity أو native module execution |
| Android/iOS transport | اختيارية، لاحقة، وتغذي نفس لوحة preview | ليست dependency للإقلاع ولا شرطًا لعمل Workspace |
| Agent runtime | مهام bounded خارج renderer مع approval وresource caps | لا يملك صلاحية تشغيل شامل أو حجب UI thread |

## ميزانية 8GB

يُعامل جهاز Ubuntu الذي يملك 8GB RAM أو أقل على أنه `low-memory` profile افتراضيًا. لا تعني الميزانية التالية ضمانًا مطلقًا ضد مشاكل النظام أو برامج المستخدم الأخرى؛ هي حدود تشغيل واختبارات قبول تمنع Osamah Studio Agent من استهلاك الذاكرة بلا سقف.

| المورد | low-memory target | السلوك عند الاقتراب من الحد |
|---|---:|---|
| عدد embedded preview sessions | 1 | رفض فتح session ثانية أو إيقاف الأقدم بعد موافقة المستخدم |
| preview source map | 24 MB | رفض bundle كبير مع رسالة واضحة بدل الاستمرار |
| preview modules | 256 | إيقاف التحليل وإظهار `RESOURCE_LIMIT` |
| preview assets المفهرسة | 128 | تجاهل الزائد مع diagnostic محدود |
| warnings/diagnostics داخل الذاكرة | 256 | الاحتفاظ بالأحدث فقط |
| agent jobs المتزامنة | 1 | queue bounded، ولا يبدأ job جديد تلقائيًا |
| SQLite connection | اتصال واحد لكل profile | لا تُنشأ connections لكل query أو لكل panel |
| SQLite page cache | 16 MB مبدئيًا | تخفيض cache قبل تفعيل ميزات ثقيلة |
| قراءة نص ملف واحد للpreview | 1.5 MB | skip مع warning؛ لا يُقرأ الملف كاملًا |
| إجمالي عمليات Osamah المستهدفة | 1.0–1.5 GB كحد تشغيلي عملي | إيقاف العمل غير الضروري، تعطيل preview refresh، وإظهار diagnostics |
| refresh storm | debounce 250ms وlatest-only | إلغاء الطلبات القديمة بدل تراكمها |

لا تُحجز هذه الأرقام كـOS hard limits داخل كل process في هذه المرحلة؛ بل تُطبق كـadmission control وbounded data structures وقياسات. حدود child processes وagent workers ستضاف مع supervisor حقيقي قبل تشغيل أدوات خارجية.

## قواعد الأداء

يُفتح الملف عند الطلب، ولا تُنسخ شجرة المشروع كاملة إلى renderer. يعمل filesystem scanner بتدرج وبقائمة ignore، ويقرأ source files التي يحتاجها preview فقط، مع حد إجمالي للبايتات. يحافظ renderer على آخر render tree فقط، وتُستبدل refresh requests الأقدم بآخر طلب صالح. لا يستخدم المسار الأساسي bundler أو browser automation أو emulator process عند مجرد عرض fixture أو component tree.

تُبقي بيئة التطوير العامة العمليات الثقيلة خارج واجهة المستخدم. لا يعمل agent task أو indexing أو provider request داخل renderer أو main synchronous path. كل مهمة لاحقة ستملك `jobId` و`correlationId` وحالة cancel وtimeout وmemory budget وapproval requirement. في low-memory profile، concurrency الافتراضي واحد، ويفضل local deterministic adapters قبل أي provider أو native process.

تعتمد SQLite على connection واحدة لكل profile مع prepared statements وtransactions قصيرة. لا تُخزن snapshots كبيرة في observability، بل تُحفظ summaries وhashes وdiagnostics محدودة مع redaction. يبقى backup snapshot عملية صريحة وليست background job متكررة في كل تغيير.

## حالات capability

| الحالة | معنى العرض داخل UI |
|---|---|
| `supported` | يعمل ضمن Web Preview contract الحالي |
| `web_compatible` | يعمل عبر Web mapping مع اختلافات محدودة |
| `native_only` | يحتاج Android/iOS/physical transport؛ يعرض warning |
| `blocked` | ممنوع لأسباب أمنية أو موارد؛ يوقف preview قبل التنفيذ |
| `resource_limited` | المشروع أو العملية تجاوزت budget؛ لا يعني فشلًا في كود المستخدم |

## معيار القبول

اجتاز المسار الحالي بوابة أولية: `pnpm check` بـ44/44، و`pnpm performance:smoke` تحت V8 heap 768MB. في fixture React Native صغير سجّل الأداء الأخير preview بحوالي 11ms، heap delta حوالي 0.3MB، RSS delta حوالي 3.1MB، مع modules=2 وassets=0 و`PERF_PROFILE=low_memory`. تظل هذه أرقام smoke لمسار صغير وليست ضمانًا لكل مشروع.

يُقبل المسار الكامل عندما يظل Workspace مستجيبًا أثناء scan وpreview refresh، ولا يزيد عدد preview sessions عن السياسة، ويرفض bundle الكبير قبل تضخم الذاكرة، ولا تتراكم refresh requests، ولا يشغل project scripts أو native toolchains تلقائيًا. يجب أن تسجل الاختبارات زمن scan وbundle وrefresh، وheap delta، وعدد الملفات والوحدات، وحالة الرفض عند تجاوز budget.

لا نعلن أن التطبيق «لا يهنج» بناءً على اختبار واحد. الإعلان المقبول هو أن لدينا **resource admission controls، cancellation، bounded queues، وperformance evidence** على Ubuntu Linux، مع إبقاء حدود الأجهزة الأخرى وذاكرة البرامج المجاورة معلنة.

## الخطة المرحلية

اكتملت في هذه الشريحة إضافة `ProjectKind` و`PreviewCapability` و`ResourcePolicy`، وتخفيض حدود scanner وbundle إلى budgets صريحة، وgeneral project inspection، وReact/React Native Web capability detection دون تنفيذ scripts، وlatest-only refresh، وbounded agent runtime محدود concurrency يعمل خارج renderer، وperformance smoke بحد V8 heap قدره 768MB. ما يزال ربط SQLite الكامل عبر lifecycle الإنتاجي وnative transports والتكاملات الثقيلة مؤجلًا.

## المراجع

[1]: https://necolas.github.io/react-native-web/docs/ "React Native for Web documentation"

[2]: https://reactnative.dev/ "React Native official documentation"
