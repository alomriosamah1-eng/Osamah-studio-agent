# EVENT_MAP

| الحدث | المصدر | المستهلك المخطط | الحالة |
|---|---|---|---|
| WorkspaceOpened | Workspace use case | activity/audit | منفذ event bus |
| SessionCreated | Session use case | session projection | منفذ event bus |
| ApprovalRequested/Resolved | Policy use case | UI/audit | منفذ event bus |
| PreviewCreated/StatusChanged | Mobile use case | preview UI/AI | منفذ event bus |
| AgentStarted/Stopped | Agent runtime | activity/telemetry | مخطط |
| ProviderFailed/Recovered | Provider router | fallback/notification | مخطط |
| BuildStarted/Completed | Build service | artifacts/state | مخطط |
| TestFailed | QA/visual loop | critic/notification | مخطط |

كل event يحمل event_id وschema_version وoccurred_at وcorrelation_id، ولا يحمل secrets افتراضيًا.
