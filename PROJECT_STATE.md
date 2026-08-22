# PROJECT_STATE

## الحالة الحالية

| الحقل | القيمة |
|---|---|
| الإصدار | `0.4.0-presentation-renderer` |
| المرحلة | Presentation Renderer + Project Preview Runtime + Embedded Simulator |
| الحالة | Presentation renderer مدفوعة ومتحقق منها؛ الشجرة نظيفة |
| آخر commit مدفوع | `df53c8cd32b5e35c25488171bdca5241770146b3` |
| آخر build ناجح | `pnpm check` في 2026-08-22 |
| آخر اختبار ناجح | `19/19` اختبار Node/tsx ناجح في 2026-08-22 |
| آخر push مؤكد | `origin/main` عند `df53c8cd32b5e35c25488171bdca5241770146b3`؛ local وGitHub متطابقان |

## المكتمل

تمت مراجعة المستودع والوثائق السابقة، وإنشاء `docs/31-gap-analysis.md`، وإجراء بحث موثق عن React Native/Expo/Metro/Fast Refresh/React Native Web/Expo Snack/Android Emulator/iOS Simulator/Hermes/Debugging. أضيفت `docs/33` إلى `docs/43` و16 reference maps تحت `docs/reference/`. أضيف Foundation code مستقل عن UI: domain primitives/errors/entities/events، application ports/use cases، in-memory adapters، MobileProjectDetector، PlatformCapabilityService، LightweightPreviewAdapter، EmbeddedSimulatorController، typed IPC transport/handlers، SQLite migration contract، `ProjectPreviewBundle`، و`FixturePreviewRuntime`.

اكتملت شريحة Project Preview Runtime بإضافة `FilesystemProjectScanner` و`FilesystemProjectPreviewService` لقراءة مشروع من root مقيد واختيار manifest/entry وبناء bundle فعلي دون تشغيل scripts أو postinstall. كما اكتملت شريحة Presentation Renderer بإضافة renderer نقي يحوّل `PreviewRenderNode` إلى HTML دلالي محدود، مع browser adapter ودمجه داخل `prototypes/studio/index.html`.

## النواة الحالية

الطبقات الحالية هي Domain وApplication وInterface Adapters وInfrastructure وPresentation. تدعم النواة فتح Workspace، إنشاء Session، Approval، DeviceProfile، بناء bundle من file map أو filesystem root، تحميل fixture runtime، input/refresh/capture/inspect/stop، وتركيب render tree داخل embedded simulator.

المحاكي المدمج جزء من Workspace إلى جانب شجرة الملفات والمحرر والـ Inspector والـ Console على مستوى العقود والprototype. Android Emulator وiOS Simulator transports اختيارية مستقبلية تغذي نفس اللوحة. الوضع الحالي compatibility/fixture mode ولا يساوي React Native native runtime أو Metro HMR حقيقيًا.

## التحقق الحالي

نجح `pnpm check` مع typecheck و19 اختبارًا. تشمل الاختبارات renderer semantic mapping، escaping، deterministic props، depth guard، filesystem scanner، ProjectPreviewService، bundle/runtime، blocked imports، typed IPC، controller lifecycle، وmobile detection. نجح أيضًا `node --check prototypes/studio/preview-renderer.js` وsecret scan و`git diff --check`. تحقق بصريًا من render tree، فتح `settings.tsx`، تغيير orientation، وFast Refresh داخل اللوحة المدمجة.

## العمل المتبقي

بعد هذه الشريحة يأتي IPC لفتح مشروع filesystem من واجهة Workspace وإرسال bundle إلى controller بدل تمريره يدويًا، ثم React Native Web/Metro adapter خلف نفس العقد، ثم actual SQLite adapter/migrations/backup، typed Electron preload IPC، provider/agent runtime، terminal sandbox، Android doctor/ADB adapter، iOS macOS-only adapter، visual regression، resource manager، security hardening، وrelease.

## المشكلات والمخاطر

لا يوجد Electron shell أو SQLite native driver أو Metro/React Native Web runtime أو Android/iOS toolchain بعد. Android يحتاج SDK/JDK/AVD/acceleration، وiOS Simulator يتطلب macOS/Xcode. OpenTo ما يزال `UNKNOWN / REQUIRES VALIDATION`. لا ينبغي تشغيل native toolchains أو scripts من مشاريع الهاتف تلقائيًا. renderer الحالي bounded ولا يغني عن CSP وsandbox حقيقيين في Electron production shell.

## قرارات مفتوحة

قرار React renderer النهائي، اختيار browser-metro مقابل تكييف Snack/React Native Web، تخزين SQLite، حدود remote EAS، وسياسة دعم الأجهزة المتعددة. لا يُحسم أي منها داخل Domain.

## الخطوة التالية الدقيقة

بعد هذه الشريحة يبدأ commit مستقل واحد فقط لإضافة IPC لفتح مشروع filesystem من واجهة Workspace. يجب أن يسبقه contract tests وin-memory adapter وresource/security boundary. لا يبدأ Android/iOS native قبل استقرار embedded renderer وdoctor/resource contracts.

آخر تحديث: 2026-08-22. آخر push مؤكد: `df53c8cd32b5e35c25488171bdca5241770146b3`؛ local وGitHub متطابقان والشجرة نظيفة. إعداد: Manus AI.
