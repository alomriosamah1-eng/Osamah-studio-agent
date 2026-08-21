# المشهد مفتوح المصدر

## منهج التصنيف

تم جمع metadata رسمي من GitHub لـ **44 مشروعًا** في agent/orchestration، memory/vector، search/browser، voice، media، documents، desktop، automation، Second Brain، GitHub، security، وlocal runtime. أرقام النجوم والنشاط في `research/ecosystem-github-metadata.ndjson` هي snapshot وقت الفحص وليست ضمانًا للنضج. القرار لا يعتمد على النجوم وحدها، بل على الترخيص، سطح التكامل، الاختبارات، الموارد، وسهولة العزل.

## المكونات الرئيسية

| المجال | المشروع | الترخيص | القرار | الاستخدام المقترح |
|---|---|---:|---|---|
| agent runtime | Hermes Agent | MIT | ADAPT/WRAP | memory, skills, cron, gateway, subagents |
| coding agent | OpenCode | MIT | ADAPT/WRAP | coding core, SDK, desktop patterns, PTY |
| plugin runtime | DeepSeek Harness | MIT | REFERENCE/ADAPT | capability seams وplugin composition |
| provider routing | OmniRoute | MIT | REFERENCE/ADAPT | registry, fallback, quota, compression concepts |
| graph orchestration | LangGraph | MIT | REFERENCE | DAG/stateful workflows؛ ليس قلب desktop مباشرة |
| multi-agent roles | CrewAI | MIT | REFERENCE | مقارنة role/task abstraction؛ تجنب coupling |
| agent framework | AutoGen | CC-BY-4.0 | REFERENCE/LEGAL REVIEW | لا يعاد توزيعه قبل مراجعة شروط المحتوى |
| context/RAG | LlamaIndex | MIT | WRAP/REFERENCE | ingestion/retrieval عند الحاجة |
| memory | Mem0 | Apache-2.0 | ADAPT | semantic memory provider اختياري |
| context database | OpenViking | AGPL-3.0 | REFERENCE/DO NOT EMBED | قوي مفاهيميًا لكن copyleft عائق للتوزيع التجاري |
| knowledge graph | Graphiti | Apache-2.0 | ADAPT | episodic/temporal graph اختياري |
| vector | Qdrant | Apache-2.0 | WRAP | خدمة محلية اختيارية، لا تُلزم MVP |
| vector | LanceDB | Apache-2.0 | ADAPT | embedded vector store مناسب لسطح المكتب |
| vector | Chroma | Apache-2.0 | REFERENCE | prototyping؛ قياس الحجم قبل الالتزام |
| web search | SearXNG | AGPL-3.0 | WRAP/OPTIONAL | self-hosted search؛ لا يدمج داخل distributable بلا مراجعة |
| browser | Playwright | Apache-2.0 | USE DIRECTLY | automation واختبارات وweb extraction |
| browser agent | Browser Use | MIT | WRAP/REFERENCE | browser worker مع policy صارمة |
| web extraction | Crawl4AI | Apache-2.0 | USE/WRAP | extraction محلي عند قبول Python dependency |
| protocol | MCP TypeScript SDK | NOASSERTION snapshot | WRAP AFTER LICENSE AUDIT | client/server integration، لا تعتمد metadata بلا قراءة LICENSE |
| STT | Whisper | MIT | USE/WRAP | baseline multilingual STT |
| STT | faster-whisper | MIT | USE DIRECTLY | تنفيذ أسرع عبر CTranslate2 مع benchmark |
| TTS | Piper | MIT | USE/WRAP | صوت محلي منخفض الموارد؛ فحص Arabic model قبل الوعد |
| VAD | Silero VAD | MIT | USE DIRECTLY | segmentation وbarge-in |
| voice | OpenVoice | MIT | RESEARCH/OPT-IN | cloning حساس قانونيًا وأخلاقيًا؛ لا يدخل MVP |
| image | ComfyUI | GPL-3.0 | WRAP/LEGAL REVIEW | worker منفصل لا embed تجاري دون مراجعة |
| media | FFmpeg | NOASSERTION snapshot | USE DIRECTLY/NOTICE | تحويل وترميز؛ تدقيق codec/license لكل build |
| documents | Pandoc | GPL-2.0 | WRAP/LEGAL REVIEW | تحويل مستندات عبر process، لا link افتراضيًا |
| PDF | qpdf | Apache-2.0 | USE DIRECTLY | merge/split/inspect |
| PDF | pdfcpu | Apache-2.0 | USE/WRAP | PDF operations في worker Go |
| office | LibreOffice | GPL-3.0 | WRAP/LEGAL REVIEW | headless conversion خيار خارجي |
| desktop | Electron | MIT | USE IN MVP | shell متعدد العمليات ومتكامل مع Node |
| desktop | Tauri | Apache-2.0/MIT | ADAPT V1/V2 | حجم أصغر، لكن Rust/WebView boundary |
| editor | Monaco | MIT | USE DIRECTLY | code editor |
| terminal | xterm.js | MIT | USE DIRECTLY | terminal renderer |
| automation | n8n | NOASSERTION snapshot | REFERENCE/DO NOT EMBED | محرك workflows واسع وترخيص يجب مراجعته |
| durable workflow | Temporal | MIT | REFERENCE | للنسخة السحابية/long-running وليس MVP local |
| automation | Windmill | NOASSERTION snapshot | REFERENCE | إدارة workflows، لا embed بلا license audit |
| Second Brain | Logseq | AGPL-3.0 | REFERENCE | دراسة graph/notes، لا نسخ core |
| Second Brain | AppFlowy | AGPL-3.0 | REFERENCE | دراسة workspace، copyleft يحتاج مراجعة |
| GitHub | GitHub CLI | MIT | USE DIRECTLY | عمليات GitHub الموثقة من subprocess |
| Git | libgit2 | NOASSERTION snapshot | ADAPT | embedded Git إذا كانت bindings مستقرة |
| secrets | Gitleaks | MIT | USE DIRECTLY | كشف secrets في local preflight/CI |
| vuln scan | Trivy | Apache-2.0 | USE IN CI | dependency/container scan |
| supply chain | Scorecard | Apache-2.0 | USE IN CI | تقييم المستودع/workflows |
| sandbox | Firecracker | Apache-2.0 | REFERENCE/FUTURE | عزل قوي يحتاج Linux/KVM ولا يناسب Windows MVP |
| local runtime | Ollama | MIT | USE/WRAP | local model management على الأجهزة الداعمة |
| local runtime | llama.cpp | MIT | USE/WRAP | direct inference وGGUF عند الحاجة |
| serving | vLLM | Apache-2.0 | REFERENCE/FUTURE | server/GPU؛ ليس embedded desktop |

## توصية الإدماج

يدخل MVP أقل عدد ممكن: Electron، Monaco، xterm.js، SQLite/FTS5، GitHub CLI، qpdf/pdfcpu، Whisper أو faster-whisper كـ optional، Piper/Silero كـ optional، وMCP client بعد security contract. تدخل Qdrant/LanceDB وOllama/llama.cpp بملفات اختيارية، بينما تدخل المشاريع الكبيرة كـ adapters أو مراجع.

## ما يجب تجنبه

يجب تجنب تضمين OpenViking وSearXNG وLogseq وAppFlowy وComfyUI وLibreOffice وPandoc داخل توزيع تجاري قبل مراجعة copyleft ومتطلبات إعادة التوزيع. كما يجب تجنب اعتماد AutoGen أو n8n أو Windmill لمجرد الشعبية قبل فهم شروط الترخيص ونموذج التشغيل. لا يُنسخ كود من OpenCode/Hermes/DeepSeek Harness؛ يعاد استخدام العقود والأفكار فقط أو يضاف dependency واضح مع notices.

## مراجع

[1]: https://github.com/anomalyco/opencode "OpenCode"
[2]: https://github.com/NousResearch/hermes-agent "Hermes Agent"
[3]: https://github.com/diegosouzapw/OmniRoute "OmniRoute"
[4]: https://github.com/deepseek-ai/deepseek-harness "DeepSeek Harness"
[5]: https://github.com/tauri-apps/tauri "Tauri"
[6]: https://github.com/modelcontextprotocol/typescript-sdk "MCP TypeScript SDK"
[7]: https://github.com/openai/whisper "Whisper"
[8]: https://github.com/rhasspy/piper "Piper"
[9]: https://github.com/qdrant/qdrant "Qdrant"
[10]: https://github.com/cli/cli "GitHub CLI"

إعداد: Manus AI. تاريخ الفحص: 2026-08-21.
