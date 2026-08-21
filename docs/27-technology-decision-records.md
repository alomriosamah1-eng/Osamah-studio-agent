# سجلات القرارات التقنية

## ADR-001: Modular Desktop Monolith

**الحالة:** مقترح معتمد للـ MVP. **القرار:** modular monolith مع workers/process isolation. **السبب:** يقلل التعقيد مقارنة microservices ويعزل CPU-heavy/untrusted work. **مرفوض:** microservices المبكرة بسبب deployment وauth وversioning. **إعادة النظر:** عند تعدد المستخدمين أو الأجهزة أو حاجة scheduler دائم.

## ADR-002: Electron في MVP

**الحالة:** مقترح معتمد مؤقتًا. **القرار:** Electron لأن OpenCode وHermes يثبتان نمط Electron desktop packaging متعدد الأنظمة [1] [2]، ولأن PTY/Node/IPC مهمة. **البديل:** Tauri أصغر، لكن Rust/WebView وsidecars تضيف مخاطر جديدة [3]. **إعادة النظر:** بعد benchmark RSS وحجم installer.

## ADR-003: SQLite + FTS5

**الحالة:** معتمد للـ MVP. **القرار:** SQLite مصدر البيانات المحلي وFTS5 للبحث. **البديل:** PostgreSQL غير ضروري، Qdrant/LanceDB optional. **السبب:** portability وbackup وlow resource.

## ADR-004: provider-neutral contracts

**الحالة:** معتمد. **القرار:** registry وcapability وhealth وfallback، وليس direct provider imports. **السبب:** free/local-first وعدم lock-in؛ OmniRoute مصدر إلهام [4].

## ADR-005: لا اعتماد runtime كامل من مشروع مرجعي

**الحالة:** معتمد. **القرار:** adapters/wrappers وإعادة استخدام contracts/ideas فقط. **السبب:** اختلاف lifecycle وlicense وupgrade coupling. **البديل المرفوض:** fork core كامل من OpenCode/Hermes/DeepSeek Harness.

## ADR-006: OpenTo خلف adapter

**الحالة:** blocked/unknown. **القرار:** interface وmock فقط حتى يقدم المالك رابطًا ومواصفة. **السبب:** لا يجوز اختلاق API. **بوابة القبول:** read-only POC + security contract + Windows smoke.

## ADR-007: Voice optional

**الحالة:** معتمد. **القرار:** Voice phase بعد core. **السبب:** model/licensing/Arabic quality/latency غير محسومة. **البديل المرفوض:** جعل الصوت شرطًا لنجاح MVP.

## ADR-008: 70 definitions لا 70 concurrent processes

**الحالة:** معتمد. **القرار:** agent catalog واسع مع scheduler cap. **السبب:** resource predictability وdebuggability. **البديل المرفوض:** تشغيل دائم لكل الوكلاء.

## تقييم Electron/Tauri

| المعيار | الوزن | Electron | Tauri |
|---|---:|---:|---:|
| سرعة MVP | 20% | 5 | 3 |
| PTY/Node integration | 15% | 5 | 3 |
| resource footprint | 15% | 2 | 5 |
| cross-platform consistency | 15% | 5 | 3 |
| security defaults | 15% | 3 | 4 |
| ecosystem | 10% | 5 | 4 |
| team complexity | 10% | 4 | 3 |
| النتيجة التقريبية | 100% | **4.0/5** | **3.5/5** |

النتيجة إرشادية وليست benchmark؛ لذلك يبقى Tauri خيارًا لاحقًا.

## References / المراجع

[1]: https://github.com/anomalyco/opencode/blob/dev/packages/desktop/package.json "OpenCode desktop"
[2]: https://github.com/NousResearch/hermes-agent/blob/main/apps/desktop/package.json "Hermes desktop"
[3]: https://v2.tauri.app/concept/architecture/ "Tauri Architecture"
[4]: https://github.com/diegosouzapw/OmniRoute "OmniRoute"

إعداد: Manus AI. تاريخ الفحص: 2026-08-21.
