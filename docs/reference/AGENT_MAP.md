# AGENT_MAP

| المكون | المسؤولية | حالته |
|---|---|---|
| Supervisor | ترتيب DAG والموارد | مخطط؛ لا يوجد hierarchical supervisor بعد |
| AgentRuntime | queue/timeout/cancel وguarded execution | `BoundedAgentRuntime` منفذ؛ orchestration loop ما زال لاحقًا |
| Planner | خطة قابلة للتحرير | مفقود |
| Worker | تنفيذ محدود | مفقود |
| Critic/Judge | تحقق ومقارنة acceptance | مفقود |
| Approval Gate | قرار بشري وscope | `InMemoryApprovalWorkflow` و`submitGuarded` منفذان؛ Human Gate UI وpersistent audit لاحقان |
| Provider Gateway | capability/privacy/offline routing وhealth/fallback | `ProviderGateway` منفذ bounded؛ remote/local adapters وquota/circuit breaker لاحقة |
| Mobile AI Tools | screenshot/log/refresh/visual test | مخطط |

لا يسمح للوكيل بتغيير policy أو تنفيذ high-risk tool دون ApprovalRequest مع audit event. لا توجد network calls أو model loads عند composition default؛ guarded action بلا authorization port يفشل مغلقًا.
