# نتائج بحث mobile subsystem — الجولة الأولى

## React Native Fast Refresh

المصدر الرسمي [1] يوضح أن Fast Refresh مفعّل افتراضيًا، وأن أغلب تعديلات مكونات React تظهر خلال ثانية أو ثانيتين. التحديث يحافظ على حالة المكونات الوظيفية والـ Hooks عندما يكون الملف مصدر مكونات React فقط؛ أما الملف الذي يصدّر قيمًا غير مكونات ويُستورد خارج شجرة React فقد يؤدي إلى full reload. أخطاء syntax وruntime قابلة للتعافي عند الحفظ التالي، لكن حفظ الحالة ليس مضمونًا لكل بنية module.

**الأثر المعماري:** يجب أن يميز `PreviewSession` بين `FAST_REFRESH`, `MODULE_RELOAD`, و`FULL_RELOAD`، وأن يعرض السبب للمستخدم. لا ينبغي أن يفترض agent أن كل تعديل سريع وآمن؛ تغييرات native modules أو dependencies تحتاج build/restart.

## Metro وExpo

وثيقة Expo الرسمية [2] تصف Metro بأنه bundler الرسمي لـ Expo وReact Native، وتربطه بـ React Fast Refresh وHermes وReact Native DevTools. تدعم Metro المعالجة عند الطلب، التخزين المؤقت، delta bundling، reuse عبر المنصات، وwatching، ما يجعله نقطة التكامل الصحيحة مع runtime الحقيقي بدل بناء bundler خاص داخل التطبيق.

**الأثر المعماري:** Osamah لا يعيد تنفيذ Metro. ينشئ `MetroProcessAdapter` يدير start/stop/health/logs/port/Fast Refresh events، ويستخدم preview خفيفًا مستقلًا عندما لا يتوفر runtime native. يجب أن تكون إدارة Metro في worker process لا في UI process، مع اكتشاف المشروع وقراءة config دون تشغيل scripts غير موثوقة.

## References

[1]: https://reactnative.dev/docs/fast-refresh "Fast Refresh · React Native"
[2]: https://docs.expo.dev/guides/why-metro/ "Why Metro? · Expo Documentation"

تاريخ الفحص: 2026-08-22. إعداد: Manus AI.

## Expo development builds

وثيقة Expo [3] تفرق بين Expo Go وdevelopment build: development build هو نسخة مخصصة من Expo Go تسمح باستخدام native libraries وتغيير native configuration، وتوصى به التطبيقات التي ستُبنى وتُطلق فعليًا. يمكن البناء محليًا عبر Android Studio وXcode، أو عبر EAS cloud من أي نظام وفق شروط الخدمة، أو EAS CLI local. هذا يثبت أن Preview/Metro لا يغني عن development build عندما يعتمد المشروع على native modules.

**الأثر المعماري:** `ExpoProjectAdapter` يميز `expo-go`, `development-build`, `bare-react-native`, و`web-preview`. preview الخفيف لا يدّعي تشغيل native code. يجب أن يعرض UI سبب انتقال المستخدم إلى Android Emulator أو جهاز فعلي أو EAS/macOS build.

## React Native for Web

React Native for Web [4] هو compatibility layer بين React DOM وReact Native، ويستخدم DOM لعرض JavaScript متوافق مع RN، مع components مثل View/Text/TextInput/ScrollView، وgesture responder وstyles تتحول إلى CSS. هذا يجعله مرشحًا قويًا لمسار Lightweight Preview، لكنه لا يحاكي native modules أو GPU/OS behavior تلقائيًا.

**الأثر المعماري:** المعاينة الداخلية تكون WebView/renderer لتطبيق web preview مع device frame وprofile، وتبقى صريحة بأنها «preview compatibility mode». يجب اكتشاف unsupported APIs وعرض warnings بدل إخراج نتيجة تبدو native وهي ليست كذلك.

## References

[3]: https://docs.expo.dev/develop/development-builds/introduction/ "Introduction to development builds · Expo"
[4]: https://necolas.github.io/react-native-web/docs/ "Introduction to React Native for Web"

## Android Emulator

توثيق Android الرسمي [5] يوضح أن المحاكي يعتمد على hardware acceleration بطريقتين: graphics acceleration وVM acceleration. يمكن اختيار GPU mode مثل auto/host/software، وتؤثر القدرة غير المتوافقة في crash أو صور غير صحيحة. كما يحتاج VM acceleration إلى hypervisor وإعدادات نظامية. هذا يجعل Android Emulator runtime حقيقيًا ومفيدًا لاختبارات native، لكنه ليس lightweight preview: يملك تكلفة CPU/GPU/RAM، ويجب تشغيله خارج UI عبر `AndroidEmulatorAdapter` وResource Manager.

**الأثر المعماري:** يجب أن يكتشف النظام acceleration وAVD وADB وSDK/JDK، ويعرض `doctor` واضحًا. عند عدم وجود acceleration أو SDK، يستمر Lightweight Preview بدل الفشل الكلي. لا يُنشأ emulator تلقائيًا دون budget أو consent.

## iOS Simulator وApple tooling

توثيق Apple الرسمي [6] ينص على أن iOS وiPadOS simulators متاحة داخل macOS كجزء من Xcode، مع runtimes تُثبت من Xcode. لذلك لا يدّعي Osamah تشغيل Apple iOS Simulator أصليًا على Windows أو Linux. على macOS، يستخدم `XcodeSimulatorAdapter` و`simctl`/Xcode destinations عند توفرهما. خارج macOS، يبقى preview compatibility mode، أو remote macOS/EAS build، أو physical device workflow وفق حسابات وشروط المستخدم.

**الأثر المعماري:** `PlatformCapabilityMatrix` يجب أن يميز Windows/Linux/macOS و`native_ios_simulator=false` خارج macOS. remote build لا يساوي local simulator ولا يتيح تفاعلًا لحظيًا كاملًا؛ يجب عرضه كـ build/test artifact path منفصل.

## References

[5]: https://developer.android.com/studio/run/emulator-acceleration "Configure hardware acceleration for the Android Emulator"
[6]: https://developer.apple.com/documentation/safari-developer-tools/installing-xcode-and-simulators "Installing Xcode and Simulators · Apple Developer"

## حلول browser-based مفتوحة المصدر

دراسة Callstack عن browser-based React Native playground لـ Expo [7] تشير إلى مسار عملي يجمع browser preview وتجربة التطوير السريع، لكنه ليس بديلًا عن native runtime. كما يوضح مشروع reactnative.run [8] نموذجًا مفتوح المصدر مستقلًا يستخدم browser-metro وWeb Worker وReact Native Web وHMR وExpo Router، ويصرح صراحة أنه يدعم web preview فقط ولا يوفر native device preview حاليًا. يذكر أيضًا أنه MIT وقابل للاستضافة الذاتية، لكن أول تنزيل للحزم يحتاج شبكة، وأن النتيجة web compatibility وليست iOS/Android native.

**الأثر المعماري:** يمكن تكييف browser-metro/reactnative.run أو استخدام فكرة architecture كـ `LightweightPreviewAdapter`، لكن لا يجوز اعتماد المشروع أو نسخ كوده قبل license/dependency/security audit. أفضل MVP هو تشغيل preview bundle في Web Worker أو utility process مع WebView داخل Osamah، يضيف device frame/profile/interaction/screenshot، ويحافظ على API يسمح باستبداله بمسار Metro الحقيقي.

## References

[7]: https://www.callstack.com/case-studies/building-a-browser-based-react-native-playground-for-expo "Building a browser-based React Native playground for Expo"
[8]: https://www.reactnative.run/ "reactnative.run — Run React Native in your browser"
[9]: https://github.com/RapidNative/reactnative-run "reactnative.run source repository"

## Snack/Callstack evidence

استخراج دراسة Callstack [7] يضيف دليلًا عمليًا مهمًا: Snack استخدم Monaco Editor، تكامل ESLint/Prettier/TypeScript وإدارة الملفات، وpackager مخصصًا مع NPM support. لتقليل latency طُبق code patching يرسل التغييرات فقط إلى الجهاز بدل إعادة بناء bundle كامل، ونتج عن ذلك prototype/share/real-device preview/debugging. هذا يثبت قيمة فصل `PreviewTransport` عن `NativeRuntimeTransport`: يمكن للمعاينة الخفيفة استخدام patch/HMR، بينما يظل device/native path منفصلًا.

## Hermes وDebugging

توضح وثيقة React Native [9] أن Hermes هو JavaScript engine مفتوح المصدر محسّن لـ React Native، وقد يحسن startup وmemory usage وapp size مقارنة بـ JavaScriptCore، ويأتي bundled ومتوافقًا مع نسخة React Native. هذا لا يعني أن lightweight web preview يشغّل Hermes native؛ لذلك يسجل النظام engine mode ويقيسه بدل افتراض التكافؤ.

وتوضح وثيقة Debugging الرسمية [10] أن Dev Menu وReact Native DevTools وLogBox مخصصة لتطوير غير production، وأن DevTools توفر console وReact Components Inspector وProfiler، بينما LogBox يعرض الأخطاء والتحذيرات. كما توصي الوثيقة باستخدام native tooling في Android Studio/Xcode لقياسات الأداء الدقيقة. يجب أن يجمع Osamah logs وstack traces وsource maps من adapters، لكنه لا يستبدل أدوات native في benchmark النهائي.

**الأثر المعماري:** `DebugSession` يملك runtime target وengine وmetro URL وlog streams وsource-map refs، ويصنف fatal/runtime/warning/performance. `LightweightPreview` يملك diagnostics أقل من native ويعرض ذلك بوضوح.

## References

[9]: https://reactnative.dev/docs/hermes "Using Hermes · React Native"
[10]: https://reactnative.dev/docs/debugging "Debugging Basics · React Native"

## Expo Snack

مستودع Expo Snack الرسمي [11] يثبت نموذجًا مفتوح المصدر لتشغيل Expo في المتصفح، مع dynamic bundling وExpo Go أو web-player، ومشاركة/تضمين Snacks. README يوضح فصل `website`, `snackager`, `runtime`, `runtime-shell`, و`snack-sdk`، كما يذكر MIT مع اختلاف تراخيص بعض dependencies. مخطط Snack [12] يؤكد أن الفصل بين الواجهة، bundler، runtime، proxies، وdata/services أهم من وضع كل شيء داخل renderer.

**الأثر المعماري:** يُستفاد من Snack كمرجع قوي لتصميم `MobilePreviewContext`: UI/editor، bundler/Metro adapter، runtime transport، device/real-device transport، وartifact/session services. لا يتم fork أو نسخ code؛ يُراجع الإصدار والـ dependencies والـ license قبل أي adaptation.

## References

[11]: https://github.com/expo/snack "Expo Snack repository"
[12]: https://github.com/expo/snack/blob/main/docs/diagram/snack-diagram.md "Snack diagram"
