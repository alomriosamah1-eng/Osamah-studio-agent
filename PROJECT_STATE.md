# PROJECT_STATE

## الحالة الحالية

| الحقل | القيمة |
|---|---|
| الإصدار | `0.6.0-desktop-shell` |
| المرحلة | Electron Shell + Typed Preload + IPC Project Open + Presentation Renderer |
| الحالة | Electron shell وtyped preload ووثائق الشريحة مدفوعة ومتحققة؛ الشجرة نظيفة |
| آخر commit مدفوع | `2a0e891b544324ff06f18ad461282527af987a13` |
| آخر build ناجح | `pnpm check` في 2026-08-22 |
| آخر اختبار ناجح | `23/23` اختبار Node/tsx ناجح في 2026-08-22؛ desktop smoke ناجح |
| آخر push مؤكد | `origin/main` عند `2a0e891b544324ff06f18ad461282527af987a13`؛ local وGitHub متطابقان |

## المكتمل

تمت مراجعة المستودع والوثائق السابقة، وإنشاء `docs/31-gap-analysis.md`، وإجراء بحث موثق عن React Native/Expo/Metro/Fast Refresh/React Native Web/Expo Snack/Android Emulator/iOS Simulator/Hermes/Debugging. أضيفت `docs/33` إلى `docs/44` و16 reference maps تحت `docs/reference/`. أضيف Foundation code مستقل عن UI: domain primitives/errors/entities/events، application ports/use cases، in-memory adapters، MobileProjectDetector، PlatformCapabilityService، LightweightPreviewAdapter، EmbeddedSimulatorController، typed IPC transport/handlers، SQLite migration contract، `ProjectPreviewBundle`، و`FixturePreviewRuntime`.

اكتملت شريحة Project Preview Runtime بإضافة `FilesystemProjectScanner` و`FilesystemProjectPreviewService` لقراءة مشروع من root مقيد واختيار manifest/entry وبناء bundle فعلي دون تشغيل scripts أو postinstall. اكتملت شريحة Presentation Renderer بتحويل `PreviewRenderNode` إلى HTML دلالي محدود، مع browser adapter ودمجه داخل Workspace. أضيفت الخطة التنفيذية الرئيسية في `docs/45-master-implementation-plan.md` ونسختها القابلة للآلة في `project/master-implementation-plan.json`، ودُفعت إلى GitHub كمرجع التنفيذ المعتمد. أضيف Electron shell وtyped preload وCSP وsender validation وdesktop smoke في `src/desktop/` و`scripts/desktop-smoke.mjs`، ونجح عبور `preview.openProject` من Workspace إلى preload ثم main IPC.

أضيف `preview.openProject` إلى typed IPC. يبني handler bundle من filesystem عبر Application service ثم يمرره إلى `EmbeddedSimulatorController.start`، ويعيد summary محدودًا للحزمة مع session metadata. أضيف wiring فعلي في `createEmbeddedApplication` واختبارات فتح fixture ورفض path traversal.

## النواة الحالية

الطبقات الحالية هي Domain وApplication وInterface Adapters وInfrastructure وPresentation. تدعم النواة فتح Workspace، إنشاء Session، Approval، DeviceProfile، بناء bundle من file map أو filesystem root، فتح مشروع عبر IPC، تحميل fixture runtime، input/refresh/capture/inspect/stop، وتركيب render tree داخل embedded simulator.

المحاكي المدمج جزء من Workspace إلى جانب شجرة الملفات والمحرر والـ Inspector والـ Console على مستوى العقود والprototype. Android Emulator وiOS Simulator transports اختيارية مستقبلية تغذي نفس اللوحة. الوضع الحالي compatibility/fixture mode ولا يساوي React Native native runtime أو Metro HMR حقيقيًا.

## التحقق الحالي

نجح `pnpm check` مع typecheck و21 اختبارًا. تشمل الاختبارات `preview.openProject` من fixture فعليًا، bundle summary، inspect، ورفض entry الذي يتجاوز root، إلى جانب renderer وfilesystem وruntime وIPC وcontroller وmobile detection. لم تُشغّل مشاريع الهاتف أو package scripts أو native toolchains تلقائيًا.

## العمل المتبقي

بعد هذه الشريحة يأتي typed Electron preload boundary وadapter واجهة Workspace لاختيار root path من المستخدم واستدعاء `preview.openProject` دون كشف Node APIs مباشرة إلى renderer. يلي ذلك React Native Web/Metro adapter خلف نفس العقد، ثم actual SQLite adapter/migrations/backup، provider/agent runtime، terminal sandbox، Android doctor/ADB adapter، iOS macOS-only adapter، visual regression، resource manager، security hardening، وrelease.

## المشكلات والمخاطر

لا يوجد Electron shell أو SQLite native driver أو Metro/React Native Web runtime أو Android/iOS toolchain بعد. Android يحتاج SDK/JDK/AVD/acceleration، وiOS Simulator يتطلب macOS/Xcode. OpenTo ما يزال `UNKNOWN / REQUIRES VALIDATION`. لا ينبغي تشغيل native toolchains أو scripts من مشاريع الهاتف تلقائيًا. renderer وIPC الحاليان bounded ولا يغنيان عن CSP وsandbox وtyped preload حقيقيين في Electron production shell.

## قرارات مفتوحة

قرار React renderer النهائي، اختيار browser-metro مقابل تكييف Snack/React Native Web، تخزين SQLite، حدود remote EAS، وسياسة دعم الأجهزة المتعددة، وتصميم user-selected root policy في Electron. لا يُحسم أي منها داخل Domain.

## الخطوة التالية الدقيقة

الخطة التنفيذية المعتمدة هي `docs/45-master-implementation-plan.md` و`project/master-implementation-plan.json`. بعد هذه الشريحة يبدأ commit مستقل واحد فقط لإضافة SQLite adapter وobservability، ثم production root picker خلف typed Electron boundary. يجب أن يسبقه contract tests وCSP/sandbox/resource boundary. لا يبدأ Android/iOS native قبل استقرار هذه الحدود وdoctor/resource contracts.

آخر تحديث: 2026-08-22. إعداد: Manus AI.
