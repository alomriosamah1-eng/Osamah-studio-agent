# الواجهة الموحدة وإزالة تكرار القدرات

**الحالة:** معتمد من 2026-08-23. هذه الوثيقة تُلزم جميع واجهات Osamah Studio Agent بأن تكون واجهات أصلية موحدة للمشروع، حتى عندما تكون capability الداخلية منفذة بمكتبة أو مشروع مفتوح المصدر.

## القرار

لن تُعرض واجهة OpenCode أو Hermes أو DeepSeek Harness أو Monaco أو xterm أو React Native Web للمستخدم بوصفها واجهة المنتج. ستبقى واجهة المستخدم هي Workspace وControl Center وProduction Studio وSecond Brain وEmbedded Preview الخاصة بـOsamah، وتستخدم فقط `OsamahPreloadApi` وtyped IPC وDTOs الخاصة بالمشروع. يمكن استخدام upstream في الخلفية أو في renderer surface معزول خلف port إذا كان ذلك ضروريًا تقنيًا، لكن لا يتسرب upstream component tree أو route أو state model أو configuration shape إلى UX العام.

> **الفصل الحاسم:** إعادة استخدام engine أو SDK لا تعني إعادة استخدام واجهة المنتج. ندمج capability، ثم نترجمها إلى نموذج العرض واللغة والصلاحيات والتجربة الموحدة الخاصة بـOsamah.

## طبقات التطبيق

| الطبقة | ما يراه المستخدم | ما يمكن دمجه خلفها | ما يمنع تسريبه |
|---|---|---|---|
| Workspace | شجرة الملفات والمحرر وpreview وInspector وtask review | OpenCode agent session، Monaco editor surface عند الحاجة، React Native Web/Metro preview worker | لا OpenCode UI، لا DSH Web UI، لا Hermes TUI، ولا upstream routes |
| Control Center | حسابات خارجية، التخزين، التطوير الذاتي، الإعدادات العربية/الإنجليزية | provider SDKs، Hermes skill metadata، DeepSeek plugin catalog | لا provider-native settings أو credentials screens دون تحويل إلى DTOs وسياسات Osamah |
| Production Studio | مصادر، claims، citations، assets، content plan، reports، render review | qpdf/pdfcpu/FFmpeg/Pandoc workers | لا converter UI أو command output خام؛ كل artifact يمر manifest وreview |
| Second Brain | capture/review/search/links/consolidation | lexical engine أو semantic adapter مستقبلي أو Hermes memory worker | لا memory UI خارج vocabulary وvisibility/retention الخاصة بـOsamah |
| Human Gate | approval ticket وrisk وscope وdecision | ACP permission callbacks وDSH tool events وworker requests | لا قبول تلقائي من upstream permission أو session status |

## قاعدة إزالة التكرار

لكل قدرة تشغيلية نختار **upstream أساسيًا واحدًا** في المسار التنفيذي، ونستخدم البدائل فقط كـfallback أو future candidate بعد benchmark وlicense review. لا يجوز تشغيل OpenCode وDeepSeek Harness وHermes كـagent loops متوازية لنفس الطلب، ولا استخدام OmniRoute مع routing مكرر داخل ProviderGateway، ولا إضافة أكثر من renderer لعرض نفس Preview capability دون ownership واضح.

| القدرة | المالك التنفيذي المقترح | ما يُحفظ كبديل | سبب الاختيار الحالي |
|---|---|---|---|
| Coding agent session/provider bridge | OpenCode SDK أولًا | DeepSeek Harness كـplugin spine | OpenCode SDK منشور صغير ومتوافق مع Node/Electron، وأصبح مدمجًا فعليًا opt-in؛ لا يوجد agent UI upstream |
| Plugin/event spine | DeepSeek Harness لاحقًا | Cordis standalone أو OpenCode events | DSH يعرّف plugin/service/event seams، لكن حزمة runtime واسعة وتحتاج compatibility gate |
| Skills/subagents/automation | Hermes ACP worker | DSH skills plugins | Hermes ACP مدمج فعليًا كـprovider worker bounded؛ Python process boundary أفضل من خلطه في Electron، وواجهة المستخدم تبقى Osamah |
| Provider selection/fallback | ProviderGateway الخاص بـOsamah | OmniRoute كadapter routing عند الحاجة | Gateway الحالي يفرض privacy/offline/quota/audit؛ لا نكرر routing قبل إثبات حاجة |
| Code editor UX | واجهة Osamah الموحدة مع editor surface واحد | Monaco Editor | Monaco مرشح فعلي، لكن لا يملك route أو workspace shell؛ يحمّل lazy بعد benchmark |
| Terminal UX | واجهة Osamah الموحدة مع terminal surface واحد | xterm.js | xterm renderer فقط، والتنفيذ يبقى policy/worker؛ لا Hermes/DSH terminal UI للمستخدم |
| Mobile preview | Embedded Preview الخاص بـOsamah | React Native Web/Metro/Expo adapter | يبقى lightweight fallback؛ upstream runtime يضاف فقط داخل worker مع unsupported labeling |
| Render/media | Production Studio الخاص بـOsamah | qpdf/pdfcpu/Pandoc/LibreOffice/FFmpeg workers | كل أداة تملك format محددًا ولا تُكرر converter chain بلا manifest |
| Semantic memory | lexical Second Brain حاليًا | LanceDB أو Qdrant أو بديل واحد بعد قرار مستقل | لا vector dependency قبل benchmark/versioning/privacy/rebuild |

## ضوابط الدمج

يجب أن يكون أي upstream dependency lazy أو worker-scoped إذا كان ثقيلًا، ويجب أن يحدث health check أو model/provider initialization بعد طلب صريح. يمر كل input وoutput عبر typed adapter يفرض الحجم واللغة والخصوصية والمسار وredaction. لا يملك upstream صلاحية الكتابة أو تشغيل shell أو الشبكة إلا من خلال capability وapproval محددين في Osamah.

تملك واجهة Osamah أسماء الحالات والرسائل والتصميم المرئي وRTL/LTR واللغة العربية الافتراضية. إذا احتاجت مكتبة خارجية إلى configuration أو event model خاص بها، يترجمه adapter إلى DTO داخلي ولا يعرضه في Preload API أو IPC العام. وبالمثل، لا تُرسل raw tool traces أو provider secrets أو session logs الخام إلى renderer.

## معايير قبول أي دمج جديد

| المعيار | الاختبار المطلوب |
|---|---|
| عدم تكرار القدرة | وجود owner واحد في `project/open-source-components.json` وغياب مسار ثانٍ ينفذ الطلب نفسه |
| وحدة الواجهة | لا imports أو routes أو state types لـupstream داخل Preload أو IPC أو واجهة Workspace العامة |
| الترحيل الآمن | feature flag أو opt-in وfallback قائم حتى نجاح contract tests |
| الأمان | allowlist، canonical path، redaction، no arbitrary command، وHuman Gate للmutation |
| الأداء | startup لا يحمل worker/model، وRSS/heap/latency ضمن low-memory budget |
| القابلية للتراجع | إيقاف adapter أو worker يعيد المسار إلى implementation/fallback الحالي دون data loss |
| التراخيص | version pin وlicense notice وSBOM/CVE record ومراجعة assets/model licenses |
| التتبع | provenance وupstream version وadapter name محفوظة في audit/manifest دون أسرار |

## الحالة الحالية

OpenCode SDK هو أول upstream capability مدمجة فعليًا: `@opencode-ai/sdk@1.18.21` و`OpenCodeSdkProviderAdapter` خلف `ProviderGateway`. ثم أضيف `@agentclientprotocol/sdk@1.4.0` و`HermesAcpProviderAdapter` كـACP stdio worker bridge فعلي؛ كلا الدمجين لا يضيفان OpenCode/Hermes UI ولا يغيران Preload API، ولا يبدأان server أو process أو health check عند startup. DeepSeek Harness بقي مرشح plugin/event spine لاحقًا، وليس واجهة. Monaco وxterm وReact Native Web/Metro وrender workers تبقى مسارات منفصلة، ويُختار واحد فقط لكل قدرة عند تنفيذها.

## المراجع

[1]: ./98-open-source-integration-and-migration-plan.md "خطة دمج المشاريع مفتوحة المصدر فعليًا"
[2]: https://deepseek.com/harness/en/ "DeepSeek Harness الرسمي: Everything is a plugin"
[3]: https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/ "دليل تطوير DeepSeek Harness plugins"
[4]: https://opencode.ai/docs/agents/ "OpenCode Agents documentation"
[5]: https://hermes-agent.nousresearch.com/docs/user-guide/features/skills "Hermes Agent Skills documentation"
