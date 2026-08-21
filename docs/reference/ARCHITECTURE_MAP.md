# ARCHITECTURE_MAP

```text
Presentation → Interface Adapters → Application → Domain
Infrastructure → Application ports / Domain contracts
```

الـ Domain مستقل عن Electron وReact وdatabase وproviders. الـ Application يملك use cases وports. Infrastructure تنفذ adapters. Mobile preview وMetro وAndroid/iOS تقع خارج domain وتدخل عبر `SimulatorProvider`.

**المصدر:** `docs/34-clean-architecture.md`, `docs/35-domain-and-events.md`.

حالة التنفيذ: Domain/Application/In-memory منفذة؛ بقية الطبقات مخططة.
