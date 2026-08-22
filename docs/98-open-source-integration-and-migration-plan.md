# خطة دمج المشاريع مفتوحة المصدر داخل Osamah Studio Agent

**الحالة:** قرار معماري نافذ من تاريخ 2026-08-23. هذه الوثيقة تصحح سياسة «المرجع المعماري فقط» إلى سياسة **open-source-first integration** دون حذف العقود والاختبارات التي بُنيت سابقًا.

## القرار التنفيذي

لن يعيد Osamah Studio Agent بناء منظومة الوكلاء والنماذج والمزودين والمهارات والواجهات من الصفر. سيستخدم المشاريع الناضجة فعليًا داخل التطبيق، لكن كل مشروع سيدخل عبر أحد أشكال الدمج التالية: حزمة runtime مثبتة، أو adapter/SDK رسمي، أو worker مع بروتوكول typed، أو executable محلي مع manifest وhealth وresource policy. تبقى Domain/Application وTyped IPC وHuman Gate وAudit وRedaction وResource Policy الخاصة بـOsamah هي **طبقة السيطرة والسياسة**، وليست بديلًا عن agent harness أو provider runtime مفتوح المصدر.

> **القاعدة الجديدة:** لا يكفي تسجيل مشروع في `project/open-source-components.json` أو الاستفادة من أفكاره. عند اعتماد المشروع يجب أن يظهر في `package.json`/lockfile أو في worker manifest، ويجب أن يستعمله اختبار تكاملي أو مسار تشغيل bounded، مع تسجيل الإصدار والترخيص والـprovenance.

## منظومة الدمج المستهدفة

| الطبقة | المشروع أو المشاريع | شكل الدمج | الدور في Osamah | الحالة |
|---|---|---|---|---|
| Desktop host | Electron | dependency فعلية | Main/BrowserWindow/Preload وprocess boundary | مستخدم فعليًا |
| Agent coding harness | OpenCode | `@opencode-ai/sdk` adapter ثم local runtime worker | sessions، agents، prompts، provider/model selection، coding workflow | أول حزمة دمج فعلية |
| Agent/plugin spine | DeepSeek Harness وCordis | packages أو host worker بعد compatibility gate | plugin registration، session/agent/capability events، durable event model | مخطط لدمج فعلي؛ لا يُنسخ core |
| Skills/memory/automation | Hermes Agent | Python worker أو ACP/JSONL adapter | skills on demand، profiles، subagents، automation وmemory integrations | مخطط لدمج فعلي مع عزل process |
| Provider routing | OmniRoute + Ollama + llama.cpp | `ProviderAdapter`/HTTP worker خلف ProviderGateway | routing/fallback/provider health، مع local-only mode | Gateway الحالي يبقى policy boundary؛ OmniRoute هو routing implementation اختياري قادم |
| Frontend editor | Monaco Editor | lazy renderer dependency خلف `EditorSurfacePort` | code editing وlanguage services | بعد agent bridge؛ fallback الحالي لا يُحذف |
| Frontend terminal | xterm.js | lazy renderer dependency خلف `TerminalSurfacePort` | PTY display فقط؛ التنفيذ يبقى worker/policy | بعد editor slice |
| Mobile preview | React Native Web + Metro + Expo | isolated preview worker/adapter | preview compatible مع RN، لا native emulator | بعد تثبيت editor/agent seams |
| Documents/media | qpdf، pdfcpu، Pandoc/LibreOffice، FFmpeg | local workers مع manifests | PDF/HTML/PPTX/media render وvalidation | خلف Human Gate وlegal/build profile |
| Semantic memory | LanceDB/Qdrant أو بديل | vector adapter مستقل | semantic retrieval/versioned index | مؤجل في docs/96؛ لا dependency الآن |
| Voice/Avatar | Whisper/faster-whisper، Piper، Silero/sherpa، three-vrm/TalkingHead | workers وassets بعد owner gate | Voice وVirtual Human | مؤجل؛ لا يبدأ الآن |

تؤكد بيانات GitHub التي فُحصت في 2026-08-23 نشاطًا وتراخيص مناسبة لعدد من المرشحين، لكن النشاط أو MIT/Apache لا يكفيان لقبول dependency؛ تبقى compatibility وdependency graph وCVE وRAM وstartup وmodel/asset licenses شروطًا مستقلة. OpenCode وHermes وDeepSeek وElectron مرخصة MIT في السجل الحالي، بينما تتطلب FFmpeg وNOASSERTION ومكونات النماذج مراجعة منفصلة. [1] [2]

## لماذا لا ندمج المستودعات كاملة داخل مجلد واحد؟

الدمج الكامل لمستودعات OpenCode أو Hermes أو DeepSeek داخل Electron سيجلب runtimes مختلفة وmonorepos كبيرة وعمليات وأدوات وصلاحيات وdependencies لا يحتاجها كل مستخدم. OpenCode الحالي يعتمد على Bun في scripts ويضم SDK مستقلًا صغيرًا نسبيًا، بينما Hermes يعتمد على Python مع workspace/desktop/TUI، وDeepSeek Harness يعتمد على pnpm monorepo وCordis وحزم host/client متعددة. لذلك يكون الدمج العملي هو **استخدام الأجزاء المنشورة أو workers الرسمية**، وليس نسخ كل repository أو إعادة تسمية كود محلي على أنه upstream.

هذا لا يعني إبقاء المشاريع كمراجع. على العكس، adapter الذي يستدعي SDK أو worker الحقيقي ويختبر round-trip وhealth وversion هو استخدام فعلي. أما كود Osamah الموجود في `src/application` فيحتفظ بعقود policy والـaudit والـfallback والـHuman Gate التي لا يجوز تسليمها ضمنيًا إلى harness خارجي.

## OpenCode: أول دمج تنفيذي

تُعتمد حزمة `@opencode-ai/sdk` الرسمية ذات الترخيص MIT كأول dependency فعلية. ينشئ Osamah `OpenCodeSdkAdapter` lazy عند طلب المستخدم فقط، ويستخدم client v2 للتعامل مع health وsession.create وsession.prompt وsession.messages. لا يُستدعى SDK عند startup؛ ولا يبدأ OpenCode server تلقائيًا في هذه الشريحة. يظل عنوان loopback أو worker command opt-in من host-side configuration، وتُرفض العناوين البعيدة في وضع local-only.

يحافظ adapter على mapping واضح: `ProviderInvocationRequest.sessionId` يرتبط بجلسة OpenCode منشأة، و`request.input` يتحول إلى `parts: [{ type: "text", text }]`، و`ProviderInvocationResponse` يُبنى من رسالة OpenCode بعد validation وحدود الحجم. لا تُمرر أدوات shell أو filesystem تلقائيًا؛ أي tool capability أو mutation تحتاج capability mapping وHuman Gate منفصلين. إذا لم يتوفر OpenCode server أو اختلفت الاستجابة، يفشل adapter typed ويعود ProviderGateway إلى policy/fallback، ولا يُنشأ process صامتًا.

## DeepSeek Harness: العقل التشغيلي القابل للتوسعة

يُعتمد DeepSeek Harness بوصفه مرشحًا فعليًا لطبقة plugin/event spine، لأن وثيقته تصف session events durable وagent events live وcapability seams من service definition/provider/consumer. لكن حزم `dsh-agent` و`dsh-agent-loop` الحالية تتطلب مجموعة peer packages وCordis وإصدارات RC متداخلة، بينما المشروع الحالي يعمل على Node 22.13 وDeepSeek root يحدد Node أحدث؛ لذلك لا تُضاف الحزم عشوائيًا إلى dependency graph الآن.

المسار الصحيح هو بناء `DeepSeekHarnessBridge` خلف `AgentHarnessPort` ثم اختبار أحد خيارين: حزم npm متوافقة بعد matrix تثبت Node/dependency/license/RSS، أو host worker مستقل يتواصل عبر JSONL/ACP typed. عند قبول bridge، يصبح DeepSeek هو plugin/event spine الفعلي لمسارات agent sessions وcapabilities، بينما تبقى approval وpolicy وaudit في Osamah. لا يُسمح للحزمة الخارجية بكتابة الملفات أو تشغيل shell مباشرة من renderer.

## Hermes Agent: المهارات والذاكرة والأتمتة

يُستخدم Hermes Agent فعليًا عبر worker معزول لأن runtime الأساسي Python ويدخل معه profile/skills/subagents/automation. تبدأ الشريحة الأولى بـskill catalog read-only وskill metadata/provenance، ثم load on demand بعد review؛ لا تسمح بكتابة skill أو تعديل policy أو رفع provider access تلقائيًا. تُستخدم JSONL/ACP messages bounded، ويظل كل request مصنفًا في Osamah قبل إرساله.

هذا المسار يعيد استخدام skills وmemory/automation الموجودة بدل بناء بديل محلي كامل، لكن لا يمنح Hermes صلاحية مباشرة على live profile أو secrets. أي filesystem/terminal/browser/network capability تمر عبر Osamah tool policy وHuman Gate، ولا تُمرر environment variables إلا بعد explicit configuration.

## خطة الترحيل المرحلية

| المرحلة | التنفيذ | معيار النجاح |
|---|---|---|
| A | إضافة OpenCode SDK adapter lazy، dependency/lockfile، health/session/prompt contract، fake loopback server test، وعدم تشغيله عند startup | round-trip typed ينجح، malformed output والremote URL وmissing server تفشل مغلقًا، وperformance smoke لا يتغير |
| B | إضافة `AgentHarnessPort` وDeepSeek bridge design، ثم compatibility matrix للحزم المنشورة أو worker | bridge لا يسرّب SDK إلى Domain، session events قابلة للتتبع، Node/RAM/license gates ناجحة |
| C | Hermes worker وskill catalog review | skills تُعرض وتُحمّل عند الطلب فقط، source/version/hash محفوظة، ولا mutation بلا Human Gate |
| D | Monaco ثم xterm.js بتحميل lazy | editor/terminal UI فعليان، لا زيادة startup غير مقبولة، والfallback الحالي يعمل عند تعذر الحزمة |
| E | Metro/React Native Web preview worker | RN Web compatibility test وunsupported-native labeling وworker cancellation |
| F | qpdf/pdfcpu/FFmpeg workers | artifacts reproducible من input hash، validators وmanifest وHuman Gate، وlicense notices مكتملة |
| G | OmniRoute/provider adapters ثم semantic/voice/avatar حسب قرارات مستقلة | policy وprivacy وbenchmark وrollback مثبتة؛ لا فتح Avatar قبل owner gate |

## الحفاظ على العمل السابق

لا تُحذف `ProviderGateway` أو `AgentWorkCycle` أو `AgentCatalog` أو `HumanGate` أو `RenderPolicy` أو `MemoryCapture` أو `MarkdownDestinationService`. تُستخدم هذه المكونات كـanti-corruption layer: تحدد ما يجوز للحزمة الخارجية فعله، وتترجم بين عقود Osamah وواجهات upstream، وتسجل version/provenance، وتوفر fallback bounded عند غياب upstream. يُستبدل implementation المخصص فقط عندما ينجح upstream في contract وperformance وsecurity tests، مع إبقاء implementation الحالي خلف feature flag أو fallback حتى إغلاق الترحيل.

## ما لن يحدث في هذه الخطة

لن تُضاف جميع المشاريع كحزم دفعة واحدة، ولن تُنسخ مستودعات كاملة إلى Git، ولن تُشغّل install scripts غير موثقة. لن يبدأ OpenCode أو Hermes أو DeepSeek عند startup، ولن تُمرر أسرار أو raw user files إلى prompts أو logs. لن تُضاف embeddings أو vector database أو FTS5 native extension في هذه الشريحة، ولن يبدأ Voice أو Avatar runtime؛ تلك قرارات منفصلة ومؤجلة.

## المراجع

[1]: ../research/oss-github-audit-2026-08-23.tsv "GitHub metadata audit for candidate projects"
[2]: ./08-open-source-landscape.md "Open-source landscape and classifications"
[3]: https://opencode.ai/docs/agents/ "OpenCode official Agents documentation"
[4]: https://hermes-agent.nousresearch.com/docs/user-guide/features/skills "Hermes Agent official Skills documentation"
[5]: https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md "DeepSeek Harness official architecture"
[6]: ../project/open-source-components.json "Project component registry"
