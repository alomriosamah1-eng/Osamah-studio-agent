# مصادر البحث

## ملاحظة زمنية

تم فحص المصادر في 2026-08-21 بتوقيت البيئة التنفيذية. أرقام النجوم والتحديثات متغيرة، ولذلك تُستخدم للترتيب لا لإثبات جودة مطلقة. كل قرار يذكر تصنيفه؛ ما لم يثبت من مصدر رسمي يبقى **UNKNOWN / REQUIRES VALIDATION**.

## المشاريع المرجعية

| رقم | المصدر | نوعه | ما يثبته |
|---:|---|---|---|
| 1 | [OpenCode repository](https://github.com/anomalyco/opencode) | GitHub رسمي | بنية المشروع، MIT، packages، Desktop Beta |
| 2 | [OpenCode package.json](https://raw.githubusercontent.com/anomalyco/opencode/dev/package.json) | manifest رسمي | Bun، workspaces، TypeScript، packages |
| 3 | [OpenCode desktop package](https://raw.githubusercontent.com/anomalyco/opencode/dev/packages/desktop/package.json) | manifest رسمي | Electron/Vite/electron-builder والتغليف |
| 4 | [Hermes repository](https://github.com/NousResearch/hermes-agent) | GitHub رسمي | Python agent، memory، skills، gateway، cron |
| 5 | [Hermes architecture](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/architecture.md) | وثيقة رسمية | agent loop، SQLite/FTS5، tools، plugins، ACP |
| 6 | [Hermes desktop package](https://raw.githubusercontent.com/NousResearch/hermes-agent/main/apps/desktop/package.json) | manifest رسمي | Electron/React/PTY/build targets |
| 7 | [OmniRoute repository](https://github.com/diegosouzapw/OmniRoute) | GitHub رسمي | routing، providers، fallback، desktop، MIT |
| 8 | [OmniRoute package](https://raw.githubusercontent.com/diegosouzapw/OmniRoute/release/v3.8.50/package.json) | manifest رسمي | Node 22/24، scripts، testing، Electron |
| 9 | [DeepSeek Harness repository](https://github.com/deepseek-ai/deepseek-harness) | GitHub رسمي | MIT، developer preview، Cordis، plugin architecture |
| 10 | [DeepSeek architecture](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md) | وثيقة رسمية | profiles/bundles/events/seams/session log |

## المنصة والسطح المكتبي

| رقم | المصدر | ما يثبته |
|---:|---|---|
| 11 | [Electron Process Model](https://electronjs.org/docs/latest/tutorial/process-model) | main/renderer/preload/utility process |
| 12 | [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security) | context isolation، sandbox، CSP، IPC validation |
| 13 | [Tauri Architecture](https://v2.tauri.app/concept/architecture/) | Rust/WebView، WRY/TAO، صغر الحزمة، plugins |
| 14 | [MCP Specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28) | host/client/server، JSON-RPC، tools/resources/prompts، consent |
| 15 | [GitHub Actions docs](https://docs.github.com/en/actions) | workflows وactions وartifacts |

## المكوّنات المفتوحة

توجد روابط GitHub المباشرة والمعلومات snapshot في `research/ecosystem-github-metadata.ndjson`. من المصادر المهمة: [LangGraph](https://github.com/langchain-ai/langgraph)، [CrewAI](https://github.com/crewAIInc/crewAI)، [LlamaIndex](https://github.com/run-llama/llama_index)، [Mem0](https://github.com/mem0ai/mem0)، [Graphiti](https://github.com/getzep/graphiti)، [Qdrant](https://github.com/qdrant/qdrant)، [LanceDB](https://github.com/lancedb/lancedb)، [Playwright](https://github.com/microsoft/playwright)، [Whisper](https://github.com/openai/whisper)، [faster-whisper](https://github.com/SYSTRAN/faster-whisper)، [Piper](https://github.com/rhasspy/piper)، [Silero VAD](https://github.com/snakers4/silero-vad)، [FFmpeg](https://github.com/FFmpeg/FFmpeg)، [qpdf](https://github.com/qpdf/qpdf)، [GitHub CLI](https://github.com/cli/cli)، و[Ollama](https://github.com/ollama/ollama).

## مصدر غير محسوم

`OpenTo Desktop` بقي بلا رابط رسمي أو repository أو مواصفة قابلة للتحقق. لا يُستخدم search snippet أو نتيجة غير رسمية كبديل عن وثيقة platform owner. هذا blocker موثق في `docs/21-open-to-integration.md` و`project/risks.json`.

## سياسة الاستشهاد

أي معلومة خارجية في وثائق المشروع يجب أن تستخدم reference-style citation مع مصدر مباشر. أي رقم متغير يجب أن يذكر `as of` وتاريخ الفحص. تستخدم المصادر الثانوية فقط لتوجيه البحث، ولا تُبنى عليها قرارات تكامل أو ترخيص عند توفر المصدر الأولي.

إعداد: Manus AI.
