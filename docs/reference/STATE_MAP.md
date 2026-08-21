# STATE_MAP

## Current state machines

- `AgentSession`: created → running → waiting_approval/paused/completed/failed/cancelled.
- `ApprovalRequest`: requested → approved/denied/expired/revoked.
- `PreviewSession`: created → starting → ready → refreshing/reloading/stopping/failed; stopped → starting.
- `Job`: queued → running → waiting_approval/paused/cancelled/succeeded/failed.
- `Provider`: registered → healthy/degraded/cooldown/disabled.

الدوال التي تحرس الانتقالات الحالية موجودة في `src/domain/entities.ts`، والانتقالات غير القانونية مختبرة في `src/foundation.test.ts`. باقي state machines تحتاج persistence وrecovery tests.
