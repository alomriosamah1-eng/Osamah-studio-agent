# معمارية Virtual Human Assistant / AI Avatar

**الحالة:** تصميم مستقبلي موثق فقط. لا تُنفذ هذه الوثيقة أي runtime أو IPC أو نافذة أو صوت أو model.
**الموضع المنتجـي:** Second Brain، مع امتداد اختياري إلى Desktop Companion.
**المبادئ الملزمة:** local-first، Clean Architecture، typed IPC، Human Gate، default-deny، قابلية التعطيل، وعدم تجميد Workspace على Ubuntu بذاكرة 8GB.

## قرار المعمارية

لا يُعامل Avatar على أنه Agent جديد أو نموذج واحد شامل. الترتيب الصحيح هو:

```text
Osamah Studio Agents
        │
        ├── Agent Runtime + Human Gate + Policy
        │             │  sanitized AgentState / cues only
        │             ▼
        │        Avatar Controller
        │          ├── Character Profile Registry
        │          ├── Animation Controller
        │          ├── Facial Controller
        │          ├── Lip Sync Controller
        │          └── Voice Session Coordinator
        │                    ├── TTS Provider (optional worker)
        │                    ├── Audio Output (OS boundary)
        │                    ├── STT Provider (optional worker)
        │                    └── Wake Word Provider (opt-in worker)
        │
        └── Second Brain (scoped memory / review / provenance)
                         │
                         └── avatar context is read-only, scoped, consented

Desktop Overlay (future, separate Electron BrowserWindow)
        ▲
        └── Overlay Presenter ← Avatar Controller events only
```

يجب أن تبقى `Agent Runtime` و`Second Brain` مصدر الحقيقة للحالة والسياسة. `Avatar Controller` يحول الحالة إلى cues بصرية/صوتية، ولا يستقبل tool request أو approval decision من الشخصية. أي فعل حساس يمر بالـHuman Gate الموجود أصلًا، ويظل approval ظاهرًا نصيًا حتى لو فُعل TTS أو overlay.

## مواضع الدمج مع المشروع الحالي

الدمج المستقبلي يكون عبر ports في Application وadapters في Infrastructure/Presentation، لا عبر import مباشر من renderer إلى مكتبة أو نموذج. هذه خريطة تصميمية وليست قائمة ملفات يجب إنشاؤها الآن:

| المجال | موضع مقترح لاحقًا | سبب الدمج | ما لا يجب فعله الآن |
|---|---|---|---|
| Avatar orchestration | `src/application/avatar-controller.ts` أو port مكافئ | يستهلك AgentState ويصدر cues bounded | لا إنشاء الملف أو تعديل `composition.ts` في الدراسة |
| Avatar contracts | `src/application/avatar-contracts.ts` وامتداد typed IPC لاحقًا | schemaVersion وevents وcapabilities | لا توسعة `src/ipc/contracts.ts` الآن |
| Runtime renderer | `src/presentation/avatar-runtime/*` أو adapter مستقل | عزل Three.js/VRM/WebGL عن Domain | لا إضافة dependency أو assets |
| Character profiles | Application port + profile metadata، وربط لاحق بـAsset Catalog | provenance/license/appearance/gender | لا تخزين model أو voice weights في Git |
| TTS/STT/Wake | Infrastructure worker/process adapters | عزل native/ONNX/Python وlimits | لا تثبيت toolchain أو model |
| Agent integration | read-only projection من `agent-runtime.ts` | لا منح Avatar سلطة تنفيذ | لا تغيير Agent Runtime الحالي |
| Second Brain | scoped read-only memory context | لا كشف entries غير مؤكدة أو حساسة | لا ربط Avatar بالتخزين الآن |
| Overlay | `src/desktop/*` future BrowserWindow factory | نافذة منفصلة قابلة للتعطيل | لا إنشاء نافذة transparent الآن |
| Settings | future schema امتداد `application-settings.ts` | إعدادات مستقلة وArabic-first | لا إضافة خصائص Avatar حاليًا |

## State Machine

الحالات المرئية المقترحة هي projection لحالات الوكيل والصوت، وليست حالات صلاحية تنفيذ. تبدأ الخدمة `DISABLED` أو `IDLE`، وتُسقط إلى `DEGRADED` عند غياب WebGL أو model أو TTS. الحالات الأساسية هي `IDLE`, `LISTENING`, `THINKING`, `PROCESSING`, `SPEAKING`, `EXPLAINING`, `CONFIRMING`, `SUCCESS`, `WARNING`, `ERROR`, `GOODBYE`, `PAUSED`, و`DEGRADED`.

| الحالة | سبب الدخول | السلوك المسموح | الخروج الآمن |
|---|---|---|---|
| `DISABLED` | المستخدم عطّل Avatar أو policy تمنعه | لا render ولا mic ولا audio | `avatar.enable` بعد consent إلى `IDLE` |
| `IDLE` | لا توجد جلسة نشطة | idle animation منخفضة أو static portrait | event جلسة/إدخال إلى `LISTENING` أو `THINKING` |
| `LISTENING` | push-to-talk أو wake word opt-in اكتشف trigger | indicator واضح؛ لا حفظ raw audio | release/timeout إلى `THINKING` أو `IDLE` |
| `THINKING` | النص وصل إلى Agent Runtime | حركة انتظار بلا ادعاء أن tool اكتمل | أول delta إلى `PROCESSING` أو response إلى `SPEAKING` |
| `PROCESSING` | agent يعمل أو provider ينتظر | busy cue؛ لا إعلان نجاح | progress إلى `EXPLAINING`/`SPEAKING` أو `CONFIRMING` |
| `SPEAKING` | audio playback بدأ | mouth/viseme مع bounded timing | end إلى `IDLE` أو interruption إلى `LISTENING` |
| `EXPLAINING` | رد طويل/شرح أو عرض Memory review | gesture/face دون تنفيذ | complete إلى `IDLE` أو `CONFIRMING` |
| `CONFIRMING` | Human Gate مطلوب | تعبير انتظار، ويظهر النص وقرار الموافقة | approved إلى `PROCESSING`، denied/expired إلى `WARNING` |
| `SUCCESS` | نتيجة مثبتة من runtime | cue احتفالي محدود | timeout إلى `IDLE` |
| `WARNING` | fallback، partial، stale أو denied | cue واضح ومحايد | acknowledge إلى `IDLE` أو retry إلى `PROCESSING` |
| `ERROR` | فشل provider/runtime/policy | لا loop ولا إعادة محاولات غير محدودة | recover إلى `DEGRADED` أو `IDLE` |
| `GOODBYE` | إغلاق session أو stop | يوقف الصوت والـmic | `DISABLED` أو `IDLE` |
| `PAUSED` | المستخدم mute/pause أو resource governor | لا صوت/ميك؛ static only | resume صريح إلى الحالة الآمنة |
| `DEGRADED` | WebGL/model/worker غير متاح | static portrait/text-only، لا crash | recovery صريح أو `DISABLED` |

الانتقالات لا تُسمح مباشرة من `IDLE` إلى `SUCCESS` أو من `LISTENING` إلى `SUCCESS` دون evidence من Agent Runtime. ويجب قطع TTS عند `barge-in` أو `mute` أو `Human Gate` جديد. لا تعرض الشخصية عبارة «تم التنفيذ» لمجرد أن agent أرسل `ToolStarted`؛ النجاح يحتاج `ToolCompleted` موثقًا أو نتيجة review.

## Event/API contract design

هذه عقود تصميمية مستقبلية بصيغة وصفية. عند التنفيذ يجب تحويلها إلى runtime validators typed، ويجب أن يفشل IPC مغلقًا عند `schemaVersion` غير مدعوم أو payload زائد أو session غير مطابق.

### Agent Runtime إلى Avatar Controller

| الحدث | الحقول الضرورية | الدلالة | ممنوعات |
|---|---|---|---|
| `agent.state.changed` | `eventId`, `schemaVersion`, `sessionId`, `turnId`, `state`, `reason`, `sequence`, `occurredAt` | تحديث projection للحالة | secrets، full prompt، tool args |
| `agent.text.delta` | `sessionId`, `turnId`, bounded `text`, `final`, `language` | نص للعرض أو TTS بعد policy | transcript غير محدود أو raw files |
| `agent.action.pending` | `actionId`, `label`, `risk`, `requiresApproval` | ينتقل غالبًا إلى `CONFIRMING` | approval token أو execute command |
| `human-gate.required` | `ticketId`, `summary`, `scope`, `expiresAt` | انتظار موافقة مرئية | لا يمكن Avatar حل التذكرة |
| `agent.result.confirmed` | `actionId`, `status`, `summary`, `evidenceRef` | يسمح `SUCCESS` أو `WARNING` | لا قبول status غير متحقق |
| `agent.error` | `sessionId`, `code`, safe `message`, `retryable` | `ERROR`/`WARNING` | stack trace أو secret |

### Audio/Avatar إلى Agent Runtime

| الحدث | الحقول الضرورية | السياسة |
|---|---|---|
| `voice.permission.changed` | permission state، source، timestamp | لا mic قبل `granted` الصريح |
| `voice.input.started/stopped` | session، duration bounded، reason | push-to-talk افتراضي؛ بلا raw audio |
| `stt.partial/final` | text bounded، language، confidence optional، source policy | يمر كمدخل نصي لا كتعليمات موثوقة |
| `wake.triggered` | wake model id، phrase label، confidence، consent version | لا يفعّل إلا إذا opt-in وmodel policy صالح |
| `voice.playback.started/ended/interrupted` | turn، voiceProfileId، reason | يدير lip-sync وbarge-in |

### Avatar Controller إلى renderer/overlay

| الحدث | الحقول الضرورية | الغرض |
|---|---|---|
| `avatar.state` | `state`, `characterId`, `capabilities`, `degradedReason` | الحالة الحالية |
| `avatar.motion.cue` | `cueId`, `name`, `intensity`, `durationMs`, `interruptible` | gesture/pose bounded |
| `avatar.face.cue` | `expression`, `gaze`, `intensity`, `durationMs` | facial/eyes bounded |
| `avatar.lipsync.cue` | `source`, `phonemeOrViseme`, `offsetMs`, `durationMs` | لا يحتوي audio buffer |
| `avatar.render.policy` | fps cap، quality، visibility، reducedMotion | governor وdegradation |
| `overlay.visibility` | visible، mode، userInitiated | فصل overlay عن Agent authority |

### Future allowlisted IPC surface

السطح المحتمل هو `avatar.getCapabilities`, `avatar.getState`, `avatar.configure`, `avatar.setVisibility`, `avatar.subscribe`، و`voice.getProfiles`, `voice.preview`, `voice.setProfile`, `voice.permission`، و`wake.getStatus`, `wake.configure`, `wake.setEnabled`، و`overlay.getStatus`, `overlay.configure`, `overlay.setVisibility`. كل method يحتاج sender validation وpayload bounds وaudit عند permission/overlay startup، ولا يُسمح بسطح عام مثل `avatar.executeTool` أو `avatar.loadRemoteScript`.

## Recommended Stack

### مستوى Prototype منخفض الموارد

| الطبقة | التوصية المؤجلة | سبب الاختيار | شرط القبول قبل التنفيذ |
|---|---|---|---|
| Character Model | GLB/VRM low-poly أصلي أو asset موثق | قابلية الاستبدال، حجم أقل | provenance/license/model bounds |
| Avatar Runtime | تقييم `three-vrm` أولًا، و`TalkingHead` كprototype alternative | WebGL/Three.js وملاءمة Electron دون engine جديد [1] [2] | load/unload وframe/RSS benchmark |
| Animation | baked idle/gesture clips وstate-driven controller | deterministic وCPU أقل من tracking | no jank وinterruptible cues |
| Facial/Eyes | capabilities من rig، look-at اختياري | لا افتراض ARKit/Oculus أو eye tracking | fallback neutral/static |
| Lip Sync | viseme/timestamp إذا وفرها TTS؛ وإلا amplitude بسيط | لا يحتاج STT أو model ثقيل | timing test وbarge-in |
| TTS | local provider خلف process؛ Piper voice بعد legal/model review | offline-first محتمل | Arabic/English benchmark وlicense |
| STT | `whisper.cpp` أو `sherpa-onnx` خلف process | CPU/local/VAD/stream seams [4] [5] | WER/latency/RSS على الجهاز |
| Wake Word | disabled في prototype | الخصوصية والترخيص | لا يفتح إلا بعد custom model/license |
| Agent Brain | Agent Runtime الحالي read-only projection | لا صلاحية جديدة | Human Gate remains authoritative |
| Overlay | غير موجود في prototype | منع التعقيد | Workspace panel أولًا |
| Communication | typed IPC + bounded event bus لاحقًا | ينسجم مع المشروع | validators/no secret/no raw audio |

### مستوى Target High-Realism اختياري

يحافظ هذا المستوى على نفس العقود، لكنه يسمح بrenderer أو service منفصل للأصول عالية التعقيد. يمكن تقييم LivePortrait أو MuseTalk للـportrait/lip-sync، أو Godot/Live2D كمسار مستقل، لكن لا يجوز افتراض أن أي منها full-body interactive runtime أو أن أداءه مناسب لـ8GB. يعزل المسار في child process/service، ويُعطّل تلقائيًا عند تجاوز resource budget، ويعود إلى low-poly/static/text. هذا **مسار اختياري لا يغيّر Electron shell ولا يُبرر تغيير Architecture الحالية قبل benchmark**.

### Degradation ladder

```text
Avatar disabled / text-only
        ↓
Static portrait + state indicator
        ↓
Lightweight 2D أو low-poly VRM/GLB
        ↓
Full 3D facial/gesture runtime
        ↓
Optional high-realism portrait service (GPU/process isolated)
```

لا يحق للمسار الأعلى إلغاء المسار الأدنى. إذا فشل WebGL أو TTS أو worker أو permission، يبقى Second Brain وAgent Runtime قابلين للاستخدام نصيًا.

## Performance Budget مقترح

الأرقام التالية **أهداف قبول مستقبلية وليست قياسات Avatar**. خط الأساس الحالي للمشروع هو RSS idle أقل من 500MB دون model، مع resource policy وV8 heap smoke قائمين في `docs/18-performance-engineering.md`. يجب القياس على Ubuntu 8GB الحقيقي قبل أي قرار تنفيذ؛ ولا يجوز تفسير هذه الأهداف على أنها ضمان لتشغيل model محلي كبير.

| المورد | Static/text | Low-poly 3D | Full 3D / optional service | إجراء التجاوز |
|---|---:|---:|---:|---|
| Avatar renderer RSS delta | ≤80MB | ≤180MB | ≤300MB أو process منفصل | static ثم disable |
| Asset/texture budget | ≤32MB | ≤128MB | خارج low-memory profile | تخفيض الجودة/إخلاء cache |
| Audio worker RSS دون model | ≤64MB | ≤96MB | process منفصل | إيقاف الصوت والعودة للنص |
| model memory | 0 | model manifest مطلوب | لا رقم قبل benchmark | لا تحميل إذا تجاوز estimate |
| foreground frame target | غير منطبق | 30fps، p95 frame ≤33ms | 24–30fps اختياري | خفض FPS/quality ثم static |
| concurrent audio/model workers | 0 | worker واحد | worker واحد لكل service | queue=1 وbackpressure |
| startup model loading | ممنوع | ممنوع | ممنوع | lazy-load بعد opt-in |

بوابة القبول المستقبلية تشمل: لا زيادة خطرة في idle RSS، لا UI freeze أثناء load/unload، عدم تشغيل STT وTTS وhigh-realism service بالتوازي في low-memory profile، timeout وAbortController لكل worker، cleanup للـAudioContext/listeners/file descriptors، وkill/restart للـworker دون إغلاق renderer. إذا تجاوز frame p95 حد 33ms أو زاد RSS عن الميزانية في تشغيلين متتاليين، يُفعّل degradation ladder ويُسجل regression. لا توجد نتائج فعلية لهذه القياسات في هذه الدراسة.

## VoiceProfile وgender/dialect policy

`VoiceProfile` كيان إعداد/metadata مستقبلي، لا يساوي ملف صوت أو weights:

| الحقل | القاعدة |
|---|---|
| `voiceProfileId` | معرف غير سري وثابت داخل profile |
| `voiceModelId` | model/provider id مع version وlicenseRef |
| `language` | `ar` أو `en` أو لغة موثقة فقط |
| `dialect` | `standard-ar`, `unknown`, أو tag موثق؛ لا `yemeni` بلا benchmark |
| `declaredGender` | `male`, `female`, `neutral`, `unspecified` كصفة تفضيلية لا حكم هوية |
| `genderOverride` | يسمح فقط عند اختيار المستخدم الصريح مع إظهار عدم التطابق |
| `speed/pitch/style/volume` | قيم bounded مع default محايد |
| `offlineCapable` | evidence من provider/model، لا افتراض |
| `consentRef` | إشارة إلى consent دون حفظ raw audio داخل العقد |
| `licenseRef/provenance` | source/model/voice asset وشروطه |
| `fallbackProfileId` | fallback نصي أو صوت مدقق |

لا يُعد gender الخاص بالـAvatar ملزمًا لجنس الصوت. يسأل UX المستخدم صراحة عن الصوت ويفصل `character presentation` عن `voice profile`. لا تعلن الوثيقة دعم اللهجة اليمنية؛ ذلك `NOT VERIFIED` إلى أن توجد مجموعة جمل واقعية بموافقة أصحابها وقياس واضح.

## إعدادات مستقبلية مقترحة

تُضاف لاحقًا تحت أقسام منفصلة في Arabic-first Settings، مع default آمن: Avatar `disabled` أو `static`, microphone `off`, wake word `off`, overlay `off`, cloud voice `off`.

| القسم | أمثلة الإعدادات | الضابط |
|---|---|---|
| Avatar | enable، character، appearance، size، position، animation/gesture intensity، eye contact، reduced motion | لا load قبل enable؛ reduced motion يحترم إعداد النظام |
| Voice | profile، language، dialect tag، speed، pitch، volume، emotion، output device | consent وlicense/model status ظاهرين |
| Microphone | permission، push-to-talk key، mute indicator، delete temporary audio | لا always-listening افتراضيًا |
| Wake Word | enabled، phrase، alternatives، sensitivity، offline mode، model status | opt-in وmodel license check |
| Desktop Companion | enable، start with system، always-on-top، click-through، monitor، hide timeout | Human Gate/confirmation لـstartup persistence وclick-through |
| Privacy | raw audio retention، transcript retention، provider disclosure، clear session data | default zero raw-audio persistence |

## الخصوصية والأمان

الميكروفون لا يُطلب عند بدء التطبيق. المسار الافتراضي هو push-to-talk، ثم VAD محلي داخل جلسة قصيرة، ثم STT محلي إن أمكن. Wake word لا يعمل دائمًا افتراضيًا؛ عند تفعيله يجب أن يظهر indicator/mute control وأن تُحفظ فقط metadata الضرورية. لا يُرسل raw audio إلى cloud إلا بعد policy وconsent وdisclosure، ولا تُخزن التسجيلات الخام أو voice embeddings افتراضيًا. وظيفة delete يجب أن تشمل temporary buffers وtranscripts المخزنة وvoice cache وفق retention.

كل model أو voice أو character يخضع لـprovenance/license check. لا توضع user audio أو tokens أو model weights في Git أو logs أو prompts. overlay لا يقرأ الشاشة أو لوحة المفاتيح أو الحسابات الخارجية لمجرد ظهوره. ربط حساب، بدء تشغيل مع النظام، أو تغيير نافذة إلى always-on-top/click-through يحتاج تأكيدًا ظاهرًا وسياسة قابلة للإلغاء. أي memory context يصل إلى Avatar يجب أن يكون scoped وread-only ولا يمرر entries غير مؤكدة أو حساسة.

## Desktop Overlay — تحليل لا تنفيذ

Electron `BrowserWindow` يدعم خصائص ذات صلة مثل الشفافية، عزل السياق، sandbox، background throttling، offscreen، وواجهات always-on-top وignore-mouse-events [9]. لكن توثيق Electron يذكر قيود Wayland على الموضع والحجم والتركيز، لذلك لا يمكن إعلان cross-platform overlay قبل matrix فعلية على Ubuntu/X11 وWayland وWindows وmacOS.

القرار التصميمي المؤجل هو نافذة منفصلة least-privilege، transparent وframeless عند الحاجة، بحجم وموقع يختاره المستخدم، وبـalways-on-top وclick-through معطلين افتراضيًا. عند click-through يجب توفير زر/اختصار وصول دائم ومؤشر واضح حتى لا تصبح الشخصية غير قابلة للتحكم. يفضّل إيقاف animation عند hidden/occluded أو عند resource pressure؛ وتبقى Workspace panel هي fallback الرسمي.

## References

[1]: https://github.com/pixiv/three-vrm "pixiv/three-vrm"
[2]: https://github.com/met4citizen/talkinghead "TalkingHead"
[3]: https://github.com/vrm-c/vrm-specification "VRM specification"
[4]: https://github.com/ggml-org/whisper.cpp "whisper.cpp"
[5]: https://k2-fsa.github.io/sherpa/onnx/ "sherpa-onnx documentation"
[6]: https://github.com/dscripka/openWakeWord "openWakeWord"
[7]: https://github.com/coqui-ai/TTS/blob/dev/docs/source/models/xtts.md "XTTS-v2 documentation"
[8]: https://k2-fsa.github.io/sherpa/onnx/tts/piper.html "Piper documentation"
[9]: https://www.electronjs.org/docs/latest/api/browser-window "Electron BrowserWindow API"
[10]: https://creativecommons.org/licenses/by-nc-sa/4.0/ "CC BY-NC-SA 4.0"

إعداد: Manus AI. هذه الوثيقة لا تنفذ أي جزء من النظام.
