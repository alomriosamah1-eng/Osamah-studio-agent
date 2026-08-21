# المتطلبات الوظيفية

تُرقّم المتطلبات لتكون قابلة للتتبع. جميع المعايير أدناه تخص MVP/V1 المقترح، وليست وعدًا بتنفيذ الإصدار الأول كاملًا.

| ID | المتطلب | معيار القبول |
|---|---|---|
| FR-001 | إنشاء Workspace محلي وفتحه وإغلاقه | يحفظ المسار والمعرّف ويعيد فتحه دون فقد الحالة |
| FR-002 | اكتشاف Git repository وقراءة الحالة | يعرض branch وstatus وdiff دون تعديل |
| FR-003 | فهرسة الملفات مع exclusions | لا يفهرس `.git` أو الأسرار أو المسارات المستثناة |
| FR-004 | محادثة Agent مرتبطة بمشروع | كل رسالة تحمل workspace/session id |
| FR-005 | إنشاء خطة قابلة للتحرير | الخطة تتضمن خطوات واعتماديات ومخاطر وملفات |
| FR-006 | طلب موافقة قبل الأفعال الحساسة | لا يمر tool call عالي الخطورة دون event موافقة |
| FR-007 | تنفيذ قراءة ملفات آمنة | يتحقق من path داخل workspace أو permission صريح |
| FR-008 | تنفيذ كتابة patch قابلة للتراجع | ينشئ diff وcheckpoint قبل التعديل |
| FR-009 | تشغيل terminal بسياسة | يطبق allowlist/denylist وtimeout وworking directory |
| FR-010 | إيقاف وإلغاء المهمة | الإلغاء يوقف queue/process ويكتب سببًا في audit log |
| FR-011 | عرض نشاط الوكيل | تعرض الواجهة الحالة والأداة والوقت والنتيجة الجزئية |
| FR-012 | تسجيل جلسات وأحداث | يمكن إعادة تحميل session واستعادة transcript |
| FR-013 | Provider registry | يمكن إضافة provider عبر manifest وعقد capability |
| FR-014 | Model registry | يسجل model id والسياق والقدرات والسياسة الاقتصادية |
| FR-015 | Routing وfallback | يستخدم circuit breaker وcooldown ويكتب سبب القرار |
| FR-016 | وضع offline | يعطل الشبكة اختياريًا ويستخدم provider محليًا إن وجد |
| FR-017 | Skill registry | اكتشاف/تحقق/تمكين/تعطيل نسخة skill مع dependencies |
| FR-018 | MCP client | يثبت server بعد موافقة ويعرض tools/resources/prompts |
| FR-019 | سجل الصلاحيات | يسجل actor وscope وexpiry وreason لكل grant |
| FR-020 | بحث نصي عربي/إنجليزي | يدعم normalization وFTS5 وproject filters |
| FR-021 | ذاكرة جلسة ومشروع | يميز session/working/project memory ولا يخلطها تلقائيًا |
| FR-022 | استيراد Markdown/TXT/PDF نصي | يحفظ source وhash وextraction status |
| FR-023 | توليد Markdown بتوثيق المصادر | لا يضع citation غير موجود في source registry |
| FR-024 | تصدير PDF | ينجح أو يعرض خطأ قابلًا للتشخيص مع artifact metadata |
| FR-025 | إدارة مهام Second Brain | إنشاء/تحرير/إنجاز/ربط مهمة بمشروع أو ملاحظة |
| FR-026 | إدارة Notes وknowledge items | يحفظ version وtags وlinks وvisibility |
| FR-027 | لوحة Production Studio | تعرض jobs والحالة وoutputs ومصدر كل output |
| FR-028 | طابور أعمال طويل | يملك job id وprogress وretry policy وcancel |
| FR-029 | صوت اختياري | STT/TTS لا يعملان دون permission ومؤشر تسجيل واضح |
| FR-030 | Git operations آمنة | commit لا ينفذ إلا بعد عرض diff واعتماد المستخدم |
| FR-031 | GitHub integration | gh/API tokens تحفظ في secret store ولا تظهر في prompts |
| FR-032 | Automation manual/assisted/autonomous | كل وضع يطبق policy مختلفة قابلة للعرض |
| FR-033 | Checkpoints وrollback | يمكن استعادة آخر checkpoint للمهمة أو الملف |
| FR-034 | Audit export | يمكن تصدير سجل العمليات بصيغة JSON/Markdown |
| FR-035 | دعم RTL/LTR | يمكن تبديل الاتجاه واللغة دون إعادة تشغيل |
| FR-036 | تحديثات التطبيق | يتحقق من توقيع/سلامة artifact قبل التثبيت |
| FR-037 | Plugin health | يعرض الإصدار، الصلاحيات، الحالة، وآخر فحص |
| FR-038 | OpenTo adapter placeholder | يرفض التشغيل إذا كانت مواصفة OpenTo غير متوفرة بدل التخمين |

## use cases الحرجة

**UC-001: تغيير آمن.** يطلب المستخدم تعديلًا، يبني agent خطة، يقرأ الملفات، يطلب موافقة قبل الكتابة، ينشئ checkpoint، يطبق patch، يشغل الاختبارات، ثم يعرض diff والنتيجة. **UC-002: تقرير بحثي.** يجمع agent المصادر، يسجلها، يفرغ المحتوى، يبني outline، يكتب أقسامًا منفصلة، يدقق citations، ثم يصدر Markdown/PDF. **UC-003: فشل provider.** يفشل provider، يسجل health event، يطبق fallback policy، ويعرض للمستخدم تغير الجودة/التكلفة. **UC-004: مهمة مجدولة.** ينشئ المستخدم job في assisted mode، يبقى disabled حتى approval، ثم يعمل supervisor مع timeout وpause.

إعداد: Manus AI. تاريخ الفحص: 2026-08-21.
