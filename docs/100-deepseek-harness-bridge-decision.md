# قرار DeepSeek Harness Bridge

**التاريخ:** 2026-08-23

## القرار

لا تُضاف حزمة `@deepseek-ai/dsh` أو حزم `dsh-agent` و`dsh-agent-loop` إلى dependency graph الحالي، ولا يُبنى `DeepSeekHarnessBridge` في هذه المرحلة. السبب ليس رفض استخدام المشاريع المفتوحة المصدر، بل تطبيق قاعدة اختيار upstream واحد لكل قدرة: أصبح OpenCode هو coding-agent/provider bridge الفعلي، وأصبح Hermes Agent هو skills/worker bridge الفعلي عبر ACP، بينما سيضيف DeepSeek Harness agent/plugin runtime ثالثًا واسعًا مع تداخل مباشر في session loop وtools وpermissions وUI.

يُحتفظ بـDeepSeek Harness كمرجع upstream قابل لإعادة التقييم لطبقة **plugin/event spine** فقط. لا يُعد هذا الاستخدام الحالي دمجًا runtime، ولا يجوز وصف DeepSeek بأنه جزء منفذ من التطبيق قبل اجتياز بوابة توافق مستقلة وتقديم مسار تشغيل فعلي bounded.

> **قاعدة الملكية:** لا يُشغّل OpenCode وHermes وDeepSeek كـagent loops متوازية لنفس الطلب. الواجهة التي يراها المستخدم هي واجهة Osamah فقط، و`ProviderGateway` و`AgentWorkCycle` و`HumanGate` و`Audit` هي طبقات السيطرة الخاصة بالمشروع.

## لماذا لم يُختر DeepSeek الآن؟

| المعيار | النتيجة الحالية | الأثر على القرار |
|---|---|---|
| التداخل الوظيفي | DSH يضم agent loop وtools وsessions وpermissions، وهي مساحات يغطيها OpenCode/Hermes وطبقات Osamah الحالية | تكامل ثالث يكرر القدرة بدل أن يضيف قدرة ضرورية |
| حجم الاعتماديات | الحزمة التنفيذية المنشورة تسحب حزم core/host/client/tools/terminal/fs/web/session/skill وplugins، وحزم agent تحتاج peer graph واسعًا مع Cordis | لا تناسب إدخالًا صغيرًا داخل Electron على Ubuntu 8GB |
| توافق Node | الإصدارات المنشورة RC ومتطلباتها ليست مثبتة بعد ضد Node 22.13 وElectron 43.4.1 في هذا المستودع | لا تثبيت قبل compatibility matrix وبناء worker قابل للعزل |
| الصلاحيات | DSH يستطيع تركيب filesystem وterminal وsubagents وtools وفق profiles | يحتاج capability map كاملًا إلى Osamah Policy وHuman Gate قبل أي تنفيذ |
| واجهة المستخدم | DSH يملك Web UI، لكن المنتج يتطلب Osamah-owned UI موحدة | لا يجوز إدخال DSH UI أو routes أو state إلى Preload/Workspace |
| القيمة الإضافية الآن | event spine مميز نظريًا، لكن Event Bus وAudit وAgent WorkCycle موجودة محليًا وتغطي MVP | لا حاجة تشغيلية حالية تبرر runtime ثالثًا |

## ما استُخدم بدلًا منه

يملك Osamah الآن مسارين فعليين غير متداخلين. `@opencode-ai/sdk@1.18.21` و`OpenCodeSdkProviderAdapter` يغطيان coding/provider sessions وhealth وprompt خلف `ProviderGateway`. و`@agentclientprotocol/sdk@1.4.0` و`HermesAcpProviderAdapter` يغطيان worker sessions وACP messages وread-only workspace خلف child-process boundary. كلاهما opt-in، ولا يبدأ أي منهما process أو network أو model عند startup.

يبقى DeepSeek في سجل المكونات بحالة `deferred-not-selected` مع `capability_owner=plugin-event-spine`، ويُعاد فتحه فقط إذا ظهرت حاجة مستقلة لا يغطيها Event Bus وAgentWorkCycle، مثل durable plugin lifecycle أو event replay أو capability registration متعدد workers. عندها لا يُسمح بإضافة loop موازٍ؛ المطلوب هو adapter event-only أو worker protocol ضيق.

## شروط إعادة الفتح

| البوابة | الدليل المطلوب |
|---|---|
| Capability gap | حالة استخدام موثقة تثبت أن Osamah Event Bus وAgentWorkCycle وOpenCode/Hermes لا يوفرون القدرة المطلوبة دون DSH |
| Compatibility | matrix للـNode/Electron/Linux وpnpm peer graph، مع build reproducible وlockfile أو worker image واضحة |
| Isolation | worker أو package bridge لا يكتب profile أو filesystem أو يشغل shell مباشرة، وكل طلب يمر عبر Osamah policy |
| Events | mapping typed من session/agent/capability events إلى Osamah domain events مع correlation/idempotency وredaction |
| Resource budget | startup صفر، process lazy، cancellation، timeout، concurrency bounded، وRSS/CPU ضمن Ubuntu 8GB budget |
| Supply chain | license notices وSBOM وCVE scan وsource/version/hash وrollback إلى OpenCode/Hermes أو local fallback |
| UI boundary | لا imports أو routes أو state من DSH UI؛ اختبار boundary يبقى أخضر |

## حدود القرار

هذا القرار لا يلغي DeepSeek Harness ولا يمنع دمجه مستقبلًا، ولا يحذف أي كود أو عقد سابق. هو يزيل التكرار من المسار التنفيذي الحالي ويمنع dependency graph غير الضروري. لا تُضاف `@deepseek-ai/dsh` تلقائيًا، ولا يُشغّل `npx` أو install script أو network installer من داخل التطبيق. يبقى كل upstream غير المختار موثقًا في `project/open-source-components.json` بوصفه بديلًا أو مرجعًا، وليس dependency فعلية.

## المسار التالي

بعد إغلاق القرار، تكون الأولوية لدمج قدرة مستقلة لا تكرر agent loop: مراجعة `Monaco Editor` خلف `EditorSurfacePort` أو الانتقال إلى render workers للمستندات، وفق قياس bundle/startup/RSS. لا يبدأ Voice أو Avatar أو semantic/vector memory، ولا يفتح DeepSeek قبل تحقق إحدى بوابات إعادة الفتح أعلاه.

## المراجع

[1]: https://deepseek.com/harness/en/ "DeepSeek Harness official overview"
[2]: https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md "DeepSeek Harness architecture"
[3]: https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/ "DeepSeek Harness plugin development guide"
[4]: ../research/oss-integration-gap-2026-08-23.md "Repository, package, and compatibility audit"
[5]: ./98-open-source-integration-and-migration-plan.md "Open-source-first integration and migration plan"
[6]: ./99-unified-ui-and-capability-deduplication.md "Unified UI and capability deduplication policy"
