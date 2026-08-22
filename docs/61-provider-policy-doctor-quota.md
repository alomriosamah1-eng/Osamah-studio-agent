# Provider Configuration وDoctor وQuota Policy

**الحالة:** منفذة ومربوطة اختياريًا بـ`ProviderGateway` مع حدود low-memory.

## الهدف والنطاق

تضيف هذه الشريحة طبقة سياسة مستقلة حول Ollama وllama.cpp: تحقق configuration، health doctor صريح، admission quota، وcircuit breaker bounded. لا تشغل السياسة أي provider تلقائيًا، ولا تجري health probe عند إنشاء التطبيق؛ الفحص يحدث فقط عبر `ProviderDoctor.check()` أو عند `ProviderGateway.invoke()`.

| المكوّن | المسؤولية |
|---|---|
| `BoundedProviderConfiguration` | التحقق من loopback URL وmodel والحدود ومنع التكرار |
| `LocalProviderDoctor` | تقرير `disabled` أو `blocked` أو health فعلي مع latency |
| `BoundedProviderExecutionPolicy` | concurrency واحد، rate window، وcircuit closed/open/half-open |
| `ProviderGateway` | استدعاء admission قبل health/invoke وتسجيل success/failure/release |
| `createEmbeddedApplication` | قبول `providerConfigs` وproviders صراحة فقط |

## حدود RAM 8GB

تفرض configuration الحالية `maxConcurrent=1` لكل provider، مع timeout حتى دقيقتين، input حتى 128 KiB، output حتى 256 KiB، rate window محدود، وcircuit failure threshold وcooldown bounded. هذه الحدود تحمي المسار الأساسي من تراكم طلبات أو محاولات fallback غير محدودة، ولا تعني أن تحميل نموذج كبير مناسب لجهاز بعينه؛ doctor يعرض الحالة ولا ينفذ model download.

## سلوك circuit وquota

يُرفض الطلب إذا كان provider disabled أو circuit مفتوحًا أو concurrency ممتلئًا أو rate window مستنفدًا. بعد عدد bounded من الإخفاقات يفتح circuit، وبعد cooldown يسمح بمحاولة `half_open` واحدة ضمن concurrency الواحد، ويغلق بعد نجاح. يطبق Gateway السياسة قبل invoke، ويستمر في fallback فقط وفق `maxFallbacks` الموجود، بينما لا يُسمح بتجاوز Human Gate عند side-effect mutation.

> **قاعدة التشغيل:** configuration لا تساوي availability. وجود `providerConfigs` وadapter مسجل لا يثبت أن الخادم يعمل أو أن modelId مثبت؛ `ProviderDoctor` و`health()` هما مصدر الحالة التشغيلية فقط.

## التحقق

| الفحص | النتيجة |
|---|---|
| configuration | loopback/credentials/limits/duplicate IDs: PASS |
| doctor | disabled/blocked/healthy states وlatency report: PASS |
| quota | concurrency واحد وrate window وretry-after: PASS |
| circuit | failure threshold وcooldown وhalf-open وsuccess reset: PASS |
| Gateway | admission قبل invoke وrelease وdisabled provider handling: PASS |
| المشروع الكامل | `97/97` اختبارًا، build وdesktop/performance smoke وmigration/JSON/diff/secret: PASS |

## الحدود

لا تزال model discovery وstreaming وtool execution وcircuit persistence وcross-process quota وremote providers وsigned telemetry خارج النطاق. لا توجد خدمة دائمة أو scheduler أو تشغيل تلقائي لـOllama/llama.cpp. قبل إدخال inference فعلي في planner/critic، يلزم إضافة typed provider configuration UI/IPC وربط doctor وpolicy برسائل Workspace مع بقاء الأسرار خارج renderer.

إعداد: Manus AI. تاريخ الفحص: 2026-08-22.
