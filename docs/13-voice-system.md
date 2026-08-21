# نظام الصوت

## القرار

الصوت **ميزة اختيارية لا تدخل MVP الأساسي**. يبنى كـ provider abstraction يمر عبر pipeline: `capture → VAD → segmentation → STT → normalized text → agent → TTS → playback`, مع interruption وbarge-in. لا يطلب النظام microphone permission عند بدء التطبيق.

## الخيارات المفتوحة

| الوظيفة | المرشح | الاستخدام | الحكم |
|---|---|---|---|
| STT multilingual | Whisper | baseline واسع للعربية والإنجليزية | USE/benchmark |
| STT أسرع | faster-whisper | inference محلي بكفاءة أفضل محتملة | USE إذا نجح benchmark |
| VAD | Silero VAD | اكتشاف بداية/نهاية الكلام | USE DIRECTLY |
| TTS local | Piper | منخفض الموارد وقابل للتشغيل المحلي | USE بعد توفر صوت عربي مناسب |
| TTS عربي | ArTST/Klaam/نماذج عربية | بحث وتجارب ومقارنة جودة | RESEARCH/LEGAL CHECK |
| voice cloning | OpenVoice | تجربة opt-in فقط | خارج MVP، مراجعة موافقة وحقوق |

المشاريع المذكورة متاحة في GitHub، لكن وجود مستودع لا يعني جودة صوت أو حق استخدام تجاري. تحفظ كل تجربة مع model card وlicense وlanguage/dialect وWER/MOS أو مقياس بديل. [1] [2] [3] [4]

## العربية واللهجات

يدعم MVP العربية الفصحى والإنجليزية باعتبارهما acceptance targets، ويُجرى benchmark للهجات. لا يعلن دعم يمني إنتاجي قبل اختبار مجموعة جمل حقيقية بموافقة المتحدثين، وقياس أسماء الأشخاص والأماكن والسرعة والضوضاء. إذا لم ينجح النموذج المحلي، يستخدم النظام STT نصيًا أو provider اختياريًا مع disclosure.

## latency وresources

يجب أن يعمل VAD وsegmentation محليًا لتقليل التأخير والخصوصية. يفصل STT/TTS في worker process، ويحدد `max_audio_seconds`, `max_rtf`, `max_queue`, وGPU policy. streaming TTS قد يبدأ قبل اكتمال الرد، لكن لا يقرأ أفعالًا حساسة كأنها منفذة؛ النص النهائي يظهر قبل الإرسال الصوتي.

## interruption

عند بدء المستخدم الكلام، يرسل VAD `barge_in` ويوقف playback، ثم يحفظ ما قيل قبل قطع الصوت. لا يُفقد transcript. إذا كانت جملة TTS تحتوي approval أو commit، يجب أن يظل approval مرئيًا في UI.

## الخصوصية

الصوت raw data ephemeral افتراضيًا، ويُحذف بعد transcription ما لم يطلب المستخدم حفظه. التسجيل المحفوظ يملك source policy وencryption. لا يُفعّل voice cloning أو voice matching تلقائيًا. الرسائل الصوتية التي تُرسل إلى provider تحمل consent وprovider disclosure.

## معيار قبول الصوت

يُعتبر المسار صالحًا عندما ينجح في العربية والإنجليزية في بيئة هادئة وضوضائية، ويعرض latency p50/p95، ويوقف TTS عند interruption، ويحترم offline mode، ويحذف التسجيل المؤقت، ويكتب audit event للـ permissions.

## References / المراجع

[1]: https://github.com/openai/whisper "Whisper repository"
[2]: https://github.com/SYSTRAN/faster-whisper "faster-whisper repository"
[3]: https://github.com/rhasspy/piper "Piper repository"
[4]: https://github.com/snakers4/silero-vad "Silero VAD repository"
[5]: https://github.com/mbzuai-nlp/ArTST "ArTST repository"
[6]: https://github.com/ARBML/klaam "Klaam repository"
[7]: https://github.com/myshell-ai/OpenVoice "OpenVoice repository"

إعداد: Manus AI. تاريخ الفحص: 2026-08-21.
