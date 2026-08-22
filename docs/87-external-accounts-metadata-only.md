# External Accounts — Metadata-only

## الحالة

أُغلقت هذه الشريحة كتنفيذ محلي محدود بعد إغلاق Arabic-first Application Settings. تسجل اللوحة بيانات وصفية للحسابات الخارجية فقط، ولا تنفذ OAuth أو MCP أو GitHub أو Google أو أي network call، ولا تحفظ token أو cookie أو secret. تبدأ كل سجلات الحسابات بالحالة `disconnected`، والموافقة `required`، والتحقق `unknown`.

هذه الشريحة لا تعني أن الحساب أصبح متصلًا، ولا تمنح Agent أو Provider أي صلاحية. الاتصال الفعلي، secret boundary، consent flow، revoke، audit، وHuman Gate للأفعال الخارجية تبقى شرائح مستقلة لاحقة.

## التصميم المنفذ

| المجال | التنفيذ |
|---|---|
| Application contract | `ExternalAccountRecord` و`RegisterExternalAccountRequest` و`ExternalAccountRegistryPort` |
| Service | `InMemoryExternalAccountRegistry` بحد أقصى 64 سجلًا وdeduplication ثابت |
| State defaults | `status=disconnected`، `consentState=required`، `verificationState=unknown` |
| Metadata | provider ID، label، owner، scopes، resourceScope، expiresAt، createdAt |
| Validation | provider slug، نصوص single-line، scopes unique بحد أقصى 16، resourceScope bounded، expiry date صالحة |
| IPC | `external.account.register` و`external.account.list` عبر `IpcMethodMap` وfail-closed payload validators |
| Composition | التسجيل في `createEmbeddedApplication` داخل الذاكرة؛ لا persistence ولا startup probe |
| Workspace | تبويب الحسابات يعرض نموذج metadata وقائمة الحالة والنطاقات دون حقول سرية |
| Testing | Application contract tests وIPC end-to-end وmalformed payload وdesktop smoke |

## حدود الأمان والخصوصية

لا يقبل IPC حقولًا زائدة مثل `token`، ولا يمرر أي payload إلى provider أو `fetch`. لا تعرض الواجهة secret input، وتبقى `owner` و`label` و`resourceScope` بيانات وصفية bounded وتُمرر عبر redaction المشتركة. تسجيل البيانات الوصفية لا يساوي consent ولا verification ولا authorization.

لا توجد في هذه الشريحة عمليات `connect`, `disconnect`, `revoke`, `forgetMetadata`, OAuth callback، token storage، cookie storage، أو external account persistence. كل هذه العناصر تحتاج عقدًا مستقلًا، secret provider آمنًا، policy واضحة، audit، وHuman Gate قبل التنفيذ.

## الملفات

| الملف | الدور |
|---|---|
| `src/application/external-account-registry.ts` | العقد والخدمة والحدود الافتراضية |
| `src/external-account-registry.test.ts` | اختبارات الخدمة والحدود والـdeduplication |
| `src/ipc/contracts.ts` | methods وpayload validators |
| `src/ipc/embedded-handlers.ts` | handlers الخاصة بالتسجيل والسرد |
| `src/composition.ts` | wiring in-memory فقط |
| `src/ipc.test.ts` | اختبار IPC وعدم network/secrets |
| `prototypes/studio/index.html` | نموذج وقائمة الحسابات في Control Center |
| `prototypes/studio/workspace.js` | load/register/render وdesktop smoke |

## معايير القبول المتحققة

تسجل الخدمة حسابًا ببيانات وصفية وتطبّع provider ID، وتعيد الحالة `disconnected` والموافقة `required` والتحقق `unknown`. تمنع التكرار والحقول غير المسموح بها والقيم غير الصالحة، وتوفر list bounded. يمر المسار عبر typed IPC، ولا يستدعي `fetch` أو provider أو filesystem mutation. تعرض Workspace البيانات باستخدام DOM آمن، ويثبت desktop smoke التسجيل والسرد ورفض محاولة إدخال token.

## الحدود والخطوة التالية

تبقى إدارة الحسابات الخارجية في Control Center **metadata-only** حتى تُصمم secret boundary وconsent/revoke lifecycle. لا ينبغي ربطها بـMCP أو Playwright أو GitHub أو Google أو أدوات الوكيل في هذه المرحلة. كما لا تتغير دراسة Virtual Human المؤجلة؛ Avatar لا يكتسب أي صلاحية حسابية أو شبكة من هذه الشريحة.

إعداد: Manus AI. تاريخ التنفيذ: 2026-08-22.
