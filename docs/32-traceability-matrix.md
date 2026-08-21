# مصفوفة التتبع

| Requirement | Feature | Architecture | Component | Technology | Test | Acceptance criteria |
|---|---|---|---|---|---|---|
| FR-001 | Workspace | core/workspace | WorkspaceService | filesystem + SQLite | workspace-open-smoke | فتح وإعادة فتح workspace بلا فقد |
| FR-005 | Plan | orchestrator | PlanService | DAG + JSON Schema | plan-contract | خطة قابلة للتحرير مع مخاطر |
| FR-006 | Approval | policy | ApprovalService | typed IPC + audit | approval-gate | لا tool عالي الخطورة بلا approval |
| FR-009 | Terminal | isolated worker | TerminalRunner | PTY + supervisor | terminal-policy | cwd/env/timeout/deny مطبقة |
| FR-013 | Provider | provider router | ProviderRegistry | capability manifests | provider-contract | إضافة provider بلا تعديل UI |
| FR-020 | Search | data layer | SearchService | SQLite FTS5 | fts-bilingual | نتائج عربية وإنجليزية scoped |
| FR-023 | Production | artifact pipeline | MarkdownAssembler | Markdown + source registry | citation-integrity | لا citation بلا source |
| FR-030 | Git | integration adapter | GitAdapter | git/gh | git-approval | عرض diff وapproval قبل commit |
| FR-035 | i18n | frontend | LocaleProvider | i18n + logical CSS | rtl-ltr-smoke | تغيير الاتجاه دون restart |
| FR-038 | OpenTo | adapter contract | OpenToAdapter | TBD | not-configured-contract | fail closed دون spec |
| NFR-001 | Startup | desktop shell | StartupTrace | Electron profiling | startup-benchmark | p95 warm start <3s |
| NFR-011 | Security | instruction boundary | PolicyEngine | labels + approval | injection-fixtures | النص غير الموثوق لا يغير policy |
| NFR-029 | Supply chain | CI/CD | SecurityWorkflow | lockfiles + SBOM | license-and-sbom | تقرير آلي قبل release |

## سياسة الصيانة

عند إضافة requirement، يضاف صف هنا وentry في `project/requirements.json`. عند تغيير technology، يحدّث ADR وsource وtest. requirement بلا test يبقى `DISCOVERY` ولا يدخل release gate.

إعداد: Manus AI. تاريخ الفحص: 2026-08-21.
