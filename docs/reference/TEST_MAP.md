# TEST_MAP

| النوع | النطاق | الحالة |
|---|---|---|
| Domain unit | entities/value objects/errors/state transitions | منفذ: `src/foundation.test.ts` و`src/embedded-controller.test.ts` |
| Application integration | use cases + in-memory repos/events | منفذ جزئي |
| Contract | ports/IPC/providers/Metro/ADB/Xcode | مخطط |
| End-to-end | Desktop workspace/approval/Git | مفقود |
| UI/accessibility | RTL/LTR/keyboard/screen reader | مفقود |
| Mobile preview | device geometry/interactions/HMR | controller/input/refresh/capture وbundle/runtime contract منفذة؛ Metro HMR الحقيقي لاحقًا |
| Native mobile | Android/iOS build/run/log/screenshot | مفقود |
| Visual regression | golden screenshots/threshold | مفقود |
| AI | tool calling/fallback/memory/visual loop | مفقود |
| Performance | startup/RSS/CPU/GPU/queue | مفقود |
| IPC contract | protocol validation/unknown/duplicate/error mapping وbundle start/refresh/inspect/openProject | منفذ: `src/ipc.test.ts` |
| Preview runtime security | blocked imports/path traversal/source hash/diagnostics | منفذ: `src/preview-runtime.test.ts` و`src/ipc.test.ts` |
| Project open integration | filesystem root → bundle → embedded session → inspect | منفذ: `src/ipc.test.ts` |
| Presentation renderer | semantic mapping/escaping/deterministic props/depth guard | منفذ: `src/preview-renderer.test.ts` |
| Visual prototype | embedded tree/file switch/orientation/Fast Refresh | منفذ bounded: `research/presentation-renderer-visual-check.txt` |
| Migration contract | SQLite tables/indexes/schema version | منفذ: `scripts/validate_sqlite_migration.py` |
| Security | injection/sandbox/secrets/plugins | مفقود |

قاعدة القبول: لا تدخل feature release دون test entry وevidence artifact.
