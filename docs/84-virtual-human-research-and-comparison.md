# دراسة Virtual Human Assistant / AI Avatar — البحث والمقارنة

**الحالة:** دراسة موثقة فقط؛ لا توجد Avatar implementation أو حزم أو نماذج أو أصوات أو تغييرات runtime في هذه الشريحة.
**النطاق:** شخصية افتراضية مستقبلية داخل **Second Brain** في Osamah Studio Agents، مع إمكانية Desktop Companion لاحقًا.
**تاريخ الفحص:** 2026-08-22.
**تصنيف الادعاءات:** `CONFIRMED` لما يثبته مصدر أولي، `STRONG INFERENCE` للاستنتاج المعماري المبني على دليل، و`UNKNOWN/NOT VERIFIED` لما يحتاج benchmark أو تدقيقًا إضافيًا.

## الخلاصة التنفيذية

المشروع الحالي Electron 43.4.1 وTypeScript strict وNode 22 وClean Architecture وtyped IPC وlocal-first، ويملك Agent Runtime محدودًا وSecond Brain capture/review وإعدادات عربية/إنجليزية، لكنه لا يملك Audio Runtime أو TTS أو STT أو Wake Word أو Avatar Runtime أو Desktop Overlay. هذه النتيجة **CONFIRMED** من جرد المستودع `research/avatar-repo-inventory-2026-08-22.md` ومن مراجعة `package.json` وشجرة `src`؛ لذلك لا يصح وصف Avatar بأنه منفذ أو أن إضافة إعدادات Settings السابقة تمنح هذه القدرة.

الاختيار العملي المقترح ليس مشروعًا واحدًا شاملًا، بل **Stack معياري**. للـMVP المستقبلي نوصي بدراسة renderer خفيف داخل Electron يعتمد على `three-vrm` أو طبقة بديلة خلف `AvatarRuntimePort`، مع GLB/VRM منخفض التعقيد، controller مستقل للحركة والتعبير، وtext-first fallback. أما الصوت فيبقى opt-in ومؤجلًا إلى benchmark؛ `sherpa-onnx` أو `whisper.cpp` مرشحان لمسار STT محلي، وPiper أو بديل عربي مدقق لمسار TTS، لكن ترخيص كل model/voice يجب أن يفحص مستقلًا. لا توجد في المصادر المفحوصة قرينة كافية لإعلان دعم **اللهجة اليمنية** أو صوت تجاري عربي بعينه.

الواقعية العالية عبر MuseTalk أو LivePortrait ليست بديلًا عن Avatar Runtime تفاعلي؛ الأدلة المتاحة تربطها بخطوط inference وGPU وأوزان خارجية. لذلك تبقى **Target High-Realism اختيارية** ومعزولة في process/service بعد benchmark، ولا يجوز أن تهدد تطبيق Ubuntu بذاكرة 8GB. لا يغيّر هذا القرار ترتيب MVP الحالي أو Architecture الحالية.

## حدود ونموذج الطبقات

يجب الفصل الصريح بين العناصر التالية، لأن الترخيص والأداء ومسؤولية الأمان تختلف بينها:

| الطبقة | مسؤوليتها | ما يثبت وجودها حاليًا | القرار المستقبلي |
|---|---|---|---|
| Character Model | mesh/texture/rig/metadata/VRM أو GLB | لا يوجد asset في المستودع | asset registry مع provenance وشروط استخدام لكل ملف |
| Avatar Runtime | تحميل model ورسمه وتطبيق pose/expression | غير موجود | adapter خلف port، lazy-load، وrenderer معزول |
| Animation Engine | idle/gesture/pose/body motion | غير موجود | deterministic clips أولًا، ثم controller دلالي محدود |
| Facial Rig | blend shapes/expressions/eyes/gaze | غير موجود | capability discovery من model، لا افتراض ARKit/Oculus |
| Lip Sync | viseme أو audio-driven mouth | غير موجود | timestamps/viseme إن توفرت، وإلا audio analysis bounded |
| TTS | النص إلى صوت | غير موجود | `VoiceProviderPort` اختياري مع text fallback |
| STT | الصوت إلى نص | غير موجود | worker/process محلي بعد permission وbenchmark |
| Wake Word | كشف عبارة تنبيه | غير موجود | opt-in فقط، offline preferred، model license مستقل |
| Agent Brain | القرار، الذاكرة، السياسة، Human Gate | Agent Runtime وSecond Brain موجودان بحدود مثبتة | Avatar يستهلك state ولا ينفذ tools أو approvals |
| Desktop Overlay | نافذة companion خارج workspace | غير موجود | نافذة Electron مستقبلية منفصلة وقابلة للتعطيل |

> **قاعدة السلطة:** Avatar يقدّم حالة مرئية/مسموعة للوكيل ولا يملك tool authority أو approval authority أو صلاحية تعديل Memory أو تنفيذ ملف أو commit أو push.

## مصادر ومشاريع مرشحة

### `pixiv/three-vrm` — runtime/loader مرن

المستودع MIT وTypeScript، ويعرّف استخدام VRM على Three.js، وقد أظهر GitHub API في تاريخ الفحص نشاطًا حديثًا وأكثر من ألفي نجمة. هذه حقائق **CONFIRMED** من المصدر [1]. هو طبقة runtime/loader لا character model ولا صوتًا ولا wake word. ينسجم مع Electron/WebGL نظريًا، لكن توافق إصدار Three.js، حدود WebGL، model complexity، والإطارات والذاكرة على Ubuntu 8GB تبقى **UNKNOWN** إلى benchmark.

### `met4citizen/TalkingHead` — مرشح خفيف لتجربة browser-based

README يصف JavaScript class يستخدم Three.js/WebGL، ويقبل full-body GLB وMixamo FBX، مع rig وARKit/Oculus viseme blend shapes، وتكامل TTS خارجي عبر word-level timestamps أو viseme data، وترخيص MIT وإصدار v1.7 ظاهرًا في صفحة GitHub [2]. هذا يجعله مرشحًا قويًا للـprototype، لا قرارًا نهائيًا؛ الـREADME لا يثبت lip-sync عربيًا أو دعم لهجة يمنية، والأمثلة الافتراضية تستخدم خدمات TTS خارجية. تصنيفه التجاري للكود جيد مبدئيًا، أما model/voice/animation asset فمستقل.

### `k2-fsa/sherpa-onnx` — منصة صوت محلية متعددة الوظائف

الوثائق الرسمية تذكر معالجة محلية دون Internet أثناء التعرف، ONNX/ONNX Runtime، Linux CPU/GPU وWindows وmacOS وWebAssembly، وواجهات متعددة تشمل Node وRust وC#، إضافة إلى streaming ASR وVAD وkeyword spotting وTTS [5]. ترخيص المستودع Apache-2.0 حسب GitHub API. هذا **CONFIRMED** على مستوى framework، لكنه لا يثبت أن كل Arabic model أو TTS أو keyword model تجاري؛ تصنيف النماذج يبقى `REQUIRES ARTIFACT REVIEW`.

### `ggml-org/whisper.cpp` و`SYSTRAN/faster-whisper` — STT لا Avatar

`whisper.cpp` MIT/C++ ويعرض CPU-only وquantization وVAD وC API وLinux/Windows/WebAssembly targets [4]. `faster-whisper` MIT وPython؛ metadata موثق في `research/voice-metadata-2026-08-22.md`. كلاهما مرشح **STT worker** وليس runtime للشخصية. وجود العربية كلغة عامة في Whisper لا يثبت WER مناسبًا للهجة اليمنية؛ يلزم corpus محلي بموافقة المتحدثين، وقياس p50/p95 وRSS وfalse segmentation.

### `dscripka/openWakeWord` — code مناسب مبدئيًا، النماذج الجاهزة غير تجارية

README الرسمي يفصل بين Apache-2.0 للكود وCC BY-NC-SA 4.0 للنماذج pretrained بسبب بيانات التدريب [6]. Creative Commons يوضح منع الاستخدام التجاري وشرط ShareAlike [16]. النتيجة **CONFIRMED**: لا يجوز اعتماد النماذج الجاهزة كأساس تجاري. يمكن دراسة الإطار أو نموذج جديد بترخيص واضح، لكن لا يُفعّل الاستماع الدائم، ولا يتجاوز push-to-talk الافتراضي أو mute/delete/indicator.

### Coqui XTTS-v2 وPiper — مسار TTS يحتاج تدقيقًا عربيًا وقانونيًا

توثيق XTTS الرسمي يذكر العربية ضمن اللغات وvoice cloning وstreaming، لكنه يذكر CPML للنموذج [7]. رابط CPML الذي يشير إليه README أعاد 404 في جلسة الفحص؛ لذلك لا يصنّف XTTS تجاريًا آمنًا، ولا يجوز استخدام voice cloning دون consent وlegal review. توثيق Piper في sherpa-onnx يذكر أكثر من 30 لغة وروابط لأصوات Hugging Face وreleases [8]، لكنه لا يمنح ترخيصًا موحدًا لكل voice. مستودع Piper القديم ظهر archived في GitHub API؛ لذلك يجب تقييم كل voice/model artifact، ولا يعلن دعمًا يمنيًا.

### Live2D وGodot — بدائل مقارنة لا اعتماد حالي

Live2D Cubism SDK متاح للتجربة دون تكلفة أولية، لكن الصفحة الرسمية تنص على اتفاقية نشر وترخيص Publication License ودفع عند نشر المحتوى، مع إعفاءات محددة [10]. لذلك ليس open-source commercial-safe runtime. Godot MIT ومتعدد المنصات و2D/3D [11]، لكن إدخال engine مستقل إلى Electron يوسع footprint ويغيّر runtime؛ يبقى خيارًا عالي الواقعية مستقلًا يحتاج قرارًا منفصلًا، لا اقتراحًا لتغيير Architecture الحالية.

### MuseTalk وLivePortrait — target high-realism اختياري

MuseTalk يذكر 30fps+ على NVIDIA Tesla V100 [14]، وLivePortrait يعتمد على pretrained weights وPython/CUDA [15]. هذه **CONFIRMED** كأرقام/متطلبات معلنة من المشاريع، لكنها ليست قياسات على أجهزة Ubuntu 8GB، ولا تثبت أنهما منخفضا الموارد أو interactive full-body runtimes. MuseTalk يحتاج artifact-level license review، وLivePortrait يحتاج مراجعة واضحة لـweights وInsightFace قبل الاستخدام التجاري. كلاهما لا يدخل MVP ولا renderer ولا startup.

## بطاقة المقارنة التقنية

| الحل/الدور | الترخيص | Language/engine | Model size | Realism | Motion/face/lip | Web/Electron | CPU/GPU/RAM | Offline | المخاطر/الملاءمة |
|---|---|---|---|---|---|---|---|---|---|
| `three-vrm` + GLB/VRM | MIT للكود؛ asset منفصل | TypeScript/Three.js/WebGL | غير موحد؛ يعتمد على model | متوسطة إلى عالية حسب asset | VRM features بحسب model؛ لا TTS/STT | WebGL مناسب نظريًا؛ Electron قابل | GPU اختياري؛ RAM/VRAM غير مثبتة | نعم للعرض | أفضل seam للمشروع، لكن لا model ولا audio |
| `TalkingHead` | MIT للكود؛ model/voice منفصل | JavaScript/Three.js | غير موحد | جيدة للـbrowser talking head | body + expressions + timestamp/viseme lip-sync؛ العربية غير مثبتة | Browser-first؛ Electron محتمل | benchmark غير موجود؛ WebGL | العرض محلي؛ TTS الافتراضي قد يكون cloud | أفضل lightweight prototype، external TTS risk |
| `sherpa-onnx` | Apache-2.0 للكود؛ models منفصلة | C++/ONNX، APIs متعددة | model-dependent | لا ينطبق كAvatar | VAD/STT/TTS/KWS، لا body | Node/WebAssembly/desktop docs | CPU/GPU modes؛ RAM model-dependent | موثق محليًا | صوت modular قوي، لا يدير الشخصية وحده |
| `whisper.cpp` | MIT للكود؛ weights منفصلة | C++/ggml | model-dependent/quantized | لا ينطبق | STT + VAD؛ لا TTS/avatar | Linux/Windows/WASM | CPU-only مدعوم؛ RAM يعتمد على model | نعم | مرشح STT worker، العربية/اللهجة benchmark |
| `openWakeWord` | Apache-2.0 code؛ CC BY-NC-SA models | Python/ONNX/TFLite | model-dependent | لا ينطبق | wake phrase فقط | يحتاج bridge/process | performance tools موجودة؛ device benchmark مطلوب | نعم | pretrained models non-commercial؛ لا always-on default |
| `XTTS-v2` | CPML للنموذج؛ code repo MPL-2.0 | Python/neural TTS | غير موثق هنا؛ يعتمد على model | جودة صوت محتملة | TTS/voice clone؛ lip-sync timestamps غير مضمون | process/service لا renderer | resource-heavy محتمل؛ benchmark مطلوب | ممكن محليًا | Arabic language confirmed، commercial status unclear |
| Piper voices | code repo MIT/archived؛ voice-specific | native/ONNX via sherpa | voice-dependent | خفيفة محتملًا | TTS، viseme support غير موحد | process/Node bridge محتمل | candidate low-resource؛ لا قياس لهذا الجهاز | نعم | كل صوت license منفصل؛ Arabic quality unknown |
| Live2D Cubism | proprietary/custom publication | 2D SDK | asset-dependent | عالية 2D | facial/physics قوي؛ TTS/STT خارجي | SDK integration | lightweight محتملًا | ممكن | نشر تجاري يتطلب شروطًا؛ ليس OSS |
| Godot + VRM addon | Godot MIT؛ addon/model منفصل | GDScript/C++/engine | engine + asset | عالية عند ضبط asset | animation/facial حسب addon | ليس Electron-native | footprint/engine overhead غير مقاس | نعم | engine change غير مقبول في هذه الدراسة |
| MuseTalk | code/weights/artifacts تحتاج تدقيقًا | Python/PyTorch/CUDA | غير موثق هنا | عالية portrait | audio-driven lip-sync؛ ليس body runtime | service/video pipeline | 30fps+ على V100 معلن؛ ليس 8GB | نعم بعد weights | high-realism optional، GPU/process isolation |
| LivePortrait | repo/weights/third-party منفصلة | Python/PyTorch/CUDA | غير موثق هنا | عالية portrait | portrait animation؛ ليس full avatar runtime | service/video pipeline | GPU-oriented؛ ليس low-memory baseline | نعم بعد weights | commercial/InsightFace review، لا MVP |

## Top-5 Scoring من 100

الأوزان مفروضة في الملحق: Realism 20، Animation 15، Lip Sync 10، Voice 10، Arabic 10، Performance 10، Cross-platform 5، Offline 5، Programmability 5، License 5، Integration 5. الأرقام التالية **تقدير قرار معماري** لا benchmark؛ استندت إلى الأدلة المتاحة، وخُفّضت عند `UNKNOWN` بدل تحويل المجهول إلى حقيقة. الثقة تعبّر عن ثبات التقدير، لا عن جودة المنتج.

| الترتيب | الحل المقارن | Realism 20 | Animation 15 | Lip Sync 10 | Voice 10 | Arabic 10 | Perf 10 | Cross 5 | Offline 5 | Prog 5 | License 5 | Integration 5 | المجموع | Score confidence |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | `three-vrm` + `sherpa-onnx` + adapters | 15 | 13 | 8 | 6 | 5 | 7 | 5 | 5 | 5 | 4 | 4 | **77** | متوسط |
| 2 | `TalkingHead` + `three-vrm`/GLB | 15 | 13 | 8 | 7 | 3 | 8 | 5 | 2 | 5 | 4 | 5 | **75** | متوسط |
| 3 | Live2D Cubism SDK | 16 | 14 | 7 | 8 | 5 | 9 | 4 | 3 | 4 | 1 | 4 | **75** | منخفض–متوسط |
| 4 | Godot + VRM addon | 17 | 14 | 6 | 6 | 4 | 4 | 5 | 4 | 4 | 4 | 1 | **69** | منخفض |
| 5 | LivePortrait/MuseTalk high-realism service | 20 | 9 | 10 | 6 | 4 | 1 | 2 | 3 | 3 | 2 | 1 | **61** | منخفض |

التفسير: المركز الأول ليس ادعاء أن `sherpa-onnx` يرسم Avatar؛ إنه stack modular يجمع renderer مرشحًا مع صوت مرشح. المركز الثاني أفضل بداية خفيفة لأن TalkingHead يملك body/face/lip seams جاهزة، لكنه يخسر في Arabic/offline بسبب اعتماد الأمثلة على TTS خارجي وعدم ثبوت العربية. Live2D يحصل على performance جيد تقنيًا لكنه يخسر license. Godot يملك قدرات محرك واسعة لكنه يخسر integration وfootprint. LivePortrait/MuseTalk يفوزان في portrait realism/lip-sync فقط، لا في تكامل Second Brain أو low-memory.

## أفضل استخدام لكل فئة

| الفئة | النتيجة | سبب القرار | درجة اليقين |
|---|---|---|---|
| BEST OVERALL | `three-vrm` + `sherpa-onnx` خلف ports | modular وlocal-first وقابل للفصل | STRONG INFERENCE |
| BEST LIGHTWEIGHT | `TalkingHead` أو minimal `three-vrm` مع static/low-poly fallback | Browser/WebGL وبدون engine جديد | STRONG INFERENCE |
| BEST REALISTIC | LivePortrait/MuseTalk كخدمة اختيارية مع GPU | portrait realism أعلى حسب الأدلة المعلنة | CONFIRMED capability، UNKNOWN product fit |
| BEST OPEN-SOURCE | `three-vrm`/TalkingHead للكود، لا للأصول تلقائيًا | MIT code مع asset-specific review | CONFIRMED code license |
| BEST FOR OFFLINE | `whisper.cpp` أو `sherpa-onnx` لـSTT؛ Piper model-by-model لـTTS | local execution موثق | متوسط |
| BEST FOR DESKTOP | إبقاء Electron ثم BrowserWindow overlay مستقبلي | لا تغيير shell الحالي | STRONG INFERENCE |
| BEST FOR ARABIC | لا اختيار نهائي؛ XTTS يثبت لغة العربية فقط، وsherpa/Piper يحتاجان model benchmark | لا دليل على اليمنية | UNKNOWN/NOT VERIFIED |
| BEST COMMERCIAL-FRIENDLY | MIT/Apache code بعد notices؛ لا voice/model نهائي بعد | model/voice provenance غير مكتمل | متوسط للكود، منخفض للأصول |

## الحكم المرحلي

`three-vrm` و`TalkingHead` مرشحان للدراسة التنفيذية لاحقًا، لكن لا يُضاف أي منهما الآن. `sherpa-onnx` و`whisper.cpp` مرشحان كخدمات صوتية معزولة، و`openWakeWord` لا يُقبل بنموذجه الجاهز بسبب NC-SA. لا يُقترح Live2D أو Godot أو high-realism portrait كاعتماد MVP. يجب أن يظل **text fallback** كامل الوظيفة حتى عند غياب WebGL أو model أو mic أو TTS.

## References

[1]: https://github.com/pixiv/three-vrm "pixiv/three-vrm"
[2]: https://github.com/met4citizen/talkinghead "met4citizen/TalkingHead"
[3]: https://github.com/vrm-c/vrm-specification "VRM specification"
[4]: https://github.com/ggml-org/whisper.cpp "ggml-org/whisper.cpp"
[5]: https://k2-fsa.github.io/sherpa/onnx/ "sherpa-onnx documentation"
[6]: https://github.com/dscripka/openWakeWord "dscripka/openWakeWord"
[7]: https://github.com/coqui-ai/TTS/blob/dev/docs/source/models/xtts.md "Coqui XTTS documentation"
[8]: https://k2-fsa.github.io/sherpa/onnx/tts/piper.html "Piper in sherpa-onnx documentation"
[9]: https://www.electronjs.org/docs/latest/api/browser-window "Electron BrowserWindow API"
[10]: https://www.live2d.com/en/sdk/license/ "Live2D Cubism SDK license"
[11]: https://github.com/godotengine/godot "Godot Engine"
[12]: https://vroid.com/en/studio/guidelines "VRoid Studio Guidelines"
[13]: https://github.com/M3-org/CharacterStudio "M3-org/CharacterStudio"
[14]: https://github.com/TMElyralab/MuseTalk "MuseTalk"
[15]: https://github.com/KlingAIResearch/LivePortrait "LivePortrait"
[16]: https://creativecommons.org/licenses/by-nc-sa/4.0/ "CC BY-NC-SA 4.0"
[17]: https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html "Adobe Mixamo FAQ"
[18]: https://github.com/SYSTRAN/faster-whisper "SYSTRAN/faster-whisper"
[19]: https://github.com/snakers4/silero-vad "snakers4/silero-vad"
