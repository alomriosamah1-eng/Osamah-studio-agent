# AGENT_MAP

| المكون | المسؤولية | حالته |
|---|---|---|
| Supervisor | ترتيب DAG والموارد | مخطط؛ لا يوجد hierarchical supervisor بعد |
| Agent Catalog | تعريف schema موحد لـ46 دورًا وحالات التنفيذ والـhandoff والخصوصية | `InMemoryAgentCatalog` وtyped IPC read-only منفذان؛ لا orchestrator أو agent execution registry |
| AgentRuntime | queue/timeout/cancel وguarded execution | `BoundedAgentRuntime` منفذ؛ orchestration loop ما زال لاحقًا |
| Planner | خطة قابلة للتحرير | `DeterministicPlanner` و`LlmPlanner` bounded؛ لا Planner Agent Registry مستقل |
| Worker | تنفيذ محدود | `AgentWorkCycleService` و`FilesystemPatchAdapter` bounded؛ لا Worker Agent Registry أو pool مستقل |
| Critic/Judge | تحقق ومقارنة acceptance | `BoundedPlanCritic` وProviderBackedPlannerCritic منفذان؛ Judge عام وacceptance registry غير مكتملين |
| Approval Gate | قرار بشري وscope | `InMemoryApprovalWorkflow` و`submitGuarded` وpersistent audit وHuman Gate UI/event stream منفذة bounded؛ لا multi-user RBAC |
| Provider Gateway | capability/privacy/offline routing وhealth/fallback | `ProviderGateway` وlocal Ollama/llama.cpp adapters وprovider policy/doctor/quota/circuit منفذة bounded؛ لا remote account connectors |
| Mobile AI Tools | screenshot/log/refresh/visual test | مخطط |

لا يسمح للوكيل بتغيير policy أو تنفيذ high-risk tool دون ApprovalRequest مع audit event. لا توجد network calls أو model loads عند composition default؛ guarded action بلا authorization port يفشل مغلقًا.
