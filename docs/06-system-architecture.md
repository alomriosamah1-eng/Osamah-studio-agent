# المعمارية العليا

## القرار

المعمارية المختارة هي **Modular Desktop Monolith مع Process Isolation**. يوجد desktop shell، وواجهة renderer، وapplication core، وagent runtime، وprovider gateway، وdata layer، وworkers. الوحدات تتشارك contracts لا استيرادات عشوائية. أي مكون عالي المخاطر أو ثقيل يمكن تشغيله خارج العملية الرئيسية.

هذا القرار يستفيد من فصل OpenCode بين core وdesktop وحزم SDK [1]، ومن طبقات Hermes التي تجعل agent loop وtool registry وsession storage وgateway حدودًا واضحة [2]، ومن مبدأ capability seams في DeepSeek Harness [3].

## المخطط

```mermaid
flowchart LR
  UI[Renderer UI\nRTL/LTR Workspace] --> PRELOAD[Preload / IPC Contract]
  PRELOAD --> SHELL[Desktop Shell\nElectron MVP]
  SHELL --> CORE[Application Core]
  CORE --> ORCH[Agent Orchestrator]
  CORE --> POLICY[Policy & Approval Engine]
  CORE --> DATA[SQLite + FTS5 + Object Store]
  ORCH --> ROUTER[Provider Router]
  ORCH --> TOOLS[Tool Registry]
  ORCH --> MEMORY[Memory Service]
  TOOLS --> FS[Filesystem Worker]
  TOOLS --> TERM[Terminal Worker]
  TOOLS --> MCP[MCP Client Worker]
  TOOLS --> GIT[Git/GitHub Adapter]
  ORCH --> JOBS[Job Queue + Supervisor]
  JOBS --> MEDIA[Media/Document Workers]
  CORE --> OPENTO[OpenTo Adapter\ncontract only until verified]
  ROUTER --> LOCAL[Local Providers]
  ROUTER --> REMOTE[Optional Remote Providers]
```

## حدود العملية

تعمل الواجهة في renderer غير موثوق نسبيًا ولا تملك filesystem أو secrets. يعمل main process كـ broker محدود. يعمل agent runtime في worker/process مستقل كي لا يؤدي loop أو model client إلى تجميد الواجهة. تعمل أدوات shell وbrowser وdocument conversion بحدود منفصلة، مع working directory وenvironment وtimeout خاص بكل job. لا تُمنح MCP servers صلاحية عامة؛ كل server يمر عبر catalog وconsent وscope.

## دورة المهمة

```mermaid
sequenceDiagram
  participant U as User
  participant UI as UI
  participant O as Orchestrator
  participant P as Policy
  participant T as Tool
  participant D as Data
  U->>UI: Request
  UI->>O: Create session + task
  O->>D: Load project context
  O->>O: Plan and risk classify
  O->>P: Request approval if needed
  P-->>U: Explain action and scope
  U-->>P: Approve / reject
  P->>T: Execute bounded tool
  T->>D: Checkpoint + audit event
  T-->>O: Result / error
  O->>D: Persist transcript and memory candidate
  O-->>UI: Progress, diff, artifact, next action
```

## العقود الداخلية

العقود الأساسية هي `AgentSession`, `Task`, `ToolManifest`, `PermissionGrant`, `ProviderCapability`, `MemoryItem`, `Artifact`, `Job`, و`AuditEvent`. كل عقد يحمل `schema_version` و`created_at` و`correlation_id`. لا يعبر أي JSON من worker إلى UI دون validation؛ ويجب أن تكون نتائج الأدوات data-only حتى لا تتحول نصوص tool إلى تعليمات للوكيل.

## OpenTo

يُعرّف `OpenToAdapter` عمليات `detect()`, `getCapabilities()`, `openProject()`, `sendCommand()`, و`subscribeEvents()`، لكن implementation الافتراضي يعيد `NOT_CONFIGURED`. لا يجوز بناء IPC أو plugin خاص بـ OpenTo على التخمين. عند وصول مواصفة رسمية، يُضاف contract test يثبت الإصدار والمنصة ونموذج الصلاحيات.

## لماذا لا microservices الآن؟

microservices ستضيف deployment وservice discovery وauth وversioning قبل وجود مستخدمين أو حمل متعدد الأجهزة. process isolation يحقق عزلًا كافيًا لسطح المكتب، ويمكن استخراج worker إلى خدمة لاحقًا إذا ظهرت حاجة. النواة تبقى modular monolith لتقليل التكلفة المعرفية.

## References / المراجع

[1]: https://github.com/anomalyco/opencode "OpenCode repository"
[2]: https://github.com/NousResearch/hermes-agent "Hermes Agent repository"
[3]: https://github.com/deepseek-ai/deepseek-harness "DeepSeek Harness repository"

إعداد: Manus AI. تاريخ الفحص: 2026-08-21.
