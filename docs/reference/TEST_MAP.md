# TEST_MAP

| النوع | النطاق | الحالة |
|---|---|---|
| Domain unit | entities/errors/state transitions | منفذ: `src/foundation.test.ts` |
| Application integration | use cases + in-memory repos/events | منفذ جزئي |
| Contract | ports/IPC/providers/Metro/ADB/Xcode | مخطط |
| End-to-end | Desktop workspace/approval/Git | مفقود |
| UI/accessibility | RTL/LTR/keyboard/screen reader | مفقود |
| Mobile preview | device geometry/interactions/HMR | مفقود |
| Native mobile | Android/iOS build/run/log/screenshot | مفقود |
| Visual regression | golden screenshots/threshold | مفقود |
| AI | tool calling/fallback/memory/visual loop | مفقود |
| Performance | startup/RSS/CPU/GPU/queue | مفقود |
| Security | injection/sandbox/secrets/plugins | مفقود |

قاعدة القبول: لا تدخل feature release دون test entry وevidence artifact.
