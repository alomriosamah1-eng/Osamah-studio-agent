# الخطة الرئيسية لتنفيذ Osamah Studio Agent

## 1. الغرض من الوثيقة

هذه الوثيقة تحول الرؤية والتحليلات والقرارات السابقة إلى **خطة تنفيذ متسلسلة قابلة للتنفيذ والقياس** لتطبيق Osamah Studio Agent. التطبيق ليس مجموعة أدوات منفصلة، بل منصة Desktop محلية أولًا تجمع ثلاث بيئات مترابطة: **Intelligent Software Development Environment**، و**Production Studio**، و**Second Brain**. تشترك البيئات في Workspace وAgent Runtime وProvider Gateway وMemory وPolicy وJobs وArtifacts، لكنها تبقى مفصولة في نطاقات Domain وApplication وواجهات واضحة.

الهدف التنفيذي هو تقليل تبديل الأدوات مع إبقاء الإنسان صاحب القرار في الأفعال الحساسة. كل ميزة يجب أن تجيب قبل تنفيذها عن أربعة أسئلة: ما البيانات التي تقرؤها؟ ما الفعل الذي تنفذه؟ ما الصلاحية المطلوبة؟ وكيف يراجع المستخدم الأثر ويتراجع عنه؟ هذا المبدأ هو أساس الخطة وليس مرحلة لاحقة.

> **قاعدة الحقيقة:** المعاينة المدمجة الحالية هي `compatibility/fixture preview`. لا يجوز وصفها بأنها React Native native runtime أو Android Emulator أو iOS Simulator، ولا يجوز تشغيل scripts أو native toolchains من مشاريع الهاتف تلقائيًا.

## 2. الوضع الحالي ونقطة الانطلاق

حتى آخر تحديث، اكتمل الأساس التالي في المستودع: Clean Architecture أولية، Domain primitives/entities/events، Application use cases وports، in-memory adapters، SQLite adapter وobservability وbackup/restore، Embedded Simulator Controller، typed IPC، Project Preview Bundle، Filesystem Scanner، Project Preview Service، Presentation Renderer، Electron shell، Lightweight Web Preview، Resource Policy، BoundedAgentRuntime slice، production root picker، optional SQLite composition wiring، Agent WorkCycle وHuman Gate، شرائح Development Environment وProduction Studio bounded، Second Brain Memory Capture/Review، Agent Definition Contract وBounded Agent Catalog، ReportDocument bounded، وArabic-first Application Settings وControl Center، وExternal Accounts metadata-only، وStorage Settings read-only، وSelf-development Candidate Review وRule Overlay bounded، وMemory Consolidation bounded من مصادر مؤكدة، ثم SQLite persistence اختيارية ومحدودة لـ`MemoryEntry` و`MemoryCandidate`، وlocal lexical retrieval، وvisibility filtering، وrelational MemoryEntry links، وagent scope/permission filtering محليًا. آخر حالة موثقة هي الإصدار `0.6.0` مع **209/209 اختبارًا ناجحًا** وrestart persistence وexplicit fallback وlocal lexical retrieval عربي/إنجليزي وvisibility filtering وروابط bounded؛ hierarchical orchestrator وOAuth/MCP/GitHub/Google integrations وstorage mutation flows وFTS5 وembeddings/semantic retrieval وsemantic self-development control plane ما زالت غير منفذة.

لذلك لا تعيد الخطة بناء الأساس من الصفر. أُغلقت شريحة **Arabic-first Application Settings وControl Center** عند feature `d9a746c7deecb38488a5f632599be16c48c8e8cb`، ثم **External Accounts metadata-only** عند feature `1b7d9df2d997776fe5453c7d8ea7c4e4c8fc3a4b`، ثم **Storage Settings read-only** عند feature `fa6486a3a14784d03dd00a868fb5e98c4ff4d2eb`. أُغلقت الآن **Self-development Candidate Review وRule Overlay bounded** بعقد `self-development.*` وخدمة in-memory، ثم **Memory Consolidation bounded** بعقد `memory-candidate.*` من مصادر `confirmed` فقط، دون تنفيذ النصوص أو تعديل core policy أو رفع الصلاحيات أو provider access. أُغلقت persistence الاختيارية عند feature `48daaf1f83bbc4cc7f01ff2a4e873c5e1a9a31ad` عبر migration 005، ثم أُغلقت شريحة local lexical retrieval عند feature `57376c3363b7d3b0670f7395bc61ea5e2613738b`، وتوسعة visibility filter عند feature `cf3227331384ab2f5b5b126fb0cf381c6ea8b8f1`، ثم relational MemoryEntry links عند feature `b4658e22690cc1b69d43fc1d25c5cffa6f72844d` عبر migration 006، ثم agent scope/permission filtering عند feature `909b67c2e8c2ffa764b5139965252f54cf710601`، ثم Markdown export preview bounded عند feature `194730e0c5777f8ff50e184345fca1518492c49e` مع evidence traceability ودون كتابة ملفات. أثبت runtime الحالي أن FTS5 غير متوفر (`no such module: fts5`)، لذلك يبقى FTS adapter اختياريًا بعد مراجعة مستقلة، بينما تظل كتابة destinations وPDF/HTML/PPTX وembeddings/vector services وexternal providers خلف consent وpolicy. تبقى البنية الحالية في `src/` مرجعًا حيًا، ولا يُنفذ نقل كبير إلى monorepo أو microservices إلا بعد إثبات حاجة تشغيلية.

## 3. الرؤية الوظيفية للأقسام الثلاثة

| القسم | النتيجة الأساسية | واجهته الأساسية | ما يشاركه | ما يجب أن يبقى خاصًا به |
|---|---|---|---|---|
| Intelligent Software Development Environment | تغيير برمجي قابل للمراجعة مع diff واختبارات وتراجع | File Tree، Editor، Terminal، Git، Embedded Simulator، Inspector | Workspace، Agents، Providers، Memory، Jobs، Policy | project scanner، code intelligence، terminal، test runner، preview runtime |
| Production Studio | مستند أو عرض أو ملف وسائط قابل للتصدير مع مصدر ونسخة وفحص جودة | Brief، Sources، Outline، Canvas، Assets، Render، Export | Projects، Artifacts، Citations، Jobs، Agents، Memory | content plan، asset pipeline، converters، render validators، provenance |
| Second Brain | معرفة قابلة للبحث والربط مرتبطة بمشاريع ومهام ومصادر | Inbox، Notes، Graph/Links، Search، Timeline، Review | Notes، Documents، Embeddings، Permissions، Activity، Agents | scopes، FTS، memory consolidation، provenance، retention |

الربط بين الأقسام يكون عبر عقود مشتركة فقط. فعند إنشاء مشروع برمجي يمكن تحويل قرار أو تقرير إلى Note في Second Brain، وعند إنشاء تقرير يستعمل Production Studio مصادر Second Brain، وعند طلب تغيير برمجي يستعمل Agent Runtime سياق المشروع والذاكرة المسموح بها. لا تستورد وحدة إنتاج المستندات جداول SQLite الداخلية لوحدة التطوير مباشرة، ولا يقرأ Second Brain ذاكرة خاصة دون `scope` و`visibility`.

## 4. المعمارية المستهدفة

الاختيار الأساسي هو **Modular Desktop Monolith مع Process Isolation**، وليس microservices في النسخة المحلية الأولى. يتكون النظام من Desktop Shell، Renderer UI، Typed Preload/IPC، Application Core، Agent Runtime، Provider Gateway، Policy Engine، Data Layer، وWorkers. هذا الفصل يستفيد من فصل core/desktop في OpenCode، ومن وضوح agent loop وtools وsession storage في Hermes Agent، ومن capability seams في DeepSeek Harness؛ لكنه لا ينسخ كودًا منها تلقائيًا [1] [2] [3].

```text
Renderer UI (RTL/LTR)
        │ typed preload functions فقط
Typed Electron Preload / IPC
        │ validated requests/events
Desktop Main Broker
        ├── Application Core
        │     ├── Workspace / Project / Task / Artifact
        │     ├── Policy & Approval
        │     ├── Job Supervisor / Checkpoints
        │     └── Shared Event Bus
        ├── Agent Runtime Worker
        ├── Provider Gateway Worker
        ├── Tool Workers
        │     ├── Filesystem
        │     ├── Terminal
        │     ├── Git/GitHub
        │     ├── Browser/MCP
        │     └── Document/Media
        └── SQLite + FTS5 + Content-addressed Object Store
```

البنية البرمجية المقترحة داخل المستودع هي امتداد تدريجي للبنية الحالية، لا إعادة كتابة شاملة:

```text
src/
  domain/                 # entities, value objects, events, policies
  application/            # use cases and ports
  infrastructure/         # SQLite, filesystem, process, secrets, Git
  ipc/                    # versioned contracts, preload-facing handlers
  presentation/           # renderer contracts and UI composition
  mobile/                 # preview contracts, simulator transports
  agent/                  # runtime, orchestration, context packets
  providers/              # registry, routing, capability adapters
  tools/                  # manifests, permissions, bounded invocations
  modules/
    development/          # IDE, terminal, Git, project preview
    production/           # docs, slides, media, research
    brain/                # notes, search, links, memory
  workers/                # isolated jobs and process adapters
```

كل مسار جديد يتبع التسلسل الإلزامي: **architecture decision → port → contract test → in-memory adapter → bounded implementation → integration test → documentation**. لا يسمح بالوصول العشوائي بين الوحدات، ولا يعبر JSON من Worker إلى UI من دون validation، ولا تعبر تعليمات مصدر غير موثوق إلى Policy Engine كأنها أوامر.

## 5. العقود والبيانات المشتركة

يجب تثبيت العقود قبل توسيع الواجهات. العقود الجوهرية هي `Workspace` و`Project` و`AgentSession` و`Task` و`ToolManifest` و`PermissionGrant` و`ProviderCapability` و`MemoryItem` و`Source` و`Artifact` و`Job` و`Checkpoint` و`AuditEvent`. كل عقد يحمل `schema_version` و`created_at` و`updated_at` و`correlation_id`، وكل عملية خارجية تحمل `idempotency_key` عند الحاجة.

يبدأ التخزين بـ SQLite وFTS5 وfilesystem object store. تظل SQLite مصدر الحقيقة للجلسات والمهام والصلاحيات والمصادر والعلاقات، ويستخدم FTS5 للرسائل والملاحظات والنصوص المستخرجة. تحفظ المرفقات والإصدارات والمخرجات في مخزن content-addressed مع hash. يضاف LanceDB كخيار embedded بعد benchmark، أو Qdrant كخدمة محلية اختيارية عند تجاوز حدود SQLite؛ لا يصبح أي vector index مصدر الحقيقة [4] [5].

| المجال | الجداول/الكائنات | السياسة |
|---|---|---|
| Workspace وProjects | workspace، project، project_file، project_policy | root وvisibility وpolicy صريحة |
| Agents وTasks | agent_definition، session، task، task_step، checkpoint | فصل definition عن runtime، وحد concurrency |
| Providers | provider، model، capability، routing_decision | سبب الاختيار وprivacy metadata وfallback |
| Tools | tool_definition، permission_grant، tool_run، audit_event | default deny، scope، approval، timeout |
| Production | source، citation، content_plan، artifact، render_job، export | provenance وversion وrender evidence |
| Second Brain | note، link، tag، memory_item، embedding_index | scope وretention وsource وdelete propagation |
| Automation | workflow، trigger، job، job_step، delivery | policy-compiled، pause، retry، checkpoint |

الحذف ليس حذف صف فقط؛ يجب حذف الفهرس والـ embeddings والنسخ المؤقتة وفق retention policy. والنسخ الاحتياطي atomic: snapshot للقاعدة وmanifest وhashes للكائنات، مع تشفير الأسرار وعدم استعادتها إلى profile الإنتاج مباشرة قبل dry-run وchecksum.

## 6. الخطة التنفيذية المتسلسلة

### المرحلة 0 — تثبيت المنتج والنطاق والقرارات المانعة

**الهدف:** منع اتساع النطاق قبل إضافة قدرات مكلفة. يثبت الفريق MVP على فتح مشروع محلي، التخطيط، التعديل الآمن، التقرير، البحث، الذاكرة المحلية، المعاينة المدمجة، والتشغيل اليدوي/المساعد المحدود.

**المهام:**

1. اعتماد الأقسام الثلاثة وحدود كل قسم ونقاط الربط المشتركة.
2. تجميد القصص الحرجة US-001 إلى US-008 ومعايير قبولها.
3. تثبيت Electron كـ MVP desktop shell، وتأجيل Tauri إلى benchmark لاحق بدل خلط shellين.
4. إبقاء OpenTo في حالة `UNKNOWN / REQUIRES VALIDATION` حتى يظهر مصدر رسمي قابل للتحقق.
5. اعتماد Lightweight Web Preview الحالية بوصفها bounded renderer، لا native fidelity.
6. اعتماد low-memory profile لأجهزة Ubuntu ذات RAM 8GB: preview وagent concurrency محدودان، والعمليات الثقيلة اختيارية ولا تعمل عند الإقلاع.
7. إنشاء decision log لأي اختيار يخص React renderer أو SQLite driver أو provider أو license.

**بوابة الخروج:** لا يوجد feature بلا owner وscope وacceptance criteria وبيانات وصلاحية ومخرج تراجع. أي وظيفة لا تدخل MVP تسجل في backlog لا في core.

### المرحلة 1 — Desktop Shell وTyped Preload Boundary

**الهدف:** نقل النظام من in-memory prototype إلى حدود Desktop حقيقية من دون كشف Node APIs.

**المهام:**

1. إنشاء Electron main process ونافذة واحدة مع `contextIsolation` وsandbox وNode integration معطل في renderer.
2. بناء preload API allowlisted، مثل `workspace.open` و`preview.openProject` و`task.start` و`approval.respond`، بدل تمرير `ipcRenderer` خام.
3. إضافة sender validation وnavigation/window policy وCSP ورفض الرسائل غير المطابقة للإصدار.
4. ربط `preview.openProject` الحالي من preload إلى handler ثم إلى `FilesystemProjectPreviewService` و`EmbeddedSimulatorController`.
5. نقل Workspace prototype إلى UI فعلي يحافظ على File Tree وEditor وEmbedded Simulator وInspector وConsole.
6. إضافة error taxonomy واضحة: invalid request، domain error، permission denied، worker unavailable، internal error.

**معيار القبول:** يفتح المستخدم مشروعًا من root اختاره صراحة، يظهر bundle وpreview داخل اللوحة نفسها، ولا يرى renderer filesystem أو secrets أو IPC raw. يظل تشغيل scripts ممنوعًا افتراضيًا.

### المرحلة 2 — Data Layer وMigrations وObservability

**الهدف:** استبدال adapters المؤقتة بتخزين قابل للاستعادة والبحث والتدقيق.

**المهام:**

1. تنفيذ SQLite adapter خلف ports الحالية مع migration runner وschema version.
2. إكمال جداول workspace/project/session/task/job/artifact/source/audit/checkpoint والفهارس المطلوبة.
3. ربط SQLite اختياريًا داخل composition مع memory default وprofile close وrestart persistence وexplicit fallback.
4. إضافة FTS5 للرسائل والملاحظات والنصوص المستخرجة مع normalization للعربية دون فقد النص الأصلي.
5. إضافة object store content-addressed وmanifest وcleanup وquota.
6. إضافة structured JSONL logs وSQLite index وcorrelation IDs وevent replay محدود.
7. تنفيذ backup/restore dry-run وchecksum وmigration rollback profile منفصل.
8. إضافة test fixtures وmigration upgrade/downgrade tests وcrash recovery tests.

**معيار القبول:** restart لا يفقد session أو checkpoint، backup قابل للتحقق، migration فاشلة لا تفسد profile، والـ UI لا يتجمد عند فهرسة ملف كبير.

### المرحلة 3 — Policy وPermissions وSecrets وSafety Primitives

**الهدف:** جعل الأمان جزءًا من المسار الطبيعي قبل تشغيل الوكلاء والأدوات.

**المهام:**

1. تعريف classifications: `public`, `workspace`, `private`, `secret`, `restricted`.
2. تنفيذ default deny للصلاحيات مع `subject`, `resource`, `actions`, `conditions`, `expires_at`, `approval_id`.
3. إضافة OS secret store أو ملف مشفر owner-only مع redaction في logs وprompts وartifacts.
4. تنفيذ policy compiler يخرج allow/deny/approval required مع سبب قابل للعرض.
5. بناء data/instruction separation؛ كل README أو PDF أو webpage أو model output يعامل كبيانات غير موثوقة.
6. إضافة terminal limits وworking directory وenvironment allowlist وtimeout وoutput cap.
7. إضافة MCP catalog وserver identity وscope وconsent وcancellation، مع عدم الوثوق في annotations بلا تحقق.
8. كتابة threat tests لـ prompt injection وhostile repository وXSS/RCE وsecret leak وmalicious parser.

**معيار القبول:** لا يستطيع العامل منح نفسه صلاحية، ولا ينفذ write أو shell عالي الخطورة أو MCP tool خارجي دون Human Gate، وكل فعل خارجي يظهر في AuditEvent.

### المرحلة 4 — Agent Runtime وOrchestration

**الهدف:** بناء عقل تنفيذي محدود وقابل للإيقاف بدل عدة وكلاء مستقلين غير منضبطين.

**المهام:**

1. فصل `AgentDefinition` عن runtime وعن tool permissions وعن memory scope.
2. تنفيذ session state machine: created، planning، waiting_approval، running، paused، failed، completed، cancelled_with_recovery.
3. تنفيذ hierarchical supervisor + DAG task graph + isolated workers.
4. تعريف أدوار General Manager وProject Manager وPlanner وSpecialist وWorker وCritic وJudge وHuman Gate.
5. تمرير context packets محدودة بدل نسخ transcript كامل؛ حفظ النتائج الكبيرة كـ artifacts وإرسال hash/summary.
6. فرض output contract لكل Worker: result، evidence، assumptions، changed_files، next_recommendation.
7. إضافة token/context budget وretry policy وidempotency وcheckpoint وconflict record.
8. عدم تشغيل 70 process دائمًا؛ تسجل definitions ويحد scheduler عدد workers حسب CPU/RAM/GPU.

**معيار القبول:** workflow من ثلاث خطوات يستطيع الفشل وإعادة المحاولة والاستئناف، ولا يقبل Judge نتيجة بلا evidence، ولا يؤدي فشل worker إلى إغلاق UI أو فقدان session.

### المرحلة 5 — Provider Gateway وModel Routing

**الهدف:** تبديل local/remote providers دون تغيير ميزات الأقسام الثلاثة.

**المهام:**

1. إنشاء Provider Port وModel Capability وPrivacy Metadata وCost/Latency Metadata.
2. تنفيذ registry وhealth checks وfallback وcircuit breaker وquota tracking.
3. تسجيل سبب قرار routing وحفظ model/provider IDs مع كل job لإتاحة الإعادة.
4. إضافة local provider adapter لـ Ollama أو llama.cpp اختياريًا، مع عدم تحميل نموذج عند بدء MVP بلا طلب.
5. إضافة remote providers خلف adapter منفصل مع redaction وconsent وoffline fallback.
6. دراسة مفاهيم OmniRoute في registry/fallback/compression دون ربط التطبيق بها مباشرة إلا بعد dependency audit [6].
7. إضافة اختبارات 429 وtimeout وmalformed output وprovider privacy mismatch.

**معيار القبول:** تبديل provider لا يغير عقد task أو artifact، ويعرض النظام للمستخدم provider/model والسبب والحدود، ويعمل offline mode برسالة صريحة عن الميزات المتوقفة.

### المرحلة 6 — Intelligent Software Development Environment

**الهدف:** إكمال IDE الذكية حول دورة تغيير قابلة للمراجعة.

**المهام:**

1. دمج Monaco Editor وFile Explorer وcommand palette وproblem markers [7].
2. دمج xterm.js خلف Terminal Worker محدود، مع streaming وcancel وbackground sessions [8].
3. تنفيذ Project Context Index: files، manifest، Git status، conventions، test commands، policy.
4. إكمال دورة: request → constraints → plan → targeted read → patch → approval → checkpoint → apply → typecheck/test → diff → optional commit.
5. إضافة Git adapter وGitHub CLI adapter لعرض branch/status/diff وطلبات commit/push التي تحتاج approval [9].
6. جعل `preview.openProject` و`preview.refresh` واجهة فعلية للمعاينة المدمجة.
7. تنفيذ production root picker عبر typed preload وmain-process dialog مع canonical path validation ورفض المسار غير الصالح.
8. إبقاء `Lightweight Web Preview` هو adapter الأساسي لمشاريع React وReact Native، مع `ProjectKind` وcapability warnings وبدون تشغيل project scripts.
9. دراسة React Native Web/Metro adapter خلف `PreviewRuntime` فقط بعد benchmark وcontract parity؛ لا يستبدل lightweight fixture renderer تلقائيًا.
10. إبقاء Android Emulator وiOS Simulator transports اختيارية تغذي نفس Embedded Simulator Panel؛ native adapters لا تدخل قبل doctor/resource contracts ولا تكون dependency للإقلاع.
11. إضافة rollback إلى checkpoint، وtest command discovery دون تشغيل hooks أو postinstall تلقائيًا.

**معيار القبول:** US-001 وUS-002 وUS-003 تتحقق: فتح مشروع وحالته خلال الهدف المحدد، خطة قبل الكتابة، approval للأمر الحساس، diff واختبار وتراجع مرئي.

### المرحلة 7 — Production Studio: Documents وResearch

**الهدف:** تحويل بحث أو brief إلى مستند موثق قابل للتصدير، مع مصدر لكل claim.

**المهام:**

1. بناء Source Registry يحفظ URL/file hash/source span/read status وprovenance.
2. تنفيذ pipeline: source discovery → validation → claim extraction → outline → section generation → citation check → consistency review → assembly → render → export.
3. البدء بـ Markdown وHTML وPDF؛ تنفيذ create/edit/merge/split/reorder/extract/summarize/rewrite/cite/export.
4. تشغيل qpdf أو pdfcpu في worker مع quotas وtemporary directories [10] [11].
5. عزل Pandoc وLibreOffice خلف process adapters بعد مراجعة GPL ومتطلبات التوزيع، وعدم ربطهما داخل core التجاري افتراضيًا [12] [13].
6. إضافة critic للفactual claims وcitation validator وformat validator للترميز وRTL والصفحات.
7. حفظ artifact manifest بالأدوات والإصدارات والمصادر وhash وrender evidence.

**معيار القبول:** US-005 تتحقق: report Markdown/PDF يحمل citations قابلة للتتبع، ولا ينسب النظام مرجعًا لم تتم قراءة span منه، وأي فشل converter يظهر كـ fallback واضح لا كملف ناقص مكتمل.

### المرحلة 8 — Production Studio: Slides وImages وVideo

**الهدف:** التوسع من المستندات إلى العروض والوسائط دون خلط generation بالسياق أو إخفاء provenance.

**المهام:**

1. تعريف slide schema وtheme وlayout constraints وspeaker notes وvisual spec وsource refs.
2. تنفيذ outline → slide plan → asset jobs → assembly → render → overflow/contrast/empty-space checks → export.
3. دعم HTML أولًا ثم PPTX عبر renderer مستقل، مع export contract وvisual regression.
4. استخدام FFmpeg في worker بملف build/legal profile واضح، مع temp cleanup وCPU/RAM/time budget [14].
5. جعل image generation/editing provider اختياريًا، مع prompt/model/license/provenance لكل asset.
6. عدم إدخال ComfyUI في التوزيع التجاري core قبل مراجعة GPL؛ يمكن تشغيله كخدمة/worker منفصل عند قبول قانوني [15].
7. إضافة transcription/subtitles/voice-over للفيديو قبل التفكير في video generation الشاملة.

**معيار القبول:** artifact يمر render check، لا يوجد overflow أو contrast failure غير معلن، ويمكن إعادة إنتاجه من input hash وtheme وprovider/model IDs.

### المرحلة 9 — Second Brain: Capture وSearch وLinking

**الهدف:** بناء طبقة معرفة مرتبطة بالعمل وليست تطبيق Notes منفصلًا.

**المهام:**

1. تثبيت Inbox للملاحظات والملفات والمهام والقرارات والمصادر فوق Memory Capture وSQLite persistence الاختيارية الحالية.
2. بناء relational links بين note وproject وtask وfile وsession وdecision بدل فرض graph database في MVP، مع إبقاء `MemoryEntry` و`MemoryCandidate` مصدرَي بيانات محليين bounded.
3. تشغيل local lexical retrieval للعربية والإنجليزية مع normalization محسوب وترتيب deterministic واحتفاظ بالنص الأصلي؛ يبقى FTS5 مشروطًا بruntime يدعمه.
4. إضافة scopes وvisibility وretention و`searchable_by_agent` و`sendable_to_provider`.
5. تنفيذ note lifecycle: capture → parse/classify → link → index → retrieve → human review → consolidate.
6. منع تسريب scope إلى agent أو provider، وإضافة delete propagation للفهارس والembeddings والمخازن المؤقتة.
7. إضافة timeline وactivity وsource provenance وhuman-confirmed facts.

**معيار القبول:** US-006 تتحقق: إضافة ملاحظة عربية أو إنجليزية واسترجاعها مع project scope صحيح، ولا يظهر item محظور للوكيل أو provider.

### المرحلة 10 — Second Brain: Memory وEmbeddings وKnowledge Graph

**حالة البدء:** Memory candidates وconsolidation وSQLite persistence الاختيارية وlocal lexical retrieval أصبحت منفذة ومراجعة؛ FTS5 وembeddings وvector retrieval وknowledge graph لم تبدأ بعد.

**الهدف:** إضافة retrieval دلالي تدريجيًا دون تحويل vector index إلى مصدر حقيقة.

**المهام:**

1. تعريف memory candidates: summary، fact، decision، procedure، episode، مع importance وexpiry وsource.
2. تشغيل deduplication وsensitivity classifier وscope check وhuman confirmation قبل consolidation.
3. إضافة embeddings مع model_id وdimensions وcontent_hash وindex_version وscope.
4. benchmark LanceDB كخيار embedded، ثم Qdrant كخدمة محلية اختيارية عند الحاجة [4] [5].
5. دراسة Mem0 كـ provider اختياري للذاكرة، وGraphiti للروابط الزمنية، مع adapter isolation وlicense review [16] [17].
6. دراسة مبادئ Logseq وAppFlowy للـ UX فقط؛ لا ينسخ core AGPL داخل التوزيع التجاري بلا مراجعة [18] [19].
7. تنفيذ rebuild وstale-index detection وdelete consistency وretrieval evaluation.

**معيار القبول:** كل نتيجة retrieval تحمل source/version/scope، وتفشل الذاكرة بأمان عند stale index أو model change، ويمكن إعادة بناء الفهرس دون فقد النص الأصلي.

### المرحلة 11 — Voice Layer

**الهدف:** إضافة الصوت كطبقة اختيارية لا كاعتماد أساسي على نجاح المنتج.

**المهام:**

1. تعريف Audio Port وpermission وrecording lifecycle وdeletion policy.
2. استخدام Silero VAD للتقسيم وbarge-in، مع worker منفصل [20].
3. benchmark Whisper أو faster-whisper للـ STT المحلي/الاختياري [21] [22].
4. benchmark Piper للـ TTS والتحقق من جودة النموذج العربي قبل الالتزام [23].
5. إضافة streaming وinterrupt وpartial transcript وsource metadata.
6. إبقاء voice cloning أو OpenVoice خارج MVP بسبب مخاطر الحقوق والهوية [24].
7. اختبار العربية والإنجليزية والضوضاء والزمن والذاكرة، مع text fallback دائم.

**معيار القبول:** جلسة صوتية قابلة للحذف، permission واضحة، text fallback يعمل offline، ولا يرسل التسجيل إلى provider دون policy وconsent.

### مسار Avatar المؤجل — Virtual Human داخل Second Brain

هذا المسار **planned/deferred وdocumentation-only** في الوقت الحالي، ولا يغير ترتيب مراحل MVP أو يضيف dependency إلى runtime الحالي. بعد ثبات Voice Layer وSecond Brain وPerformance Governance، يمر التنفيذ المستقبلي بالمراحل المحددة في `docs/86-virtual-human-licensing-roadmap-and-decisions.md`: Research، Prototype، Avatar Runtime، TTS، Lip Sync، Agent Integration، Second Brain Integration، Wake Word، Desktop Overlay، Performance Optimization، Cross-platform Testing، ثم Production Hardening.

القرار المعماري هو فصل Character Model وAvatar Runtime وAnimation وFacial Rig وLip Sync وTTS وSTT وWake Word وAgent Brain وDesktop Overlay. يبدأ المسار المستقبلي بـstatic/text أو low-poly WebGL مع degradation ladder، ويمنع microphone وwake word وoverlay افتراضيًا. لا يُعلن دعم العربية/اللهجة اليمنية أو الاستخدام التجاري لأي model/voice قبل benchmark وprovenance وlicense review. لا توجد Avatar files أو packages أو models ضمن الشريحة الحالية.

**معيار القبول للدراسة:** توجد مقارنة Top-5، License Matrix، state machine، typed event/API design، privacy/security policy، performance budget، وroadmap 0–11 موثقة مع مصادر أولية؛ وتظل الدراسة منفصلة عن أي implementation.

### المرحلة 12 — Automation وJobs وScheduling

**الهدف:** إنشاء محرك workflows محلي محدود قابل للإيقاف والاستئناف، لا microservice دائم في MVP.

**المهام:**

1. تعريف Workflow وTrigger وStep وCondition وApproval Gate وResource Budget وRetry/Delivery Policy.
2. تنفيذ Manual وAssisted وAllowlisted Autonomous modes.
3. بناء policy compiler يمنع workflow من تغيير policy أو منح نفسه صلاحية أو إنشاء trigger لا نهائي.
4. إضافة local scheduler مع timezone وnext_run وlast_run وfailure_streak وsleep/resume وclock drift.
5. دعم file changed وGit status changed وmanual في MVP؛ تأجيل webhooks/calendar حتى auth/signature/replay contracts.
6. إضافة queue/supervisor وpause/cancel/run now/history/delete وcheckpoint/resume.
7. تنفيذ idempotency وcircuit breaker وfailure streak وdelivery policy؛ لا push أو external notification في autonomous mode بلا سياسة صريحة.
8. استخدام Hermes Agent مرجعًا/adapter محتملًا للـ skills والcron/gateway، دون تشغيل loop غير محدود [2].
9. دراسة Temporal كمرجع للنسخة السحابية طويلة المدى، لا كاعتماد MVP محلي [25].

**معيار القبول:** US-008 تتحقق: job مجدول محدود يمكن إيقافه واستعادته، retry لا يكرر فعلًا حساسًا، وفشل متتالٍ يوقف workflow ويطلب مراجعة.

### المرحلة 13 — Integrations وGitHub وMCP وOpenTo

**الهدف:** إضافة التكاملات الخارجية بعد ثبات العقود والسياسة.

**المهام:**

1. GitHub operations عبر adapter أو GitHub CLI مع scopes محددة وapproval للcommit/push [9].
2. MCP Client Worker مع catalog وconsent وper-server scopes وprogress/cancellation وaudit؛ لا يقرأ secrets العامة.
3. Browser Worker باستخدام Playwright في profile مؤقت، مع data/instruction labels وعدم تمرير صفحات الويب كتعليمات [26].
4. إضافة SearXNG أو search service فقط كـ wrapper منفصل وبعد license/privacy review؛ لا يدمج AGPL داخل core التجاري تلقائيًا.
5. إنشاء OpenToAdapter contract: detect/getCapabilities/openProject/sendCommand/subscribeEvents، والافتراضي `NOT_CONFIGURED`. لا reverse engineering ولا UI surface قبل evidence رسمي.
6. إضافة failure matrix للتكاملات: unavailable، unauthorized، rate limited، stale data، revoked consent.

**معيار القبول:** كل integration يمكن تعطيله والعودة إلى local-only mode، ولا ينهار القسم الذي يعتمد عليه عند تعطل provider أو MCP أو GitHub.

### المرحلة 14 — Performance وResilience وResource Governance

**الهدف:** ضبط الموارد قبل beta بدل اكتشاف تجمد UI بعد إضافة كل المكونات.

**المهام:**

1. إضافة benchmark harness لـ startup وnavigation وfirst token وRSS وCPU/GPU وqueue latency، مع profile مخصص لـUbuntu RAM 8GB.
2. تطبيق lazy loading للـ workers/providers وbounded caches وstreaming للملفات الكبيرة، ومنع تحميل local models عند الإقلاع.
3. تحديد concurrency budgets للـ agents/jobs/media/document parsers، مع default واحد في low-memory profile.
4. جعل worker crash قابلًا للاستعادة دون إغلاق renderer أو فقدان session.
5. إضافة cancellation propagation وtimeouts وbackpressure وoutput caps، مع latest-only refresh للـ preview.
6. تشغيل benchmark لملف 50MB ومعالجة مستند طويل بالمقاطع والـ progress/checkpoint.
7. تسجيل regression history في CI وعدم قبول تراجع صامت.

**بوابات القياس المبدئية:** warm start أقل من 3 ثوانٍ على Tier 1، p95 للتنقل المحلي أقل من 100ms، first token p95 أقل من 2.5 ثانية في benchmark محدد، RSS أقل من 500MB دون نموذج محلي، وفهرسة 50MB دون تجميد UI. يضاف low-memory gate: preview source ≤24MB، modules ≤256، assets ≤128، agent concurrency =1، و`performance:smoke` يمر تحت V8 heap 768MB.

### المرحلة 15 — Security Hardening وLicense/Supply Chain

**الهدف:** تحويل الأمن والامتثال إلى شروط release لا ملاحظات لاحقة.

**المهام:**

1. مراجعة Electron security baseline: isolation وsandbox وCSP وsender validation وnavigation policy.
2. تنفيذ fuzz/negative tests لعقود IPC وparsers وrenderers وmanifest وpath traversal.
3. تشغيل Gitleaks وTrivy وOpenSSF Scorecard في CI مع إصدارات مثبتة [27] [28] [29].
4. توليد SBOM وlicense report وthird-party notices لكل build.
5. تجميد lockfiles والتحقق من signatures/checksums وتدقيق transitive dependencies.
6. بناء open-source inventory حي يحدد `USE`, `WRAP`, `ADAPT`, `REFERENCE`, `DO NOT EMBED`.
7. إجراء legal review لكل AGPL/GPL/NOASSERTION وmodel weights وvoice assets وFFmpeg build configuration.
8. اختبار incident playbook: revoke/rotate secrets، quarantine job، restore clean profile، rollback release.

**معيار القبول:** لا توجد secrets في repository أو logs، وكل dependency لها license/evidence، والتهديدات الحرجة R-001 وR-002 وR-003 وR-006 وR-007 لها tests أو evidence لا وعود فقط.

### المرحلة 16 — CI/CD وCross-platform Packaging

**الهدف:** إنتاج artifacts قابلة للتثبيت والتحقق على Windows وLinux، ثم macOS عند توفر البيئة.

**المهام:**

1. تثبيت GitHub Actions matrix للـ typecheck/test/security/license/build.
2. بناء Windows Tier 1 وLinux Tier 1، وتسجيل macOS Tier 2 بعد توقيع مناسب.
3. إنتاج installer وartifact hash وSBOM وnotices وmigration manifest.
4. تنفيذ clean install smoke test وopen-project smoke test وoffline smoke test.
5. اختبار upgrade/migration/rollback من عدة إصدارات.
6. التحقق من optional dependencies: native modules، Android tools، audio codecs، local models.
7. إضافة release channel beta/stable وfeature flags للقدرات الثقيلة.

**معيار القبول:** clean install يفتح Workspace، يعمل local-only mode، يمر smoke test، ويعرض سبب تعطيل الميزات الاختيارية بدل الفشل الغامض.

### المرحلة 17 — Beta وAcceptance وRelease

**الهدف:** إطلاق Beta صغيرة قابلة للتراجع ثم توسيعها حسب evidence.

**المهام:**

1. تشغيل سيناريوهات القبول الثمانية end-to-end.
2. اختبار مستخدمين محدود مع telemetry opt-in فقط، وعدم إرسال محتوى خاص افتراضيًا.
3. قياس crash-free sessions وworker recovery وpreview correctness وcitation validity وsearch recall.
4. فتح release blocker list وإغلاق critical/high أو توثيق تعطيل feature.
5. نشر compatibility matrix للمنصات والـ toolchains والـ providers والـ optional runtimes.
6. إصدار support/runbook وbackup/restore guide وincident guide وmigration guide.
7. اعتماد rollback release وfeature kill switches.

**معيار القبول:** لا يوجد critical blocker معروف، user acceptance مكتمل للقصص الحرجة، backup/restore مجرب، والمنتج صريح بشأن ما هو compatibility وما هو native وما هو unavailable.

## 7. مصفوفة إعادة استخدام المشاريع المفتوحة المصدر

إعادة الاستخدام ليست نسخًا عشوائيًا ولا جمع dependencies كثيرة. كل مشروع يمر بثلاث مراحل: قراءة LICENSE والمصادر، استخراج contract/behavior المطلوب، ثم benchmark وsecurity/license review قبل إدخاله. لا ينسخ كود OpenCode أو Hermes أو DeepSeek Harness إلا عبر dependency واضحة أو إعادة تنفيذ مستقلة مع notices مناسبة.

| المشروع | طريقة الاستخدام | المرحلة | ما يؤخذ | ما لا يؤخذ |
|---|---|---|---|---|
| Electron | `USE` | 1 و16 | desktop shell وprocess model | لا تكشف Node APIs ولا تتجاوز security baseline |
| Monaco Editor | `USE` | 6 | code editor | لا يجعل editor مصدر صلاحيات |
| xterm.js | `USE` | 6 | terminal renderer | لا ينفذ shell في renderer |
| OpenCode | `ADAPT/WRAP` | 4 و6 | coding-agent/core/SDK/PTY patterns | لا نسخ core ولا صلاحياته كما هي |
| Hermes Agent | `ADAPT/WRAP` | 4 و12 | skills، memory، cron، gateway، subagents concepts | لا loops دائمة ولا صلاحيات عامة |
| DeepSeek Harness | `REFERENCE/ADAPT` | 4 | plugin seams وcapability composition | لا coupling غير موثق |
| OmniRoute | `REFERENCE/ADAPT` | 5 | registry/fallback/quota/compression concepts | لا dependency قبل audit |
| React Native Web / Expo Snack / browser-metro | `USE/WRAP/REFERENCE` | 6 | preview/runtime/bundling behind PreviewRuntime port | لا ادعاء native fidelity ولا تشغيل project scripts تلقائيًا |
| Playwright | `USE/WRAP` | 13 | browser automation وtests | profile دائم أو إرسال صفحات كتعليمات |
| GitHub CLI | `USE` | 6 و13 | GitHub operations عبر adapter | token داخل prompts أو logs |
| qpdf / pdfcpu | `USE/WRAP` | 7 | PDF operations في worker | parser بلا quota أو isolation |
| Pandoc / LibreOffice | `WRAP بعد legal review` | 7 | conversion process عند الحاجة | link/embedding تجاري تلقائيًا بسبب GPL |
| FFmpeg | `WRAP مع notices` | 8 | transcoding/subtitles/audio/video | build configuration غير مدقق |
| Mem0 / Graphiti | `ADAPT` | 10 | memory/temporal graph providers | مصدر حقيقة بديل عن النص والـ provenance |
| LanceDB / Qdrant | `OPTIONAL ADAPT/WRAP` | 10 | embeddings/vector retrieval | إدخاله قبل benchmark أو جعله إلزاميًا |
| Whisper / faster-whisper | `OPTIONAL USE/WRAP` | 11 | multilingual STT | وعد جودة العربية قبل benchmark |
| Piper / Silero VAD | `OPTIONAL USE/WRAP` | 11 | TTS/VAD | voice cloning افتراضي |
| Ollama / llama.cpp | `OPTIONAL WRAP` | 5 و11 | local model management/inference | تحميل نموذج أو GPU requirement بلا policy |
| Gitleaks / Trivy / Scorecard | `USE IN CI` | 15 و16 | secret/vulnerability/supply-chain checks | اعتبار الفحص بديلًا عن sandbox |
| Logseq / AppFlowy | `REFERENCE` | 9 | UX وgraph/workspace ideas | نسخ AGPL core بلا مراجعة |
| OpenViking / SearXNG / ComfyUI / n8n | `DO NOT EMBED BY DEFAULT` | حسب الحاجة | أفكار أو wrapper خارجي بعد legal review | إدماج AGPL/GPL/ترخيص غير محسوم في commercial core |
| Temporal / LangGraph / CrewAI | `REFERENCE` | 4 و12 | durable workflows وDAG/roles concepts | زيادة التعقيد قبل إثبات الحاجة |
| OpenTo | `CONTRACT ONLY` | 13 | adapter interface بعد مصدر رسمي | reverse engineering أو ادعاء API |

### سياسة الترخيص

لا تضاف dependency إلى root إلا بعد lockfile وSBOM وlicense report وsecurity review. ويجب حفظ `NOTICE` وsource snapshot وversion وhash وقرار التصنيف. التراخيص `NOASSERTION` ليست موافقة تلقائية، وAGPL/GPL وmodel weights وvoice assets وFFmpeg configuration تحتاج مراجعة مستقلة. إذا تعذر إدماج dependency، يستخدم التطبيق adapter process أو بديل permissive أو يؤجل feature.

## 8. مسارات التكامل الرئيسية

### فتح مشروع ومعاينته

```text
User chooses root
→ Renderer calls typed preload
→ IPC validates request and policy
→ FilesystemProjectScanner reads bounded files
→ ProjectPreviewService builds bundle
→ EmbeddedSimulatorController starts session
→ Presentation Renderer mounts PreviewRenderNode
→ Inspector receives summary/diagnostics
```

لا يمر `rootPath` إلى controller كصلاحية مفتوحة؛ controller يستقبل bundle فقط. ولا يقرأ scanner خارج root أو يتبع symlinks أو يشغل package scripts.

### تغيير برمجي آمن

```text
Request
→ project context
→ editable plan
→ risk classification
→ approval if needed
→ checkpoint
→ isolated worker
→ patch
→ typecheck/test
→ diff review
→ optional commit/push approval
→ audit + memory candidate
```

### إنتاج تقرير أو عرض

```text
Brief
→ source registry
→ claim/source validation
→ content plan
→ agent sections
→ asset jobs
→ assembly
→ render
→ overflow/citation/consistency checks
→ artifact manifest
→ export
```

### دورة Second Brain

```text
Capture
→ classify
→ link to project/task/source
→ FTS index
→ optional embedding index
→ scoped retrieval
→ human review
→ consolidation with provenance
```

### دورة Automation

```text
Trigger
→ validate workflow
→ compile policy
→ create job/checkpoint
→ execute bounded steps
→ approval gate
→ result/delivery
→ pause/retry/recovery
→ audit
```

## 9. بوابات الجودة المشتركة لكل مرحلة

| البوابة | ما يجب إثباته قبل الانتقال |
|---|---|
| Contract | types، schema_version، malformed input، backward behavior |
| Security | least privilege، default deny، redaction، path/root boundary، prompt injection test |
| Reliability | timeout، cancellation، retryability، idempotency، checkpoint، recovery |
| Evidence | diff/test output أو source spans أو render check أو artifact manifest |
| Performance | benchmark وresource caps وregression result |
| UX | RTL/LTR، keyboard، accessibility، error explanation، source/permission transparency |
| Legal | license، notices، SBOM، model/asset provenance، build profile |
| Delivery | clean install، migration dry-run، artifact hash، GitHub SHA، worktree clean |

## 10. مصفوفة المتطلبات القابلة للقياس

| المتطلب | الهدف المبدئي | المرحلة التي تثبته |
|---|---|---|
| فتح Workspace | أقل من 3 ثوانٍ مع cache دافئ على Tier 1 | 1 و14 |
| التنقل المحلي | p95 أقل من 100ms | 1 و14 |
| أول token | p95 أقل من 2.5s في benchmark محدد | 5 و14 |
| الذاكرة | أقل من 500MB دون نموذج محلي | 14 |
| عزل worker | crash لا يغلق renderer ولا يفقد session | 4 و14 |
| ملف 50MB | streaming دون تجميد UI | 2 و14 |
| document طويل | chunks + progress + checkpoint | 7 و14 |
| الأسرار | OS store/encrypted owner-only + redaction | 3 و15 |
| MCP | consent وscope وaudit | 3 و13 و15 |
| automation | caps وpause وidempotency وfailure stop | 12 |
| التوافق | Windows/Linux Tier 1؛ macOS Tier 2 | 16 و17 |
| التدويل | RTL/LTR وArabic mixed layout وcode LTR | 1 و6 و7 و9 |

## 11. خطة العمل والـ commits

كل commit يجب أن يمثل شريحة يمكن تشغيلها أو اختبارها، لا خليطًا من features غير مرتبطة. التسلسل المقترح هو:

| الترتيب | نوع commit | النطاق |
|---:|---|---|
| 1 | `feat: add typed electron preload boundary` | main/preload/IPC validation |
| 2 | `feat: persist foundation state in sqlite` | adapter/migrations/backup |
| 3 | `feat: add policy and secret boundaries` | permissions/redaction/approval |
| 4 | `feat: add bounded agent runtime` | sessions/DAG/workers/checkpoints |
| 5 | `feat: add provider gateway` | registry/routing/fallback/local mode |
| 6 | `feat: complete development workspace` | Monaco/xterm/Git/project context |
| 7 | `feat: add document production pipeline` | sources/citations/Markdown/PDF |
| 8 | `feat: add slide and media pipeline` | slide schema/render/media workers |
| 9 | `feat: add second brain search and links` | notes/FTS/scopes |
| 10 | `feat: persist bounded second-brain memory` | SQLite migration 005 وrestart hydration وredaction وfail-closed validation |
| 11 | `feat: add bounded local lexical retrieval` | Arabic/English normalization وall-token matching وdeterministic ranking وvisibility filter، مع تأجيل FTS5 عند غياب module |
| 12 | `feat: add optional semantic memory` | embeddings/providers/benchmarks |
| 13 | `feat: add optional voice pipeline` | VAD/STT/permissions |
| 14 | `feat: add bounded local automation` | workflows/scheduler/recovery |
| 15 | `feat: add external integration adapters` | GitHub/MCP/browser/OpenTo contract |
| 16 | `perf: add resource governance and benchmarks` | caps/regressions/recovery |
| 17 | `security: harden release boundary` | Electron/CI/SBOM/licenses |
| 18 | `release: package beta artifacts` | installers/migrations/smoke tests |

بعد كل commit: `pnpm check`، migration validation، `git diff --check`، secret scan، license/security checks المناسبة، ثم `git push` ومقارنة `LOCAL_SHA` مع GitHub `REMOTE_SHA`. لا يعلن عن نجاح الدفع دون تطابق hash ونظافة الشجرة.

## 12. ترتيب الأولويات والميزات المؤجلة

### يدخل MVP الأساسي

يدخل MVP: Electron shell، typed preload/IPC، Workspace، File Tree، Monaco، Terminal bounded، Git diff، Plan/Approval، SQLite/FTS5، Project Preview/Embedded Simulator compatibility mode، Markdown/PDF، basic Second Brain search، local-only mode، logs/audit، backup، CI/security gates.

### يدخل بعد ثبات MVP

تأتي بعد ذلك Provider routing المتعدد، Agent DAG، slide/PPTX، media workers، embeddings، optional local models، voice، automation، MCP/browser integrations، ثم React Native Web/Metro adapter الفعلي وAndroid/iOS transports.

### لا يدخل افتراضيًا

لا يدخل افتراضيًا OpenTo integration بلا source رسمي، ولا native Android/iOS قبل doctor/resource contracts، ولا autonomous workflows بلا allowlist وcaps، ولا voice cloning، ولا AGPL/GPL core داخل التوزيع التجاري بلا مراجعة قانونية، ولا vector database إلزامي، ولا multi-user cloud architecture في MVP.

## 13. المخاطر وترتيب معالجتها

| الأولوية | المخاطر | الاستجابة التنفيذية |
|---:|---|---|
| 1 | OpenTo غير محدد، scope متسع | contract only، MVP freeze، decision log |
| 2 | prompt injection، hostile repository، secret leak | data/instruction separation، sandbox، approval، redaction، scans |
| 3 | license incompatibility | classification matrix، notices، legal gate، process isolation |
| 4 | UI freeze وresource overload و70 agents | workers، caps، lazy loading، concurrency governor، benchmarks |
| 5 | provider quota/hallucination/privacy mismatch | routing/fallback، evidence، citations، policy metadata |
| 6 | runaway automation وstale memory | policy compiler، pause، idempotency، source/version/expiry |
| 7 | native dependency Windows/macOS | CI matrix، optional adapters، compatibility matrix، fallback |

لا تخفض الوثائق وحدها درجة الخطر؛ كل تخفيف يحتاج test أو benchmark أو evidence قابلًا للمراجعة.

## 14. تعريف الإنجاز النهائي

يعتبر Osamah Studio Agent جاهزًا للإصدار الأول عندما يستطيع المستخدم فتح مشروع محلي، قراءة حالته، طلب خطة، اعتماد أو رفض الأفعال الحساسة، تنفيذ patch قابل للتراجع، مشاهدة diff واختبار، إنتاج تقرير أو عرض موثق، حفظ واسترجاع معرفة ضمن scope، تشغيل workflow محدود قابل للإيقاف، والعمل offline في الأساسيات. يجب أن يكون كل ذلك داخل Workspace واحد، مع embedded simulator جزءًا أساسيًا من بيئة التطوير لا أداة اختبار خارجية.

كما يجب أن يعرف المستخدم بوضوح مصدر كل نتيجة: هل هي من ملف محلي؟ من provider؟ من ذاكرة مؤكدة؟ من fixture compatibility preview؟ وما الصلاحية التي استعملت؟ لا يكتمل المنتج بمجرد كثرة الوكلاء؛ يكتمل عندما يكون **مفهومًا، قابلًا للتراجع، قابلًا للتدقيق، صريحًا بشأن حدوده، ومحافظًا على بيانات المستخدم**.

## 15. مراجع المشروع والمصادر المفتوحة

المراجع الداخلية الأساسية هي [متطلبات المنتج](03-product-requirements.md)، و[المعمارية العليا](06-system-architecture.md)، و[معمارية الوكلاء](07-ai-agent-architecture.md)، و[المشهد مفتوح المصدر](08-open-source-landscape.md)، و[معمارية البيانات](11-data-architecture.md)، و[Automation System](16-automation-system.md)، و[Security Model](17-security-model.md)، و[Production Studio](23-production-studio.md)، و[بيئة التطوير الذكية](24-smart-development-environment.md)، و[خارطة الطريق السابقة](25-project-roadmap.md)، و[سجل المخاطر](26-risk-register.md)، و[Open Source Map](reference/OPEN_SOURCE_MAP.md)، و[الحالة التشغيلية](../PROJECT_STATE.md).

[1]: https://github.com/anomalyco/opencode "OpenCode"
[2]: https://github.com/NousResearch/hermes-agent "Hermes Agent"
[3]: https://github.com/deepseek-ai/deepseek-harness "DeepSeek Harness"
[4]: https://github.com/lancedb/lancedb "LanceDB"
[5]: https://github.com/qdrant/qdrant "Qdrant"
[6]: https://github.com/diegosouzapw/OmniRoute "OmniRoute"
[7]: https://github.com/microsoft/monaco-editor "Monaco Editor"
[8]: https://github.com/xtermjs/xterm.js "xterm.js"
[9]: https://github.com/cli/cli "GitHub CLI"
[10]: https://github.com/qpdf/qpdf "qpdf"
[11]: https://github.com/pdfcpu/pdfcpu "pdfcpu"
[12]: https://github.com/jgm/pandoc "Pandoc"
[13]: https://github.com/LibreOffice/core "LibreOffice"
[14]: https://github.com/FFmpeg/FFmpeg "FFmpeg"
[15]: https://github.com/Comfy-Org/ComfyUI "ComfyUI"
[16]: https://github.com/mem0ai/mem0 "Mem0"
[17]: https://github.com/getzep/graphiti "Graphiti"
[18]: https://github.com/logseq/logseq "Logseq"
[19]: https://github.com/AppFlowy-IO/AppFlowy "AppFlowy"
[20]: https://github.com/snakers4/silero-vad "Silero VAD"
[21]: https://github.com/openai/whisper "Whisper"
[22]: https://github.com/SYSTRAN/faster-whisper "faster-whisper"
[23]: https://github.com/rhasspy/piper "Piper"
[24]: https://github.com/myshell-ai/OpenVoice "OpenVoice"
[25]: https://github.com/temporalio/temporal "Temporal"
[26]: https://github.com/microsoft/playwright "Playwright"
[27]: https://github.com/gitleaks/gitleaks "Gitleaks"
[28]: https://github.com/aquasecurity/trivy "Trivy"
[29]: https://github.com/ossf/scorecard "OpenSSF Scorecard"

إعداد: Manus AI. تاريخ الخطة: 2026-08-22.
