# Agent Definition Contract وAgent Catalog

## القرار

تحتاج منظومة Osamah Studio Agents إلى عقد موحد يصف الوكيل قبل إنشاء orchestrator أو pool أو tool execution. لذلك أضيف `AgentDefinition` و`AgentCatalogPort` كطبقة Application bounded، مع `InMemoryAgentCatalog` كتنفيذ محلي deterministic. هذا العقد لا يشغّل وكيلًا، ولا يكتشف provider، ولا ينشئ approval ticket، ولا يغير filesystem.

> **تعريف لا يعني تنفيذًا:** وجود تعريف في الكتالوج يصف الدور والحدود والتبعيات المقترحة، لكنه لا يثبت أن الوكيل منفذ أو قادر على الاستقلال.

## حقول العقد

| المجموعة | الحقول | الغرض |
|---|---|---|
| الهوية | `schemaVersion`, `agentId`, `role`, `executionStatus` | هوية مستقرة وحالة تنفيذ صريحة |
| المهمة | `mission`, `responsibilities`, `inputs`, `outputs` | منع الأدوار الغامضة وتحديد handoff packet |
| الحدود | `tools`, `permissions`, `decisionAuthority`, `humanApprovalRequirements` | فصل الاقتراح عن التنفيذ والموافقة |
| المعرفة | `knowledgeSources`, `dependencies`, `upstream`, `downstream` | وصف provenance وموضع الدور في workflow |
| الجودة | `validationCriteria`, `failureHandling`, `handoffProtocol`, `reportingRequirements` | جعل الناتج قابلاً للمراجعة والتصعيد |
| الخصوصية | `memoryRequirements.visibility`, `retention`, `providerAccess` | default private/session/never في هذه الشريحة |
| الأمان | `securityBoundaries` | منع secrets وnetwork غير المعتمد وتجاوز policy |

## حالات التنفيذ

`bounded_capability` تعني أن جزءًا محدودًا من القدرة له سطح منفذ ومختبر، ولا تعني وجود agent مستقل. `definition_only` تعني أن العقد يصف الدور دون runtime capability. `not_implemented` تعني أن الدور مسجل كفكرة ضمن الخريطة فقط ولم يُنفذ.

الكتالوج الحالي يحوي **46 تعريفًا**. التعريفات التي تملك bounded capability هي `api-architect` و`frontend-engineer` و`backend-engineer` و`mobile-engineer` و`database-engineer` و`qa-testing` و`security` و`performance-engineer`. بقية التعريفات مصنفة صراحة `definition_only` أو `not_implemented` حسب الأدلة الحالية؛ لا يوجد hierarchical supervisor أو DAG executor جديد في هذه الشريحة.

## السطح البرمجي

يقدم `AgentCatalogPort.list(limit?)` قائمة bounded بحد أقصى 64 تعريفًا، ويقدم `get(agentId)` تعريفًا واحدًا أو `undefined`. يتحقق التنفيذ من lowercase safe IDs، uniqueness، أطوال النصوص، قوائم الأدوات والصلاحيات، حالات الذاكرة، ومعايير الفشل. يعتمد `createEmbeddedApplication` على `InMemoryAgentCatalog` ولا يفتح network أو provider أو model عند الإقلاع.

أضيف مسارا IPC:

| method | payload | النتيجة | الحدود |
|---|---|---|---|
| `agent.catalog.list` | `{ limit?: number }` | `readonly AgentDefinition[]` | read-only، limit ≤ 64 |
| `agent.definition.get` | `{ agentId: string }` | `AgentDefinition \| undefined` | safe lowercase ID فقط |

تستخدم واجهة Workspace `textContent` لعرض metadata، ولا تعرض أي HTML صادر من تعريف خارجي. ويؤكد desktop smoke أن القائمة تحوي 46 تعريفًا، وأن `security` يحافظ على `providerAccess=never`، وأن عدد approval tickets لا يزيد بسبب القراءة.

## ما لم يُنفذ

لا يتضمن هذا القرار تسجيل agents قابلًا للتشغيل، ولا scheduling أو DAG، ولا tool registry فعليًا، ولا remote connectors، ولا OAuth أو MCP أو Playwright، ولا persistence مستقلة لتعريفات المستخدم، ولا صلاحية `apply`. أي انتقال من catalog إلى WorkCycle أو filesystem أو provider يظل خلف العقود القائمة وHuman Gate وشريحة مستقلة.

## بوابة القبول

يُقبل هذا القرار عند نجاح اختبارات schema والحدود، IPC happy path وmalformed payload، Electron desktop smoke، ثم full gate المعتاد مع `git diff --check` وsecret scan. يجب أن تبقى الحالات `definition_only` و`not_implemented` ظاهرة في التقارير وألا تُختصر إلى `implemented`.
