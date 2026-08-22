# PROJECT_STATE

## الحالة الحالية

| الحقل | القيمة |
|---|---|
| الإصدار | `0.3.0-project-preview-runtime` |
| المرحلة | Project Preview Runtime + Embedded Simulator + typed IPC |
| الحالة | Project Preview Runtime مدفوعة ومتحقق منها؛ docs state محدثة محليًا للإغلاق |
| أحدث commit مدفوع قبل هذه الشريحة | `f388e8957e602b96c97968feed2c3f8ebf08df23` |
| commit الشريحة الحالية | `cc4a35d3f621e5ab6f79e386cc9a1760e970f063`؛ دُفعت ضمن delivery push `0e9e772cee32bddba1c8590e59bf05fe798f9d7d` |
| آخر build ناجح | `pnpm check` في 2026-08-22 |
| آخر اختبار ناجح | `17/17` اختبار Node/tsx ناجح في 2026-08-22 |
| آخر push مؤكد | `origin/main` عند `0e9e772cee32bddba1c8590e59bf05fe798f9d7d`؛ local وGitHub متطابقان |

## المكتمل

تمت مراجعة المستودع والوثائق السابقة، وإنشاء `docs/31-gap-analysis.md`، وإجراء بحث موثق عن React Native/Expo/Metro/Fast Refresh/React Native Web/Expo Snack/Android Emulator/iOS Simulator/Hermes/Debugging. أضيفت `docs/33` إلى `docs/42` و16 reference maps تحت `docs/reference/`. أضيف Foundation code مستقل عن UI: domain primitives/errors/entities/events، application ports/use cases، in-memory adapters، MobileProjectDetector، PlatformCapabilityService، LightweightPreviewAdapter، EmbeddedSimulatorController، typed IPC transport/handlers، SQLite migration contract، `ProjectPreviewBundle`، و`FixturePreviewRuntime`.

أضيفت في هذه الشريحة `FilesystemProjectScanner` و`FilesystemProjectPreviewService` لقراءة مشروع من root مقيد واختيار manifest/entry وبناء bundle فعلي دون تشغيل scripts أو postinstall. كما أضيفت fixture Expo واختبارات filesystem وservice.

## النواة الحالية

الطبقات الحالية هي Domain وApplication وInterface Adapters وInfrastructure، مع EmbeddedSimulatorController وProjectPreviewBundle/FixturePreviewRuntime وtyped IPC in-memory وSQLite schema contract. تدعم النواة فتح Workspace، إنشاء Session، Approval، DeviceProfile، بناء bundle من file map أو filesystem root، تحميل fixture runtime، input/refresh/capture/inspect/stop، وانتقالات الحالة والأحداث.

المحاكي المدمج جزء من Workspace إلى جانب شجرة الملفات والمحرر والـ Inspector والـ Console على مستوى prototype والعقود. Android Emulator وiOS Simulator transports اختيارية مستقبلية تغذي نفس اللوحة. الوضع الحالي compatibility/fixture mode ولا يساوي React Native native runtime أو Metro HMR حقيقيًا.

## التحقق الحالي

نجح `pnpm check` مع typecheck و17 اختبارًا. الاختبارات تغطي controller lifecycle، typed IPC، mobile detection، preview adapter، bundle/runtime، blocked imports، path safety، filesystem scanner، وProjectPreviewService. لم تُشغّل مشاريع الهاتف أو package scripts تلقائيًا.

## العمل المتبقي

الخطوة التالية بعد الدفع هي Presentation renderer فعلي يستهلك `PreviewRenderNode` داخل لوحة المحاكي، ثم IPC لفتح مشروع filesystem من واجهة Workspace. بعد ذلك يأتي React Native Web/Metro adapter خلف نفس العقد، ثم actual SQLite adapter/migrations/backup، typed Electron preload IPC، provider/agent runtime، terminal sandbox، Android doctor/ADB adapter، iOS macOS-only adapter، visual tests، resource manager، security hardening، وrelease.

## المشكلات والمخاطر

لا يوجد Electron shell أو SQLite native driver أو Metro/React Native Web runtime أو Android/iOS toolchain بعد. Android يحتاج SDK/JDK/AVD/acceleration، وiOS Simulator يتطلب macOS/Xcode. OpenTo ما يزال `UNKNOWN / REQUIRES VALIDATION`. لا ينبغي تشغيل native toolchains أو scripts من مشاريع الهاتف تلقائيًا. dependencies الجديدة تحتاج license/SBOM audit بعد lockfile.

## قرارات مفتوحة

قرار React renderer النهائي، اختيار browser-metro مقابل تكييف Snack/React Native Web، تخزين SQLite، حدود remote EAS، وسياسة دعم الأجهزة المتعددة. لا يُحسم أي منها داخل Domain.

## الخطوة التالية الدقيقة

بعد هذه الشريحة يبدأ commit مستقل واحد فقط لبناء Presentation renderer داخل Embedded Workspace. يجب أن يسبقه contract tests وin-memory adapter وresource/security boundary. لا يبدأ Android/iOS native قبل اكتمال embedded renderer وdoctor/resource contracts.

آخر تحديث: 2026-08-22. feature commit: `cc4a35d3f621e5ab6f79e386cc9a1760e970f063`. آخر push مؤكد: `0e9e772cee32bddba1c8590e59bf05fe798f9d7d`؛ local وGitHub متطابقان. إعداد: Manus AI.
