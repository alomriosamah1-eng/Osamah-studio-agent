# جرد فجوة دمج المشاريع مفتوحة المصدر

**التاريخ:** 2026-08-23

## النتيجة التنفيذية

المستودع الحالي يحتوي على Electron فعليًا كتَبعية تشغيل Desktop، وعلى TypeScript وtsx وأدوات Node.js، لكنه لا يحتوي حاليًا على Monaco أو xterm.js أو React Native Web أو Metro أو qpdf أو pdfcpu أو FFmpeg أو Qdrant أو LanceDB أو Whisper أو Piper أو three-vrm كتبعيات تطبيقية. كثير من الأسماء الموجودة في `project/open-source-components.json` هي مرشحون أو مراجع أو wrappers مؤجلة، وليست مكونات مدمجة.

العمل السابق لم يكن ضائعًا؛ فقد أنشأ حدود Ports وAdapters وTyped IPC وHuman Gate وResource Policy، وهي نقاط ربط مناسبة لإدخال المشاريع المفتوحة المصدر دون إعادة كتابة النواة. لكن يجب تصحيح الخطة من "نستفيد من الأنماط" إلى "نثبت dependency/adapter فعليًا لكل قدرة عند اعتمادها".

| القدرة | الوضع الحالي في الكود | المشروع المفتوح المصدر المقصود | الإجراء الجديد |
|---|---|---|---|
| Desktop shell | Electron مستخدم فعليًا في `src/desktop` و`package.json` | Electron | يبقى core shell الحالي ويُثبت كاستخدام فعلي |
| Code editor | Editor Document Boundary مخصص وbuffer/diff محدود | Monaco Editor | دمج تدريجي خلف `EditorSurfacePort` بعد bundle/RAM benchmark، مع الإبقاء على boundary الحالي كfallback |
| Terminal UI | Terminal Policy Preview بلا process execution وبدون terminal renderer خارجي | xterm.js | دمج xterm.js للعرض فقط أولًا، مع بقاء execution خلف policy/worker/Human Gate |
| React/React Native preview | Preview runtime وrenderer مخصصان compatibility/fixture | React Native Web وMetro وExpo | دمج compatibility adapter فعليًا بعد contract parity، وعدم إزالة lightweight fallback |
| Agent orchestration | BoundedAgentRuntime وAgentWorkCycle وPlanner/Critic مخصصون | OpenCode وHermes Agent وDeepSeek Harness | عدم نسخ النواة؛ بناء adapters/bridges محددة للاستفادة من loop/skills/event seams بعد فحص API/license/security |
| Provider routing | ProviderGateway وOllama/llama.cpp adapters منفذة داخليًا | OmniRoute وOllama وllama.cpp | إبقاء Gateway كpolicy boundary، ودمج OmniRoute أو الاستفادة من مكوناته فقط بعد إثبات الحاجة وعدم تكرار routing |
| PDF/document | Markdown preview وdestination write وRender Policy فقط | qpdf وpdfcpu وPandoc/LibreOffice | تنفيذ worker adapter فعلي منفصل بعد legal/build review، دون إدخال converter إلى core |
| Slides/media | Asset/Manifest/Render Policy metadata فقط | FFmpeg وPPTX/HTML renderer | تأجيل التنفيذ حتى render-worker contract؛ لا تستخدم ComfyUI في core قبل مراجعة GPL |
| Semantic memory | SQLite persistence وlexical search وlinks فقط | LanceDB/Qdrant/Mem0/Graphiti | لا دمج الآن؛ decision record يفرض benchmark/versioning/privacy/rebuild قبل أي adapter |
| Voice/Avatar | توثيق مؤجل فقط | Whisper/faster-whisper/Piper/Silero/sherpa-onnx/three-vrm/TalkingHead | لا يبدأ قبل مراحل Voice/Avatar وقرار مالك مستقل |

## قاعدة الترحيل

لا تُحذف العقود الحالية لمجرد إضافة مشروع مفتوح المصدر. يكون الدمج عبر dependency أو subprocess/worker أو adapter خلف port، مع feature flag أو fallback، وقياس startup/RSS/latency، وفحص license وSBOM وCVE، واختبارات contract وno-side-effects. إذا ثبت أن المشروع لا يمكن تشغيله ضمن Ubuntu 8GB أو يفرض license غير مناسبة، يبقى موثقًا ويُستبدل بمرشح آخر دون المساس بالحدود الآمنة.

## الفرق بين أنواع الاستخدام

| النوع | معناه |
|---|---|
| `USE` | dependency أو executable سيُشغّل فعلًا داخل مسار معتمد بعد تثبيت الترخيص والفحص |
| `ADAPT/WRAP` | المشروع يُستخدم خلف adapter؛ لا يتسرب API الخاص به إلى Domain/Application |
| `REFERENCE` | قراءة معمارية أو UX فقط، ولا يجوز وصفه كجزء من التطبيق |
| `OPTIONAL` | لا يُبنى ولا يُحمل افتراضيًا؛ يحتاج opt-in وbenchmark وpolicy |
| `DEFER` | قرار مؤجل ولا ينتج عنه dependency أو runtime code |

## الفجوات المطلوب سدها

يتطلب الدمج الفعلي تحديث `package.json`/lockfile عند المكتبات المضمنة، أو إضافة worker binary/metadata عند الأدوات الخارجية، وتوثيق license notices وSBOM، وإضافة adapter contract tests، وإضافة performance smoke لكل قدرة، وتسجيل provenance/version في artifact manifest. كما يجب أن يبقى startup بلا model/network/provider loading، وتبقى الأفعال الخارجية خلف Human Gate.

الاستنتاج: سنستخدم المشاريع المفتوحة المصدر فعليًا حيث تحل قدرة ناضجة ومناسبة، ولن نعيد بناء capability كاملة محليًا. سيبقى العمل الحالي طبقة policy وعقود وتكامل، لا بديلًا عن المشاريع المرخصة والمقاسة.

## نتائج المصادر الرسمية الأولية

- وثائق [OpenCode Agents](https://opencode.ai/docs/agents/) تميز بين primary agents وsubagents، وتعرض Build كوكيل تطوير كامل الأدوات وPlan كوكيل مقيد للتحليل والمراجعة، وتوفر إعداد agents عبر JSON أو Markdown مع permissions وmodel وprompt وmode. هذا يبرر دمج OpenCode مستقبلًا خلف `AgentHarnessPort`/adapter بدل إعادة بناء agent modes، مع إبقاء Typed IPC وHuman Gate الخاصين بالتطبيق.
- وثائق [Hermes Agent Skills](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills) تعرض skills كوثائق معرفة تُحمّل عند الحاجة وفق progressive disclosure، وتذكر مسارات skills المدمجة والمثبتة من Hub والتي ينشئها الوكيل، مع إمكانية تعديل أو حذف skill. هذا مناسب لدمج skill loader محدود داخل Self-development/Agent Runtime فقط بعد فحص المحتوى والمصدر والموافقة، وليس لتفعيل أي skill أو صلاحية تلقائيًا.
- لا تكفي هذه المراجع وحدها لإدخال كود OpenCode أو Hermes إلى runtime؛ يلزم فحص repository API وdependency graph وlicense notices وisolated execution وRAM/startup benchmark، ثم اختيار dependency أو subprocess/adapter أو fork موثق.

- وثيقة [DeepSeek Harness architecture](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md) تصف events كنقاط extension، مع session events كحقائق durable، وagent events لمراقبة العمل الجاري، وcapability events لربط policy وadapters. وتعرّف seam على أنه service definition + service provider + consumer، وتوضح أن إضافة model/tool/shell/fs/sandbox أو UI تتم عبر registration points. هذا ينسجم مباشرة مع Ports وTyped IPC وHuman Gate الحالية؛ الدمج المقترح هو adapter/bridge للـharness أو event protocol، وليس نسخ loop جديد داخل Application.

## DeepSeek Harness official architecture check — 2026-08-23

- الصفحة الرسمية تصف DeepSeek Harness بأنه developer preview مفتوح المصدر، وتذكر أن كل capability plugin قابلة للاستبدال: models، tools، skills، sessions، sandboxes، storage، loops، scheduling، وUI.
- الصفحة الرسمية تذكر أن Cordis kernel يدير mounting/unmounting/dependencies، وأن Cordis services/events تصل plugins ببعضها، مع profiles/bundles لتكوين runtime.
- صفحة المعمارية الرسمية في GitHub تميز بين session events التي تمثل حقائق durable تُلحق بسجل session وتبث عبر `session/event`، وagent events الحية للمراقبة/التدخل أثناء العمل، وcapability events التي تربط policy وadapters عند seams مثل `fs/*` و`tools/*` و`telemetry/*` دون استيراد loop.
- Quick start الرسمي يستخدم `npx @deepseek-ai/dsh web`، لكن لا يُعتمد التشغيل داخل Osamah الآن؛ يلزم worker/ACP أو package compatibility gate لأن monorepo وpeer graph وNode requirements مختلفة.
- المراجع: https://deepseek.com/harness/en/ و https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md

## DeepSeek Harness developer guide check — 2026-08-23

- Quickstart الرسمي يوضح أن تشغيل Web UI يتم من root README وأن fresh Web UI لا يملك workspace حتى يختاره المستخدم؛ تشغيل المهمة يمكن أن يقرأ ويعدل الملفات ويشغل commands ويفوض subagents، مع approval وفق permission policy.
- دليل أول plugin يحدد أن plugin TypeScript يصدّر `apply(ctx)`، ويمكنه التسجيل عبر `ctx`، وأن الموارد المسجلة تنظف عند unload، وأن dependencies تُعلن عبر `inject`. كما يوضح أن profile patch يضيف plugin path إلى runtime.
- النتيجة: أفضل دمج أولي مع Osamah ليس نسخ DSH loop، بل worker أو package bridge يترجم lifecycle وsession/agent/capability events، ويعطي DSH workspace وpermissions بعد أن يمر الطلب في Osamah policy/Human Gate. المسار لا يزال يحتاج compatibility gate قبل code execution.
- المراجع: https://deepseek-harness.github.io/deepseek-harness/en/guide/quickstart و https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/

## DeepSeek Harness registry/package check — 2026-08-23

- توجد حزمة تنفيذية منشورة `@deepseek-ai/dsh@0.1.1-rc.2` بترخيص MIT وbin باسم `dsh`، لكن manifest يسحب مجموعة واسعة من حزم core/host/client/tools/terminal/fs/web/session/skill والـplugins، وليس SDK صغيرًا مستقلًا.
- حزم `@deepseek-ai/dsh-agent` و`@deepseek-ai/dsh-agent-loop` منشورة أيضًا MIT، لكنها تعتمد على peer graph واسع يشمل Cordis وdsh-llm وdsh-scope وdsh-session وdsh-system-prompt وdsh-tools وdsh-settings وdsh-session-persistence، مع اختلافات RC بين الحزم المنشورة.
- القرار التنفيذي: لا تُضاف الحزمة التنفيذية الكاملة إلى core dependency graph الآن. تُستخدم فعليًا لاحقًا عبر `DeepSeekHarnessWorkerAdapter`/ACP أو worker manifest، أو بعد compatibility matrix تثبت Node/peer graph/RAM/startup/license. هذا يحافظ على خفة Ubuntu 8GB دون تحويل DSH إلى reference-only.
