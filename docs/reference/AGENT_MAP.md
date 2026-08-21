# AGENT_MAP

| المكون | المسؤولية | حالته |
|---|---|---|
| Supervisor | ترتيب DAG والموارد | مخطط |
| AgentRuntime | loop/context/tool calls | مفقود |
| Planner | خطة قابلة للتحرير | مفقود |
| Worker | تنفيذ محدود | مفقود |
| Critic/Judge | تحقق ومقارنة acceptance | مفقود |
| Approval Gate | قرار بشري وscope | Domain approval منفذ؛ UI مفقود |
| Mobile AI Tools | screenshot/log/refresh/visual test | مخطط |

لا يسمح للوكيل بتغيير policy أو تنفيذ high-risk tool دون ApprovalRequest مع audit event.
