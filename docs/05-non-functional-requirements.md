# المتطلبات غير الوظيفية

## الأداء والاستجابة

| ID | المتطلب | معيار القبول المبدئي |
|---|---|---|
| NFR-001 | بدء الواجهة | أقل من 3 ثوانٍ على جهاز Tier 1 مع cache دافئ |
| NFR-002 | استجابة التفاعل | p95 أقل من 100ms لأفعال التنقل المحلية |
| NFR-003 | أول token | p95 أقل من 2.5 ثانية للمزوّد المحلي/الشبكي في benchmark محدد |
| NFR-004 | الذاكرة | أقل من 500MB بعد بدء MVP دون تحميل نموذج محلي |
| NFR-005 | العزل | انهيار worker لا يغلق renderer أو يفقد session |
| NFR-006 | الطوابير | لا تتجاوز المهمة حدود concurrency وRAM المعلنة |
| NFR-007 | الملفات الكبيرة | فهرسة ملف 50MB عبر streaming دون تجميد UI |
| NFR-008 | المستند الطويل | معالجة مقطعية مع progress وcheckpoint لا سياق واحد ضخم |

## الأمن والخصوصية

| ID | المتطلب | معيار القبول المبدئي |
|---|---|---|
| NFR-009 | أقل صلاحية | كل tool يعلن scope ولا يستخدم صلاحية أوسع |
| NFR-010 | الأسرار | API keys في OS secret store أو ملف مشفر owner-only |
| NFR-011 | prompt injection | محتوى الملفات والـ tools غير موثوق ولا يغير policy |
| NFR-012 | MCP consent | تثبيت واستدعاء tool خارجي يحتاجان consent واضحًا |
| NFR-013 | shell sandbox | أوامر خطرة blocked أو approval-gated مع timeout |
| NFR-014 | التدقيق | كل فعل خارجي يسجل actor/tool/target/result/time |
| NFR-015 | تحديث آمن | checksum/signature وrollback للإصدارات الفاشلة |
| NFR-016 | عدم التسريب | لا تُرسل ملفات خارجية إلا بعد provider/data policy check |

## الجودة والموثوقية

| ID | المتطلب | معيار القبول المبدئي |
|---|---|---|
| NFR-017 | قابلية الإعادة | job يحمل input hash وpolicy وprovider/model ids |
| NFR-018 | idempotency | retry لا يكرر commit أو إرسالًا حساسًا دون key |
| NFR-019 | recovery | restart يعيد jobs القابلة للاستئناف دون تكرار الحدث |
| NFR-020 | observability | logs structured وmetrics محلية وcorrelation id |
| NFR-021 | الاختبار | unit/integration/e2e/security/fixture لكل contract عالي المخاطر |
| NFR-022 | التوافق | Windows Tier 1، Linux Tier 1، macOS Tier 2 بعد CI/signing |

## UX وإمكانية الوصول والتدويل

| ID | المتطلب | معيار القبول المبدئي |
|---|---|---|
| NFR-023 | RTL/LTR | تبديل الاتجاه في الجلسة نفسها مع حفظ preference |
| NFR-024 | لوحة المفاتيح | كل الإجراءات الأساسية قابلة للتشغيل دون mouse |
| NFR-025 | قارئات الشاشة | أسماء وعلاقات controls واضحة في المكونات الأساسية |
| NFR-026 | اللغة | ملفات ترجمة منفصلة لا نصوص صلبة في المكونات |
| NFR-027 | العربية | font fallback، علامات ترقيم، code block LTR، وتخطيط مختلط |
| NFR-028 | الشفافية | يعرض النظام مصدر القرار، التكلفة التقديرية، والصلاحية المطلوبة |

## الصيانة والتوزيع

| ID | المتطلب | معيار القبول المبدئي |
|---|---|---|
| NFR-029 | تثبيت الاعتماديات | lockfiles وSBOM وlicense report في CI |
| NFR-030 | تحديثات خارجية | سجل adapter compatibility لكل إصدار مرجعي |
| NFR-031 | builds | Windows/Linux artifacts في GitHub Actions مع artifact hash |
| NFR-032 | migration | schema migrations قابلة للترقية والنسخ الاحتياطي |
| NFR-033 | docs | كل contract عام موثق ومرتبط باختبار |
| NFR-034 | resource caps | حدود CPU/RAM/GPU/وقت قابلة للتكوين ومحفوظة في policy |

إعداد: Manus AI. تاريخ الفحص: 2026-08-21.
