# Virtual Human — التراخيص وخارطة الطريق وقرارات الاعتماد

**الحالة:** `DOCUMENTED ONLY / DEFERRED`. لا يوجد في هذه الشريحة code أو dependency أو model أو voice asset أو native toolchain.
**تاريخ الفحص:** 2026-08-22.
**قاعدة الامتثال:** ترخيص الكود لا يساوي ترخيص model/weights/voice/character/texture/animation. أي عنصر بلا نص ترخيص واضح يصنّف `UNCLEAR` ولا يدخل commercial build.

## License Matrix

| العنصر | المشروع/الأصل | الترخيص الذي تم التحقق منه | التصنيف التجاري المبدئي | قرار Osamah Studio Agents | الدليل/الفجوة |
|---|---|---|---|---|---|
| VRM runtime | `pixiv/three-vrm` | MIT للمستودع | COMMERCIAL-COMPATIBLE مع notices | `REFERENCE/FUTURE` ثم benchmark | [1]؛ asset منفصل |
| talking-head runtime | `met4citizen/TalkingHead` | MIT للمستودع | COMMERCIAL-COMPATIBLE للكود مع notices | `REFERENCE/FUTURE` | [2]؛ models/voices منفصلة |
| format/spec | `vrm-c/vrm-specification` | specification repo؛ لا يعادل asset license | UNCLEAR per asset | لا model redistribution بلا audit | [3]؛ VRM Public License/asset terms |
| creator/optimizer | `M3-org/CharacterStudio` | MIT للمستودع حسب GitHub | code compatible مبدئيًا | reference only؛ security review | [4]؛ لا embedding قبل history audit |
| 3D engine | Godot | MIT للمحرك | COMMERCIAL-COMPATIBLE للكود | comparison only | [5]؛ addon/model منفصل |
| 2D SDK | Live2D Cubism | Proprietary/custom publication terms | RESTRICTED/PAID-AT-PUBLISH | لا open-source dependency | [6]؛ يتطلب شروط نشر |
| STT engine | `ggml-org/whisper.cpp` | MIT للكود | COMMERCIAL-COMPATIBLE للكود | optional worker candidate | [7]؛ model artifact review |
| STT alternative | `SYSTRAN/faster-whisper` | MIT للكود | COMMERCIAL-COMPATIBLE للكود | optional worker candidate | [8]؛ model artifact review |
| audio/VAD | `snakers4/silero-vad` | MIT للمستودع | code candidate | optional after benchmark | [9]؛ model terms verify |
| unified speech framework | `k2-fsa/sherpa-onnx` | Apache-2.0 للمستودع | COMMERCIAL-COMPATIBLE للكود مع notices | optional process adapter | [10]؛ model-by-model |
| wake-word code | `dscripka/openWakeWord` | Apache-2.0 للكود | code compatible مبدئيًا | reference/custom-model only | [11]؛ pretrained models غير تجارية |
| wake-word pretrained models | included openWakeWord models | CC BY-NC-SA 4.0 | NONCOMMERCIAL/RESTRICTED | DO NOT EMBED في commercial build | [11] [12] |
| TTS framework | `coqui-ai/TTS` | MPL-2.0 للمستودع | code review required | reference only | GitHub API؛ model منفصل |
| TTS model | XTTS-v2 | CPML حسب docs | UNCLEAR/LEGAL REVIEW | لا التزام تجاري | [13]؛ رابط CPML أعاد 404 عند الفحص |
| TTS voices | Piper ecosystem | voice/model-specific؛ Piper repo القديم archived | UNCLEAR per voice | لا اختيار قبل model card | [14] |
| Arabic model | أي Arabic TTS/STT | غير موحد | NOT VERIFIED | لا إعلان دعم يمني | benchmark + provenance |
| portrait lip-sync | MuseTalk | repo/model/weights يحتاج artifact review | REQUIRES REVIEW | high-realism optional service | [15]؛ V100 claim ليس 8GB benchmark |
| portrait animation | LivePortrait | repo/weights/InsightFace terms متعددة | REQUIRES REVIEW | optional isolated service | [16] [17] |
| character assets | VRoid Studio provided content | commercial use مسموح ما لم توجد clauses خاصة | COMMERCIAL-PERMITTED-WITH-CLAUSES | asset registry + clauses | [18]؛ لا يشمل كل VRoid Hub |
| animations | Mixamo | Adobe proprietary service؛ الصفحة المفحوصة قديمة ولم تعرض التفصيل | NOT VERIFIED/STALE | لا اعتماد بلا current terms | [19] |
| desktop shell/overlay | Electron | MIT | COMMERCIAL-COMPATIBLE | existing shell؛ overlay future | [20] |

## قواعد قبول الأصول

قبل إدخال أي model أو voice أو character إلى build، يسجل النظام أو release manifest اسم الأصل، المصدر، version/commit، SHA-256، license URL، ملف notice، model card، حقوق dataset/voice، وقيود الاستخدام. لا يكفي أن يكون GitHub repository مشهورًا أو أن تكون licence badge ظاهرة. إذا كان الترخيص `NOASSERTION`, `CUSTOM`, `CPML`, `CC BY-NC-SA`, أو غير متاح، تبقى الحالة `REQUIRES LEGAL REVIEW` ولا تدخل التوزيع التجاري.

الأصوات المستنسخة أو datasets الصوتية تحتاج consent قابلًا للإثبات وسياسة حذف وحق سحب. لا تُخزن raw audio أو voice embeddings داخل Git أو logs أو prompts، ولا تُرسل إلى cloud provider من دون disclosure وموافقة. لا يُستخدم اسم/صورة شخص حقيقي أو voice clone بوصفه شخصية Osamah الرسمية بلا حقوق واضحة.

## Decision Log

| المعرّف | القرار | الحالة | السبب |
|---|---|---|---|
| `AV-001` | Avatar مستقبلي داخل Second Brain وليس Agent مستقلًا | ACCEPTED | يمنع تضخم الصلاحيات ويحافظ على Agent Runtime كمصدر الحقيقة |
| `AV-002` | فصل Character Model عن Runtime/Animation/Facial/Lip/TTS/STT/Wake/Overlay | ACCEPTED | اختلاف دورة الحياة والأداء والتراخيص |
| `AV-003` | لا تغيير لـElectron/TypeScript/typed IPC الآن | ACCEPTED | طلب المالك صريح؛ الدراسة تسبق التنفيذ |
| `AV-004` | Prototype يبدأ static/text أو low-poly WebGL، لا photorealism | PROPOSED | توافق low-memory وdegradation ladder |
| `AV-005` | `three-vrm`/TalkingHead مرشحان للـruntime، لا اعتماد نهائي | PROPOSED | دليل WebGL/VRM/lip seams جيد، لكن benchmark ناقص |
| `AV-006` | `sherpa-onnx`/`whisper.cpp` مرشحا صوت محلي process-isolated | PROPOSED | local/offline/platform evidence، مع model review |
| `AV-007` | openWakeWord pretrained models ممنوعة للتوزيع التجاري | ACCEPTED | CC BY-NC-SA 4.0 |
| `AV-008` | لا إعلان Arabic dialect/Yemeni support قبل benchmark | ACCEPTED | language support لا يثبت dialect quality |
| `AV-009` | microphone off وwake off وoverlay off افتراضيًا | ACCEPTED | privacy وresource guard |
| `AV-010` | overlay نافذة Electron منفصلة فقط بعد matrix X11/Wayland/Windows/macOS | PROPOSED | Wayland limitations وclick-through risks |
| `AV-011` | high-realism portrait service اختياري وخارج renderer | PROPOSED | GPU/RAM/latency وعدم التكافؤ مع full-body runtime |
| `AV-012` | أي model/voice/asset بلا provenance/license واضح لا يدخل build | ACCEPTED | supply-chain/legal safety |

## Roadmap 0–11 — بدون تنفيذ الآن

كل مرحلة أدناه **خطة مستقبلية**. `Files likely affected` أسماء محتملة فقط وليست تصريحًا بإنشائها في هذه الشريحة.

| المرحلة | Goal | Dependencies | Files likely affected | Risks | Acceptance Criteria مستقبلية |
|---|---|---|---|---|---|
| 0 — Research | تثبيت الأدلة، المقارنة، license cards، hardware baseline | الملحق، docs 13/18، repository audit | `docs/84–86`, `research/*`, `project/open-source-components.json` | stale license، unknown Arabic/dialect | كل claim مصنف ومصدره أولي، ولا dependency/code change |
| 1 — Prototype | عرض static portrait أو low-poly fixture داخل Second Brain | قرار مالك، `AvatarRuntimePort` design، text fallback | `src/presentation/avatar-runtime/*`, prototype panel، tests/docs | WebGL jank، asset leak | enable/disable، load/unload، no startup model load، text fallback، no mutation |
| 2 — Avatar Runtime | تحميل model قابل للاستبدال واكتشاف capabilities | prototype gate، asset provenance | runtime adapter، `avatar-contracts`، composition لاحقًا | VRM version/rig incompatibility، renderer crash | model invalid يفشل مغلقًا؛ renderer crash لا يغلق Workspace |
| 3 — TTS | صوت اختياري local-first بــVoiceProfile | runtime/state events، permission/privacy، model legal | `voice-contracts`، process adapter، settings/docs | model size، Arabic quality، rights، leakage | Arabic/English benchmark، stop/delete، text fallback، p50/p95 evidence |
| 4 — Lip Sync | ربط audio timestamps/visemes/fallback amplitude بالحركة | TTS output contract، rig capabilities | lip-sync adapter/tests | drift، missing visemes، CPU cost | sync error bound، interruption، no audio persistence |
| 5 — Agent Integration | إسقاط AgentState إلى cues دون authority | existing Agent Runtime/Human Gate | `avatar-controller`، typed event contract، UI | false success cues، prompt/tool leakage | `SUCCESS` فقط من confirmed result؛ no avatar execute path |
| 6 — Second Brain Integration | سياق ذاكرة scoped/read-only للشخصية | Memory Review، provenance، privacy policy | memory projection adapter، review UI/docs | sensitive/unconfirmed memory disclosure | لا يظهر إلا scope المسموح؛ delete/revoke يعمل؛ no consolidation by Avatar |
| 7 — Wake Word | wake phrase opt-in offline مع model licensed | microphone permission، custom/licensed model، VAD | wake adapter/process، settings/indicator/tests | always-listening، false triggers، noncommercial model | off by default، mute/indicator، false accept/reject benchmark، no raw audio retention |
| 8 — Desktop Overlay | companion window منفصلة قابلة للتعطيل | stable controller، Electron matrix، user consent | `src/desktop/overlay-*`, preload allowlist، docs | Wayland/X11، focus theft، click-through lockout | X11/Wayland/Windows/macOS matrix؛ always-on-top/click-through opt-in؛ kill switch |
| 9 — Performance Optimization | budget governor وdegradation ladder وworker isolation | stages 1–8 evidence، hardware baseline | benchmark harness، `resource-policy` extension، docs | swap/OOM، renderer jank، thermal | لا model startup؛ 30fps target low-poly أو graceful degrade؛ p95/RSS/CPU evidence |
| 10 — Cross-platform Testing | تحقق Linux/Windows/macOS وRTL/accessibility | stable feature set، CI runners/devices | CI workflows، compatibility matrix، docs | platform API differences، unavailable audio devices | clean install/offline/no-mic/overlay tests؛ no false native claim |
| 11 — Production Hardening | SBOM، notices، signatures، privacy UX، rollback | legal review، security gates، packaging | `project/open-source-components.json`, notices، release docs | license drift، supply-chain compromise، data retention | all assets hashed/licensed، secret scan، delete/export/rollback، owner sign-off |

## Minimum prototype path

المسار الأدنى المقترح هو `0 → 1 → 2 → 4 → 5` مع static/text fallback دائم. لا يبدأ بـmicrophone أو wake word أو cloud TTS أو Desktop Overlay. يمكن استخدام prerecorded/local test audio فقط بعد موافقة تنفيذ منفصلة وبخارج repository، على أن تُحذف الملفات المؤقتة ولا تُسجل في logs. إذا فشل WebGL أو asset load، يعرض Second Brain بطاقة نصية للحالة بدل تعطيل التطبيق.

## References

[1]: https://github.com/pixiv/three-vrm "three-vrm"
[2]: https://github.com/met4citizen/talkinghead "TalkingHead"
[3]: https://github.com/vrm-c/vrm-specification "VRM specification"
[4]: https://github.com/M3-org/CharacterStudio "CharacterStudio"
[5]: https://github.com/godotengine/godot "Godot Engine"
[6]: https://www.live2d.com/en/sdk/license/ "Live2D SDK license"
[7]: https://github.com/ggml-org/whisper.cpp "whisper.cpp"
[8]: https://github.com/SYSTRAN/faster-whisper "faster-whisper"
[9]: https://github.com/snakers4/silero-vad "Silero VAD"
[10]: https://github.com/k2-fsa/sherpa-onnx "sherpa-onnx"
[11]: https://github.com/dscripka/openWakeWord "openWakeWord README and license"
[12]: https://creativecommons.org/licenses/by-nc-sa/4.0/ "CC BY-NC-SA 4.0"
[13]: https://github.com/coqui-ai/TTS/blob/dev/docs/source/models/xtts.md "XTTS-v2 docs"
[14]: https://k2-fsa.github.io/sherpa/onnx/tts/piper.html "Piper docs"
[15]: https://github.com/TMElyralab/MuseTalk "MuseTalk"
[16]: https://github.com/KlingAIResearch/LivePortrait "LivePortrait"
[17]: https://github.com/KwaiVGI/LivePortrait/issues/548 "LivePortrait weights clarification"
[18]: https://vroid.com/en/studio/guidelines "VRoid Studio Guidelines"
[19]: https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html "Adobe Mixamo FAQ"
[20]: https://www.electronjs.org/docs/latest/api/browser-window "Electron BrowserWindow API"

إعداد: Manus AI. لا تمثل هذه الوثيقة موافقة قانونية؛ هي سجل هندسي أولي يتطلب legal review حيث أشير.
