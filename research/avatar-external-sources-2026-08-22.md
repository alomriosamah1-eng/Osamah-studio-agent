# مصادر خارجية لدراسة Virtual Human / AI Avatar

## pixiv/three-vrm

- المصدر: https://github.com/pixiv/three-vrm
- ما تم التحقق منه في 2026-08-22: مستودع لاستخدام VRM على Three.js، يظهر بترخيص MIT على GitHub، وله نشاط حديث وفروع/إصدارات متعددة؛ صفحة GitHub عرضت نحو 2.1k نجمة وقرابة 2,890 commit وقت الفحص.
- الدلالة المعمارية: مرشح runtime/loader لطبقة VRM داخل renderer، وليس character model أو TTS أو STT أو desktop overlay كاملًا.
- حدود الدليل: لم تُستنتج من صفحة المستودع وحدها جودة الواقعية أو latency أو ملاءمة كل منصة؛ يلزم فحص README/docs/API وملفات الترخيص والإصدارات واختبار أداء مستقل.

## met4citizen/TalkingHead

المصدر: https://github.com/met4citizen/talkinghead. عند الفحص في 2026-08-22، تظهر صفحة GitHub ترخيص MIT، نحو 1.5k نجمة و272 commit، وآخر commit ظاهر في 2026-06-02، مع إصدار v1.7 ظاهر كأحدث release. README يصفه كـJavaScript class للمتصفح يستخدم Three.js/WebGL، ويدعم full-body GLB وMixamo FBX بشرط rig متوافق مع Mixamo وARKit/Oculus viseme blend shapes. يذكر README lip-sync مدمجًا للإنجليزية والألمانية والفرنسية والفنلندية والليتوانية، والتكامل مع TTS خارجي إذا وفر word-level timestamps أو viseme/blend-shape data، كما يذكر إمكان تشغيل HeadTTS/HeadAudio في المتصفح. هذه حقائق موثقة من README وليست benchmark مستقلًا؛ دعم العربية أو اللهجة اليمنية غير مثبت في المصدر المفحوص، كما أن الأمثلة الافتراضية تستخدم خدمات TTS خارجية ولذلك لا تعني offline-first.

## vrm-c/vrm-specification

المصدر: https://github.com/vrm-c/vrm-specification. فُحص في 2026-08-22؛ المستودع الرسمي لمواصفات VRM، وتظهر الصفحة 877 commit وآخر commit في 2026-08-06، مع مجلدات specification وsamples، ومن دون releases منشورة. المواصفة تحتاج فحص ملفاتها التفصيلية عند اختيار version؛ صفحة المستودع وحدها لا تكفي لإثبات أن كل VRM asset تجاري حر. يجب فصل ترخيص implementation/runtime عن VRM Public License وحقوق character/model/texture/voice لكل أصل مستقل، وعدم افتراض أن وجود صيغة VRM يمنح حق إعادة التوزيع التجاري.

## ggml-org/whisper.cpp

المصدر: https://github.com/ggml-org/whisper.cpp. فُحصت صفحة GitHub في 2026-08-22؛ الصفحة تعرض MIT، نحو 53.1k نجمة، 4,988 commit، وrelease v1.9.3 ظاهرًا حديثًا. README يصف تنفيذًا C/C++ عالي الأداء لـOpenAI Whisper، مع CPU-only inference، quantization، VAD، C API، وbindings/targets تشمل Linux وWindows وWebAssembly. هذا يجعله مرشح STT محلي قابلًا للفصل في worker/child process، مع وجوب قياس latency/RAM للنموذج المختار وعدم اعتبار أرقام المجتمع benchmark للآلة المستهدفة. العربية كلغة Whisper العامة ليست دليلًا على جودة لهجة يمنية؛ هذه القدرة NOT VERIFIED حتى benchmark صوتي محلي مضبوط. ترخيص الكود MIT، لكن يجب مراجعة ترخيص كل وزن/model artifact مستقلًا قبل التوزيع.

## k2-fsa/sherpa-onnx

المصدر الرسمي للوثائق: https://k2-fsa.github.io/sherpa/onnx/، والمستودع: https://github.com/k2-fsa/sherpa-onnx. فُحصت الوثائق في 2026-08-22؛ التوثيق يذكر أن التعرف لا يحتاج إلى Internet وأن المعالجة محلية، وأن المشروع يستخدم ONNX/ONNX Runtime ويمكن بناؤه من المصدر، مع صفحات Linux CPU وLinux GPU وWindows وmacOS وWebAssembly وواجهات Node/Java/Rust/C# وغيرها. قائمة الوثائق تشمل keyword spotting وVAD وstreaming/offline ASR وTTS وTauri Desktop Apps. هذا يشير إلى منصة صوت محلية واسعة، لكنه لا يثبت أن كل model أو Arabic TTS أو wake word ذو ترخيص تجاري متوافق؛ يجب فحص model card/license لكل ملف، وعدم وضع كامل المنصة داخل Electron renderer قبل قياس الذاكرة.

## dscripka/openWakeWord

المصدر: https://github.com/dscripka/openWakeWord. فُحص README في 2026-08-22؛ الصفحة توضح أن الكود مرخص Apache 2.0، وأن كل النماذج pretrained المضمّنة مرخصة CC BY-NC-SA 4.0 بسبب بيانات تدريب ذات ترخيص غير معروف أو تقييدي. كما تظهر أدوات benchmark/training في المستودع ونشاط حديث نسبيًا، لكن هذا لا يثبت معدل false accept/false reject في العربية أو على جهاز Ubuntu المستهدف. التصنيف: code = OPEN-SOURCE/COMMERCIAL-COMPATIBLE SUBJECT TO NOTICE؛ included models = NONCOMMERCIAL/RESTRICTED، ولذلك لا تصلح النماذج الجاهزة كأساس تجاري. يثبت المصدر إمكان استخدام إطار wake word، لا جودة wake word عربي/يمني أو أمان الاستماع الدائم.

## coqui-ai/TTS / XTTS-v2

المصدر: https://github.com/coqui-ai/TTS/blob/dev/docs/source/models/xtts.md. فُحص في 2026-08-22؛ README الرسمي يذكر أن XTTS-v2 يدعم 16 لغة، بينها العربية (ar)، ويذكر voice cloning وcross-language voice cloning وstreaming inference، ثم ينص على أن النموذج مرخص بـCoqui Public Model License (CPML). هذا يثبت وجود مسار عربي على مستوى اللغة، لكنه لا يثبت جودة لهجة يمنية أو حق استخدام تجاري غير مشروط. محاولة فتح رابط CPML المذكور في README (`https://coqui.ai/cpml`) أعادت صفحة 404 في جلسة الفحص؛ لذلك التصنيف التجاري النهائي للـmodel: UNCLEAR/REQUIRES LEGAL REVIEW، وليس COMMERCIAL-SAFE. يجب فصل ترخيص كود مستودع TTS (MPL-2.0 وفق GitHub API) عن ترخيص XTTS model وعن حقوق عينة/صوت المتحدث، وعدم إدخال voice cloning قبل consent وسياسة حذف واضحة.

## Piper عبر sherpa-onnx

المصدر: https://k2-fsa.github.io/sherpa/onnx/tts/piper.html. فُحص في 2026-08-22؛ صفحة التوثيق الرسمية تذكر أن Piper يوفر نماذج لأكثر من 30 لغة، وتربط إلى مستودع أصوات Piper على Hugging Face وإلى releases محوّلة في sherpa-onnx. الصفحة توضح مسار تحويل/تنزيل النماذج، لكنها لا تمنح ترخيصًا موحدًا لكل voice/model artifact ولا تثبت وجود voice يمني أو جودة عربية معينة. لذلك يجب تصنيف كل صوت Piper على حدة بعد قراءة model card وملفات LICENSE/metadata؛ لا يكفي MIT الخاص بمستودع Piper القديم، الذي ظهر في GitHub API كـarchived.

## Electron BrowserWindow / Desktop Overlay

المصدر الرسمي: https://www.electronjs.org/docs/latest/api/browser-window. فُحص في 2026-08-22؛ توثيق Electron يصف `BrowserWindow` كنافذة تحكم من Main process ويعرض `transparent` و`backgroundThrottling` و`offscreen` و`contextIsolation` و`sandbox`، ويشرح قيود Wayland على تغيير الحجم/الموضع/التركيز. يحتوي التوثيق كذلك على `setAlwaysOnTop` و`setIgnoreMouseEvents`. هذا يثبت أن overlay المستقبلي يمكن دراسته فوق نافذة Electron الحالية، لكنه لا يثبت نجاح تركيبة transparent/frameless/always-on-top/click-through على كل مدير نوافذ Linux. القرار المقترح مؤجل: نافذة منفصلة least-privilege، transparent وframeless عند الحاجة، always-on-top اختياري بموافقة المستخدم، click-through اختياري مع مسار وصول بديل، وإبقاء renderer الخاص بالـworkspace معزولًا. يجب إجراء matrix اختبار على Ubuntu/X11 وWayland وWindows وmacOS قبل أي التزام معماري نهائي، وعدم تنفيذ overlay ضمن هذه الدراسة.

## Live2D Cubism SDK

المصدر الرسمي: https://www.live2d.com/en/sdk/license/. فُحص في 2026-08-22؛ Live2D يوضح أن SDK يمكن تنزيله والبدء به بلا تكلفة أولية، لكنه ينص على أن نشر المحتوى المصنوع به يتطلب SDK Release License/Publication License ودفع الرسوم، مع إعفاءات محددة للأفراد والمنشآت الصغيرة واستثناءات. لذلك Live2D خيار تقني 2D محتمل للواقعية الخفيفة/الحركة، لكنه ليس open-source commercial-safe runtime، ويحتاج قرار ترخيص/تكلفة منفصل؛ لا ينبغي إدراجه كاعتماد مفتوح في `project/open-source-components.json`.

## Godot Engine وV-Sekai/godot-vrm

المصدر الرسمي للمحرك: https://github.com/godotengine/godot، وإضافة VRM المرشحة: https://github.com/V-Sekai/godot-vrm. فُحص مستودع Godot في 2026-08-22؛ README يذكر أن Godot مفتوح المصدر تحت MIT ومتعدد المنصات ويدعم 2D/3D وLinux/macOS/Windows/Web/mobile. هذا يجعل Godot خيارًا تقنيًا مستقلًا قويًا، لكنه يضيف engine/runtime ثقيلاً نسبيًا إلى تطبيق Electron الحالي ولا يثبت وحده ملاءمة 8GB أو integration مع typed IPC. لذلك هو مقارنة/target-high-realism محتمل فقط، وليس توصية لبدء التنفيذ أو لتغيير runtime الحالي. إضافة `godot-vrm` تحتاج تدقيقًا مستقلًا لترخيصها وإصدارها وملاءمة VRM قبل أي استخدام.

## VRoid Studio assets

المصدر الرسمي: https://vroid.com/en/studio/guidelines. فُحص في 2026-08-22؛ إرشادات VRoid تقول إن أي فرد أو شركة يمكنه بيع أو استخدام mesh/texture/preset المقدمة من VRoid Studio لأغراض تجارية ما لم ينص الترخيص على شروط خاصة، وتربط إلى شروط الاستخدام. هذا يخص محتوى pixiv المقدم داخل VRoid، وليس كل model منشور في VRoid Hub أو كل texture/character خارجي. التصنيف: COMMERCIAL-PERMITTED-WITH-CLAUSES، مع ضرورة الاحتفاظ بسجل شروط كل asset وعدم ادعاء أن كل VRoid model تجاري حر.

## Mixamo

المصدر الرسمي الذي فُحص: https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html. الصفحة مؤرخة 2021-09-14، والنسخة المستخرجة في جلسة 2026 لم تعرض فقرة الترخيص التفصيلية؛ لذلك تُصنّف معلومات استخدام Mixamo هنا `NOT VERIFIED / STALE SOURCE` رغم أن نتيجة البحث الرسمية أشارت إلى استخدام الشخصيات والحركات شخصيًا وتجاريًا. Mixamo ليس مشروعًا open-source، وأي استعمال فعلي يجب أن يعود إلى شروط Adobe الحالية وقت التوزيع، مع فصل ترخيص animation عن ترخيص character/model والـavatar النهائي.

## M3-org/CharacterStudio

المصدر: https://github.com/M3-org/CharacterStudio. فُحص في 2026-08-22؛ صفحة GitHub تعرض MIT للمستودع، نحو 325 نجمة و2,662 commit، وآخر commit ظاهر حديثًا، ولا توجد releases منشورة. وصف المشروع نفسه يضعه كمنصة web لإنشاء وتخصيص وتحسين VRM، مع تصدير/تحسين وتقليل mesh/draw calls ومنطق `CharacterManager`، لا كـAvatar runtime للصوت أو الوكيل. لذلك هو مرشح creator/asset-preparation منفصل قد يفيد في مرحلة إعداد الأصول، لا dependency runtime للمشروع الحالي. صفحة المستودع تعرض كذلك ملفات `cert.pem` و`key.pem` ضمن الشجرة؛ لا يعني ذلك وحده وجود سر فعال، لكنه سبب كافٍ لاعتباره `REQUIRES SECURITY REVIEW` وعدم استنساخه/إدخاله أو نسخ أصوله قبل فحص history وإزالة أي مفاتيح مكشوفة.

## CC BY-NC-SA 4.0

المصدر الرسمي: https://creativecommons.org/licenses/by-nc-sa/4.0/. فُحص في 2026-08-22؛ نص Creative Commons يوضح السماح بالمشاركة والتعديل مع attribution، لكنه يمنع الاستخدام التجاري (`NonCommercial`) ويفرض ShareAlike على الأعمال المشتقة، مع التنبيه إلى احتمال وجود حقوق خصوصية/شهرة أو حقوق أخرى. هذا يعضد تصنيف نماذج openWakeWord الجاهزة كغير تجارية، ولا يغني عن قراءة النص القانوني الكامل لكل artifact.

## TMElyralab/MuseTalk

المصدر: https://github.com/TMElyralab/MuseTalk. فُحص في 2026-08-22؛ README يصف MuseTalk كنموذج lip-sync عالي الجودة ويدعي 30fps+ على NVIDIA Tesla V100، ويعرض inference codes/training codes/model weights مع مسار تشغيل Linux وWindows، ووجود preprocessing/weights خارجية. هذه نتيجة مختبرية مرتبطة ببطاقة GPU محددة وليست ضمانًا على Ubuntu 8GB أو CPU-only، ولا ينبغي تشغيله داخل renderer أو startup. صفحة GitHub تعرض LICENSE، لكن توزيع الأوزان من روابط خارجية ومتطلبات CUDA/الذاكرة تستلزم تدقيقًا مستقلًا؛ التصنيف العملي: target-high-realism optional، code/model license = REQUIRES ARTIFACT-LEVEL VERIFICATION قبل أي استخدام تجاري. لا يصلح كـMVP خفيف.

## KlingAIResearch/LivePortrait

المصدر: https://github.com/KlingAIResearch/LivePortrait، مع توضيح ترخيص weights في https://github.com/KwaiVGI/LivePortrait/issues/548 وقيود InsightFace في https://github.com/KlingAIResearch/LivePortrait/issues/193. فُحص المستودع في 2026-08-22؛ تظهر نحو 19k نجمة و126 commit وملفات pretrained_weights ومكونات Python/CUDA، ما يجعله خيار portrait-animation عالي الواقعية لكنه خارج low-memory baseline. نتائج البحث في issue الرسمية تشير إلى توضيح أن الأوزان المدرجة يمكن استخدامها تجاريًا تحت MIT مع ضرورة إزالة نماذج InsightFace في سياقات تجارية، لكن لم تُراجع نصوص issue كاملة في جلسة الفحص؛ لذلك التصنيف النهائي `STRONG CANDIDATE / REQUIRES LEGAL AND WEIGHT-PROVENANCE REVIEW`. لا يُقترح كاعتماد runtime مدمج في Electron؛ إن أُبقي، فهو خدمة اختيارية مع GPU/process isolation وdegradation fallback.
