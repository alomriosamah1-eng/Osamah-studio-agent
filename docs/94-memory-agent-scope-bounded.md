# Second Brain: Agent Scope Filtering bounded

**الحالة:** منفذة ومتحقق منها في feature commit `909b67c2e8c2ffa764b5139965252f54cf710601`. تضيف هذه الشريحة مرشح `agentId` موثوقًا عبر `brain.memory.searchLocal`، ويربطه بمتطلبات الذاكرة الثابتة في `AgentCatalog` قبل إرجاع أي نتيجة.

## الهدف والحدود

الهدف هو منع agent من طلب نطاق ذاكرة أوسع من المتطلبات المعلنة في تعريفه. لا يعتمد البحث على نص scope يرسله المستخدم، ولا يسمح للـrenderer بإنشاء policy جديدة. يستمد القرار من `InMemoryAgentCatalog` محليًا، ويطبق visibility وretention وproviderAccess قبل lexical scoring.

> **تمييز مهم:** هذه الشريحة policy filter محلي وليست authentication أو authorization system كاملًا. لا تثبت هوية caller خارج typed IPC، ولا تنشئ session claims أو role management أو multi-tenant isolation.

| المجال | التنفيذ |
|---|---|
| مصدر السياسة | `AgentCatalogPort.get(agentId)` ومتطلبات `memoryRequirements` الموجودة في تعريف الوكيل |
| سطح الطلب | `brain.memory.searchLocal` يقبل `agentId` اختياريًا؛ لا method IPC جديدة |
| visibility | يسمح بنتائج لا تتجاوز visibility المعلنة للوكيل؛ ويمكن طلب filter أضيق فقط |
| retention | agent ذو `session` لا يرى `project` أو `until_deleted`؛ و`project` لا يرى `until_deleted` |
| providerAccess | scope `never` لا يرى entries ذات `explicit_only`؛ scope `explicit_only` يسمح بالاثنين دون provider call |
| unknown/invalid | `agentId` غير الآمن أو المجهول أو scope غير السليم يفشل مغلقًا |
| default path | غياب `agentId` يبقي السلوك المحلي السابق دون scope إضافي؛ لا يغير backend in-memory أو SQLite |
| الأداء | Map scan bounded، بلا model loading أو network أو graph/vector retrieval |

## مسار القرار

يمر الطلب من typed IPC validation إلى handler ثم Application. يطبع Application `agentId` عبر safe lowercase identifier، ويستدعي scope port المربوط بالكتالوج. إذا وجدت policy سليمة، يقارن visibility وretention وproviderAccess لكل entry قبل احتساب ترتيب العنوان والوسوم والمحتوى. إذا طلب caller visibility أوسع من scope، يرفض الطلب بدل إرجاع قائمة فارغة أو توسيع policy.

```text
brain.memory.searchLocal(query, agentId?, visibility?)
                         │
                         ▼
              typed IPC allowlist + safe ID
                         │
                         ▼
              AgentCatalog memoryRequirements
                         │
                         ▼
        visibility / retention / providerAccess gate
                         │
                         ▼
                bounded local lexical ranking
```

لا يمر `agentId` إلى SQLite أو provider أو filesystem، ولا يخزن في MemoryEntry. لذلك يبقى نفس entry قابلًا للاستعادة من SQLite، بينما يعاد تطبيق scope عند كل بحث جديد.

## قواعد السلامة

ترتب مستويات visibility محليًا من `private` إلى `workspace` ثم `project`، وترتب retention من `session` إلى `project` ثم `until_deleted`. يسمح scope بقراءة مستوى مساوي أو أضيق فقط. يسمح طلب visibility أضيق من scope، بينما يرفض طلب مستوى أوسع برسالة fail-closed. وتبقى `providerAccess=never` قاعدة مستقلة؛ لا يحول agent scope البحث المحلي إلى إذن لاستدعاء provider.

تعتمد policy على catalog static definitions، وجميع التعريفات الحالية تبدأ بمتطلبات `private/session/never`. هذا يجعل المسار الافتراضي محافظًا، ولا يعني أن وجود `agentId` يثبت caller identity. لا توجد في هذه الشريحة صلاحية `approve` أو `apply`، ولا تعديل للـHuman Gate أو permissions أو core policy.

## الاختبارات

تغطي اختبارات Application عرض `session/private` أمام agent scope `workspace/project/never`، وإخفاء `until_deleted` و`explicit_only`، السماح بفلتر private الأضيق، ورفض فلتر project الأوسع، unknown agent، وunsafe `agentId`. ويثبت اختبار Embedded Application أن scope `qa-testing` يعمل عبر typed IPC بعد SQLite restart، بينما يُرفض `bad_agent` قبل handler.

| معيار القبول | الحالة |
|---|---|
| agent scope لا يأتي من payload حر أو caller قابل للإنشاء | متحقق؛ المصدر AgentCatalog المربوط في composition |
| visibility widening مرفوض | متحقق؛ scope workspace يرفض project ويقبل private |
| retention widening مرفوض | متحقق؛ session/project لا يرى retention أوسع |
| provider access لا يتحول إلى provider call | متحقق؛ filter محلي فقط وscope never يخفي explicit_only |
| unknown/unsafe agentId fail-closed | متحقق عبر Application وtyped IPC validators |
| default search دون agentId لا يتغير | متحقق؛ الخيارات الاختيارية تحافظ على المسار السابق |
| restart يعيد تطبيق scope | متحقق عبر `memory-persistence.test.ts` |
| لا embeddings أو FTS5 أو vector service أو provider sharing أو Avatar runtime | متحقق كحدود تصميم وتنفيذ |

## الأداء والتشغيل

لا تضيف الشريحة worker أو cache أو index جديدًا. كل بحث يبقى bounded بحد `limit <= 128`، وعدد الإدخالات المحملة بحد `256`. لا يحدث أي تحميل نموذج عند startup، ولا توجد network calls، ولا تعتمد الشريحة على FTS5 غير المتوفر في runtime الحالي. تظل مناسبة لسياسة Ubuntu/Linux 8GB، مع ضرورة قياس p95 وRSS إذا تطور scope إلى graph traversal أو persistent index.

## بوابة التحقق

نجحت البوابة في 2026-08-22 مع `pnpm check` بـ`208/208`، و`pnpm build`، و`pnpm desktop:smoke`، و`pnpm performance:smoke`. بقي SQLite validator عند `MIGRATION_COUNT=6` و`SCHEMA_VERSION=006` و`TABLE_COUNT=14` و`INDEX_COUNT=30`. كما نجحت JSON validation وNode syntax و`git diff --check` وhigh-confidence secret scan. سجل البوابة محفوظ في [research/memory-agent-scope-full-gate-output-2026-08-22.txt](../research/memory-agent-scope-full-gate-output-2026-08-22.txt).

## ما يلي هذه الشريحة

الخطوة التالية هي مراجعة FTS adapter مشروط أو مسار relational/agent authorization أعمق إذا ظهرت حاجة فعلية، ثم قرار مستقل حول semantic memory. لا تبدأ embeddings أو vector services أو provider sharing أو automatic consolidation. يظل Virtual Human / AI Avatar موثقًا ومؤجلًا حتى مرحلته، ولا تفتح هذه الشريحة voice أو TTS/STT أو overlay runtime.

إعداد: Manus AI. تاريخ التحديث: 2026-08-22.

## مراجع داخلية

[1]: ../src/application/agent-catalog.ts "Agent definitions and memory requirements"
[2]: ../src/application/memory-capture.ts "Memory agent scope filtering"
[3]: ../src/ipc/contracts.ts "Typed IPC search validation"
[4]: ../src/ipc/embedded-handlers.ts "Embedded memory search handler"
[5]: ../src/memory-persistence.test.ts "Restart and typed IPC scope test"
[6]: ../research/memory-agent-scope-full-gate-output-2026-08-22.txt "Agent scope full gate output"
