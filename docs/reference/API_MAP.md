# API_MAP

## Application API الحالية

`FoundationUseCases.openWorkspace`, `createSession`, `startSession`, `requestApproval`, `resolveApproval`, `registerDeviceProfile`, `createPreview`, و`transitionPreview` هي أول use-case surface. تتلقى domain-safe inputs وتكتب إلى repository ports وتنشر domain events.

## Ports المخططة

AIProvider، ModelProvider، VoiceProvider، StorageProvider، GitProvider، GitHubProvider، SearchProvider، DocumentProvider، ImageProvider، VideoProvider، EmbeddingProvider، MemoryProvider، AgentRuntime، TerminalProvider، SimulatorProvider، AutomationProvider؛ التفاصيل في `docs/34-clean-architecture.md`.

## IPC المخطط

الرسائل يجب أن تكون `{protocolVersion, requestId, correlationId, method, payload}` مع schema validation. الأحداث `progress`, `approval_required`, `preview_event`, `log`, `error`, `result`. لا تُكشف Node APIs مباشرة إلى renderer.

## API status

لا توجد واجهة HTTP أو IPC فعلية بعد. كل ما عدا Foundation use cases هو contract/documentation وليس implementation.
