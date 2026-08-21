# DATA_FLOW_MAP

## Foundation flow

```text
Input → Use Case → Domain entity/state transition → Repository port
      → Domain event → EventBus → future projection/log/telemetry
```

## Preview flow

```text
MobileProject → Detector → PreviewSession
              → LightweightPreviewAdapter أو MetroProcessAdapter
              → PreviewEvent → UI/AI inspector/screenshot
```

لا تنتقل بيانات UI مباشرة إلى filesystem أو subprocess. المستقبل يضيف SQLite transaction/outbox وredaction قبل إرسال أي prompt أو log خارجي.
