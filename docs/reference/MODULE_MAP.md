# MODULE_MAP

| الوحدة | المسؤولية | الملفات الحالية | الحالة |
|---|---|---|---|
| Domain | entities/value objects/errors/events | `src/domain/*` | منفذة |
| Application | ports/use cases | `src/application/*` | منفذة جزئيًا |
| Infrastructure | in-memory adapters | `src/infrastructure/in-memory.ts` | منفذة للاختبار |
| Workspace | فتح workspace وroot path | داخل FoundationUseCases | أولية |
| Agent Orchestration | planning/tool loop | `docs/07`, `docs/35` | مخططة |
| Provider/Model | registry/health/fallback | `docs/14` | مخططة |
| Mobile Development | detector/generator/build | `docs/33` | مخططة |
| Simulator | profiles/preview/native adapters | `src/domain/entities.ts`, `docs/33` | lifecycle أولي |
| Security | policy/permissions/sandbox | `docs/17` | مخططة |
| Presentation | Electron/React/RTL | `docs/09` | مفقودة |

كل module جديد يجب أن يملك contract، owner، test، ومرجعًا في هذا الملف.
