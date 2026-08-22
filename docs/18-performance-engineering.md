# هندسة الأداء

## أهداف القياس

القياسات أدناه أهداف MVP على جهاز Tier 1، وليست نتائج مثبتة بعد. يجب إنشاء benchmark harness قبل إعلان النجاح.

| القياس | الهدف | طريقة القياس |
|---|---:|---|
| بدء UI دافئ | <3s | cold/warm launch trace |
| تفاعل لوحة محلي | p95 <100ms | scripted UI actions |
| فتح workspace | p95 <2s للمشروع المتوسط | 10k files مع exclusions |
| أول token | p95 <2.5s | provider benchmark |
| idle RSS | <500MB دون model | OS process metrics |
| concurrent workers | 4 افتراضيًا | resource governor |
| فهرسة 50MB | لا تجميد UI | worker + progress |
| استعادة job | <5s بعد restart | crash/recovery test |

## العمليات

لا تشغل model inference أو PDF/video conversion داخل UI process. تستخدم worker pool محدودًا، مع backpressure وqueue priorities. تُحمّل Monaco وvoice وmedia lazily. process supervisor يرصد exit code وRSS وCPU ويقتل worker المتجاوز للحد.

## الضغط والتخزين المؤقت

يطبق agent context compression عند thresholds، ويستخدم prefix cache وsemantic cache بشروط. يفضل إرسال file summaries بدل الملفات الكاملة. لا يضغط acceptance criteria أو policy أو آخر errors. تحفظ artifacts الكبيرة خارج SQLite ويعرض UI thumbnail/metadata.

## GPU وlocal models

يكتشف النظام GPU وVRAM، ويختار quantized model أو CPU fallback. لا يحمل نموذجًا كبيرًا تلقائيًا إذا ستؤدي العملية إلى swap. local provider يعلن memory estimate وcontext cost، وتستخدم resource governor واحدًا لكل worker.

## منع التسرب

يستخدم long-running workers cleanup وAbortController/timeouts، ويغلق file descriptors وbrowser contexts وPTYs. تراقب الاختبارات heap growth وlistener leaks. كل progress event bounded ولا يحتفظ transcript كاملًا في الذاكرة.

## Large documents/media

يعالج المستند عبر pipeline extraction → chunks → section jobs → validation → assembly. الفيديو عبر proxy/streaming وFFmpeg worker، ولا يُحمّل كاملًا في RAM. يمكن إيقاف واستئناف job من checkpoint.

## التحقق

يجب أن تتضمن CI smoke benchmarks، ونتائجها artifact JSON. تُقارن النتائج بالـ baseline لا بالحدس. عند تراجع p95 أو RSS بنسبة 20%، يفتح regression issue.

## Avatar future track

تضيف دراسة Virtual Human في `docs/84-virtual-human-research-and-comparison.md` و`docs/85-virtual-human-architecture-and-contracts.md` ميزانية قبول مقترحة ومسار degradation خاصًا بـAvatar. هذه أهداف مستقبلية وليست قياسات منفذة: لا model أو renderer أو audio worker يُحمّل عند startup، ولا يسمح Avatar بتجاوز resource governor أو تجميد Workspace. يبدأ الاختبار من static/text ثم low-poly WebGL، ويظل high-realism portrait service اختياريًا ومعزولًا. لا تُقبل أي مرحلة تنفيذ قبل قياس RSS/CPU/GPU/frame time وfallback على Ubuntu 8GB.

إعداد: Manus AI. تاريخ الفحص: 2026-08-21. تحديث توثيقي: 2026-08-22؛ مسار Avatar مؤجل وميزانيته المقترحة في docs 84–86 وليست قياسات فعلية.
