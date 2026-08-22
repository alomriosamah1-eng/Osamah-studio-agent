# TEST_MAP

| النوع | النطاق | الحالة |
|---|---|---|
| Domain unit | entities/value objects/errors/state transitions | منفذ: `src/foundation.test.ts` و`src/embedded-controller.test.ts` |
| Application integration | use cases + in-memory repos/events | منفذ جزئي |
| Contract | ports/IPC/providers/Metro/ADB/Xcode | IPC وsecurity boundaries منفذة جزئيًا؛ providers/Metro/ADB/Xcode لاحقًا |
| End-to-end | Desktop workspace/approval/Git | Electron startup + preload/IPC smoke منفذ جزئيًا؛ approval/Git لاحقًا |
| UI/accessibility | RTL/LTR/keyboard/screen reader | مفقود |
| Mobile preview | device geometry/interactions/HMR | controller/input/refresh/capture وbundle/runtime contract منفذة؛ Metro HMR الحقيقي لاحقًا |
| Native mobile | Android/iOS build/run/log/screenshot | مفقود |
| Visual regression | golden screenshots/threshold | مفقود |
| AI | tool calling/fallback/memory/visual loop | مفقود |
| Performance | startup/RSS/CPU/GPU/queue | مفقود |
| IPC contract | protocol validation/unknown/duplicate/error mapping وbundle start/refresh/inspect/openProject وAgent Catalog methods | منفذ: `src/ipc.test.ts` |
| Agent Definition Catalog | 46 definitions، schema/privacy/handoff/status/bounds وread-only IPC | منفذ: `src/agent-catalog.test.ts` و`src/ipc.test.ts` و`pnpm desktop:smoke` |
| ReportDocument | provenance من Content Plan/Source/Artifact، claim states، redaction، local review، bounded IPC وno-export boundary | منفذ: `src/report-document.test.ts` و`src/ipc.test.ts` و`pnpm desktop:smoke` |
| Application Settings وControl Center | Arabic-first locale/direction، theme، font scale، density، reduce motion، exact-key IPC وno-provider/no-approval | منفذ: `src/application-settings.test.ts` و`src/ipc.test.ts` و`pnpm desktop:smoke` |
| Desktop security | CSP، context isolation، sender URL/id، preload bridge | منفذ: `src/desktop/security.test.ts` و`pnpm desktop:smoke` |
| Preview runtime security | blocked imports/path traversal/source hash/diagnostics | منفذ: `src/preview-runtime.test.ts` و`src/ipc.test.ts` |
| Project open integration | filesystem root → bundle → embedded session → inspect | منفذ: `src/ipc.test.ts` |
| Presentation renderer | semantic mapping/escaping/deterministic props/depth guard | منفذ: `src/preview-renderer.test.ts` |
| Visual prototype | embedded tree/file switch/orientation/Fast Refresh | منفذ bounded: `research/presentation-renderer-visual-check.txt` |
| Migration contract | SQLite tables/indexes/schema version | منفذ: `scripts/validate_sqlite_migration.py` |
| Security | injection/sandbox/secrets/plugins | Electron baseline منفذ جزئيًا؛ threat suite الكامل لاحقًا |

قاعدة القبول: لا تدخل feature release دون test entry وevidence artifact.
