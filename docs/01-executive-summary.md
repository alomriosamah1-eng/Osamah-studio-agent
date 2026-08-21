# الملخص التنفيذي

## الخلاصة

المشروع **قابل للتنفيذ تقنيًا** إذا عومل كمنصة سطح مكتب معيارية تُبنى على مراحل، لكنه غير قابل للتنفيذ بأمان إذا بدأ كمنتج شامل يحاول تشغيل 70 وكيلًا، وإنتاج فيديو، وإدارة Second Brain، والتكامل مع OpenTo، والأتمتة الذاتية في إصدار واحد. التوصية هي بناء نواة محلية صغيرة تثبت دورة: **workspace → context → plan → approved tool execution → artifact → indexed memory**، ثم إضافة البيئات الثلاث فوق هذه الدورة.

| محور | النتيجة | الثقة |
|---|---|---:|
| الجدوى التقنية | 4/5؛ التقنيات متاحة، وأكبر مجهول هو OpenTo | عالية |
| الجدوى التشغيلية | 3/5؛ تحتاج حدود موارد ومراقبة وإدارة عمليات | متوسطة |
| الجدوى الاقتصادية | 4/5 بنموذج free-first مع تكلفة اختيارية للـ cloud | متوسطة |
| الجدوى الأمنية | 3/5؛ ممكنة فقط مع عزل وصلاحيات وموافقات افتراضية | متوسطة |
| الجدوى القانونية | 3/5؛ MIT/Apache مناسب غالبًا، وAGPL/GPL يحتاج مراجعة | متوسطة |
| الجدوى من الصيانة | 3/5؛ نطاق المشروع كبير ويجب تجميد MVP | متوسطة |
| النتيجة الكلية | **3.4/5 — قابل للتنفيذ بشرط ضبط النطاق** | متوسطة-عالية |

## المعمارية الموصى بها

التوصية هي **Modular Desktop Monolith + Process Isolation**. تكون الواجهة في Electron في النسخة الأولى لأن المشاريع المرجعية OpenCode وHermes تستخدمان Electron فعليًا للتغليف المكتبي متعدد المنصات [1] [2]، ولأن وجود terminal وPTY وواجهات محلية وNode integrations يقلل المخاطر التنفيذية في MVP. يجب فصل renderer عن main عبر `contextIsolation` وpreload محدود، ووضع agent runtime وfile tools وprovider clients في عمليات خدمة مستقلة. Tauri خيار V1/V2 محتمل إذا أثبت benchmark أن حجم Electron وذاكرته غير مقبولين؛ Tauri أصغر لأنه يستخدم WebView النظام ولا يضم runtime كاملًا، لكنه يضيف Rust وقيود اختلاف WebView والتكامل مع runtime Python/Node [3].

## الـ MVP

يتضمن MVP مشروعًا واحدًا محليًا، محادثة مع agent واحد، file explorer، plan/approve/execute، terminal مقيد، Git status/diff/commit محلي، provider registry بمزوّد محلي واحد ومزوّد OpenAI-compatible اختياري، SQLite للبيانات والجلسات، بحث نصي، skill registry بسيط، وتصدير Markdown/PDF عبر أدوات منفصلة. لا يتضمن MVP الصوت، أو الفيديو، أو 70 وكيلًا، أو أتمتة ذاتية غير مراقبة، أو تكامل OpenTo غير موثق.

## أهم القرارات

القرار الأول هو أن Hermes وOpenCode مصدران يمكن **تكييفهما أو تغليفهما**، وليس من المناسب نسخ قلب أحدهما كاملًا. Hermes ممتاز في طبقات الذاكرة والمهارات والجدولة والبوابة، بينما OpenCode مفيد في core/desktop/SDK/PTY؛ OmniRoute مرجع routing؛ DeepSeek Harness مرجع plugin seams. القرار الثاني هو الاحتفاظ بعقود داخلية مستقلة حتى لا تصبح المنصة رهينة إصدار خارجي. القرار الثالث هو أن `OpenToAdapter` يبقى interface مع mock، ويُفعّل فقط بعد الحصول على مواصفات OpenTo الرسمية.

## مخاطر تستوجب قرار المالك

يجب أن يحدد المالك ماهية OpenTo Desktop ورابطه الرسمي، وهل يسمح بتشغيل subprocess أو plugins أو IPC. كما يجب تحديد سياسة الخصوصية الافتراضية، وهل التطبيق شخصي أم متعدد المستخدمين، وما إذا كان النشر التجاري مستهدفًا؛ لأن هذه الإجابات تغير نموذج الأمن والترخيص والتوزيع.

## مراجع

[1]: https://github.com/anomalyco/opencode "OpenCode repository"
[2]: https://github.com/NousResearch/hermes-agent "Hermes Agent repository"
[3]: https://v2.tauri.app/concept/architecture/ "Tauri Architecture"

إعداد: Manus AI. تاريخ الفحص: 2026-08-21.
