# Local Provider Adapters: Ollama وllama.cpp

**الحالة:** منفذة ومربوطة اختياريًا بـ`ProviderGateway`، مع إبقاء الإقلاع بلا network calls أو model loading.

## الهدف والنطاق

تضيف هذه الشريحة adapters فعلية فوق `fetch` المدمج في Node.js لـOllama عبر `/api/generate` و`/api/tags`، ولخادم llama.cpp المتوافق مع OpenAI عبر `/v1/chat/completions` و`/health`. كلاهما مصنف **local provider** و**offline-capable**، ولا يُسجل في composition إلا إذا مرره المستدعي صراحة ضمن `EmbeddedApplicationOptions.providers`.

| المكوّن | المسؤولية |
|---|---|
| `LocalHttpProviderAdapter` | boundary مشتركة للـURL والمهلة والإلغاء وHTTP status وJSON/output limits |
| `OllamaProviderAdapter` | mapping إلى Ollama generate API وtags health API |
| `LlamaCppProviderAdapter` | mapping إلى OpenAI-compatible chat completions وhealth API |
| `ProviderGateway` | local-first وprivacy/offline/model/capability routing وfallback وroute audit |
| `createEmbeddedApplication` | تسجيل اختياري فقط؛ لا health probe عند البناء |

## الحدود الأمنية والتشغيلية

تقبل adapters عناوين HTTP loopback فقط (`localhost` و`127.0.0.1` و`::1`) وترفض HTTPS أو العناوين البعيدة أو credentials أو query/hash في `baseUrl`. لا توجد API keys أو أسرار مضمّنة في الكود، ولا تُرسل بيانات إلى remote endpoint من هذه الشريحة. يظل الاتصال فعليًا lazy؛ لا يحدث `fetch` عند إنشاء adapter أو composition، بل عند استدعاء `health()` أو `invoke()` صراحة.

كل طلب يطبق timeout قابلًا للتقييد حتى دقيقتين، ويدعم `AbortSignal`، ويحد input إلى 128 KiB وoutput إلى 256 KiB. تُحوّل أخطاء HTTP إلى `ProviderGatewayError` typed، وتُرفض المخرجات غير الصالحة أو التي لا تطابق model/output contract. لا يدعم التنفيذ streaming أو tool execution أو model download؛ هذه حدود مقصودة حتى تُضاف سياسات resource/quota وapproval منفصلة.

> **قاعدة local-first:** وجود adapter محلي لا يعني أن نموذجًا محليًا مثبت أو أن الخادم يعمل. `health()` هو probe اختياري، و`ProviderGateway` يتعامل مع عدم التوفر كحالة bounded قابلة للفشل أو fallback، ولا يعلن الجاهزية دون استجابة فعلية.

## التحقق

| الفحص | النتيجة |
|---|---|
| Ollama mapping | generate request، response text، token counts، model matching: PASS |
| llama.cpp mapping | chat request، response extraction، usage counts، health `OK`: PASS |
| security boundary | رفض remote URL وcredentials وHTTPS وmodel mismatch: PASS |
| resilience | malformed output وHTTP 401 وtimeout/cancellation: PASS |
| composition | provider registration صريح فقط، و`fetchCalls=0` عند startup: PASS |
| المشروع الكامل | `92/92` اختبارًا، build وdesktop/performance smoke وmigration/JSON/diff/secret: PASS |

## الحدود والخطوة التالية

هذه adapters لا تتضمن بعد اكتشاف النماذج تلقائيًا أو streaming أو structured-output schema enforcement الخاص بكل model أو circuit breaker/quota كامل أو تشغيل دائم للخدمات. الخطوة التالية هي تثبيت provider configuration وdoctor/resource contracts وربما circuit breaker محافظ، ثم إدخال adapters الفعلية إلى مسارات planner/critic دون تجاوز Human Gate. لا يبدأ تحميل نموذج أو تشغيل Ollama/llama.cpp تلقائيًا عند الإقلاع.

إعداد: Manus AI. تاريخ الفحص: 2026-08-22.
