# سجل المخاطر

| ID | الخطر | الاحتمال | الأثر | الشدة | trigger | التخفيف | contingency | المالك |
|---|---|---:|---:|---:|---|---|---|---|
| R-001 | OpenTo غير محدد أو لا يملك API | عالٍ | عالٍ | حرجة | غياب رابط/POC | adapter contract وmock | file import أو إلغاء التكامل | Product owner |
| R-002 | scope أكبر من MVP | عالٍ | عالٍ | حرجة | stories كثيرة بلا acceptance | freeze MVP وroadmap | حذف Studio/Voice من beta | PM |
| R-003 | tool prompt injection | عالٍ | عالٍ | حرجة | تعليمات داخل ملف/ويب | data/instruction separation وapproval | إيقاف job وعزل المصدر | Security |
| R-004 | تسريب token/API key | متوسط | عالٍ | عالٍ | secret scan أو log leak | secret store/redaction | revoke/rotate/incident | Security |
| R-005 | memory leak أو تجميد UI | متوسط | عالٍ | عالٍ | RSS/p95 regression | workers/limits/benchmarks | disable heavy feature | Performance |
| R-006 | فشل native dependency على Windows | متوسط | عالٍ | عالٍ | CI build error | matrix builds وfallback | disable optional module | DevOps |
| R-007 | license incompatibility | متوسط | عالٍ | عالٍ | AGPL/GPL component chosen | license matrix | replace with permissive option | Compliance |
| R-008 | provider quota/failure | عالٍ | متوسط | عالٍ | 429/timeout | router/circuit/fallback | local/queue/manual | Provider owner |
| R-009 | model output hallucination | عالٍ | متوسط | عالٍ | unsupported claim | citations/critic/judge | label uncertainty | AI architect |
| R-010 | runaway automation | متوسط | عالٍ | عالٍ | failure streak/loop | caps/pause/idempotency | disable workflow | PM |
| R-011 | hostile repository scripts | متوسط | عالٍ | عالٍ | postinstall/hook | clone read-only/disable hooks | sandbox disposable copy | Dev environment |
| R-012 | Arabic voice quality insufficient | عالٍ | متوسط | عالٍ | benchmark fail | text fallback/provider optional | defer Voice phase | Voice owner |
| R-013 | vector index stale after delete | متوسط | متوسط | متوسط | recall deleted item | versioned indexes/delete job | rebuild index | Data |
| R-014 | Electron security misconfiguration | متوسط | عالٍ | عالٍ | security audit fail | contextIsolation/CSP/sandbox | block release | Desktop |
| R-015 | release update corrupts schema | منخفض | عالٍ | عالٍ | migration dry-run fail | backup/rollback | pin previous release | Release |
| R-016 | 70 agents overload resources | عالٍ | عالٍ | حرجة | scheduler saturation | definitions vs concurrency cap | run subset/queue | Orchestration |
| R-017 | third-party API privacy mismatch | متوسط | عالٍ | عالٍ | provider policy changes | provider privacy metadata | local-only mode | Privacy |
| R-018 | source citations invalid | متوسط | متوسط | متوسط | missing source span | source registry/validator | mark draft/unverified | Research |

## أعلى خمس مخاطر

R-001 وR-002 وR-003 وR-006 وR-007 تمنع الانتقال إلى build واسع. يجب ألا تُخفض درجة الخطر بالوثائق وحدها؛ يلزم evidence أو test. يراجع السجل كل milestone ويضيف trigger جديدًا عند ظهور فشل.

إعداد: Manus AI. تاريخ الفحص: 2026-08-21.
