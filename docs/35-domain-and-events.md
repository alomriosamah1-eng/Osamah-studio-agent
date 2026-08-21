# Domain Model وEvent Model

## كيانات وقيم

الكيانات الأساسية هي `Workspace`, `Project`, `Agent`, `Task`, `Job`, `PermissionGrant`, `Provider`, `MemoryItem`, `Artifact`, `MobileProject`, `DeviceProfile`, و`PreviewSession`. قيم مشتركة هي IDs غير قابلة للتخمين، `CorrelationId`, `SchemaVersion`, `RiskTier`, `Platform`, `ResourceBudget`, `Capability`, و`ErrorCode`.

## حالات حرجة

| الكيان | الحالات | الانتقالات المحمية |
|---|---|---|
| AgentSession | CREATED/RUNNING/WAITING_APPROVAL/PAUSED/COMPLETED/FAILED/CANCELLED | لا RUNNING دون workspace وpolicy |
| Job | QUEUED/RUNNING/WAITING_APPROVAL/PAUSED/CANCEL_REQUESTED/SUCCEEDED/FAILED/CANCELLED | retry فقط للأخطاء retryable |
| PermissionGrant | REQUESTED/APPROVED/REVOKED/EXPIRED/DENIED | لا تنفيذ بعد expiry/revoke |
| PreviewSession | CREATED/STARTING/READY/REFRESHING/RELOADING/STOPPING/STOPPED/FAILED | لا REFRESH دون transport healthy |
| MobileProject | DETECTED/VALIDATED/RUNNABLE/BUILDING/FAILED | native build يحتاج doctor pass |
| Provider | REGISTERED/HEALTHY/DEGRADED/COOLDOWN/DISABLED | dispatch يرفض DISABLED |

## الأحداث

لا يستخدم النظام event bus لكل شيء. الأحداث التي تعبر حدود module أو تحتاج audit/recovery هي domain/application events التالية: `WorkspaceOpened`, `TaskCreated`, `TaskStarted`, `ApprovalRequested`, `ApprovalGranted`, `ApprovalDenied`, `ToolStarted`, `ToolCompleted`, `ToolFailed`, `AgentStarted`, `AgentStopped`, `ProviderFailed`, `ProviderRecovered`, `ModelChanged`, `FileChanged`, `ArtifactCreated`, `BuildStarted`, `BuildCompleted`, `SimulatorStarted`, `SimulatorReady`, `SimulatorStopped`, `PreviewRefreshed`, `TestFailed`, `MemoryConsolidated`, و`VoiceCompleted`.

كل event يحمل `event_id`, `event_type`, `schema_version`, `occurred_at`, `aggregate_id`, `correlation_id`, `causation_id`, و`payload`. لا يحمل payload أسرارًا أو full prompt إلا إذا policy تحدد ذلك. الأحداث immutable، ويمكن إنشاء projection لـ activity timeline وstate recovery.

## Event bus

يستخدم MVP in-process typed event bus مع synchronous handlers للـ state transitions وasync handlers للـ logs/index/notifications. عند إضافة SQLite، يضاف outbox table للتأكد من عدم فقد الحدث بين transaction وworker. لا يوزع event bus عبر الشبكة في MVP.

## Error model

`DomainError` للأخطاء المنطقية، `ValidationError` للمدخلات، `PolicyError` للصلاحيات، `NotFoundError` للمراجع، `InfrastructureError` للمحولات، `TransientError` للـ retry، `ConflictError` للتزامن، `CancelledError` للإلغاء، و`CapabilityError` عندما تكون المنصة غير داعمة. كل خطأ يملك retryable وuserAction وsafeToExpose وcauseRef.

## Resource budget

كل job/preview/build يحمل CPU/RAM/GPU/disk/network/time/concurrency budget. Resource Manager يرفض بدء العمل إذا تجاوزت الميزانية أو يضعه في queue. الإلغاء يرسل cooperative signal ثم force terminate بعد grace period ويكتب result recovery.

## References

[1]: ./06-system-architecture.md "System architecture"
[2]: ./10-backend-architecture.md "Backend architecture"
[3]: ./17-security-model.md "Security model"

إعداد: Manus AI. تاريخ الفحص: 2026-08-22.
