# إدارات الحسابات الخارجية والتخزين والتطوير الذاتي

## 1. إدارة الحسابات الخارجية

إدارة الحسابات الخارجية هي control plane للهوية والاتصالات، وليست مكانًا لتنفيذ الأدوات. يبدأ كل حساب بحالة `disconnected`، ولا تُنفذ network call عند startup أو عند فتح لوحة التحكم. يحتفظ التطبيق بمرجع account metadata وprovider capabilities وconsent state، بينما تُدار القيم السرية عبر secret boundary مستقلة ولا تظهر في renderer أو logs أو prompts.

| العنصر | النموذج المقترح | القاعدة |
|---|---|---|
| الحساب | `accountId`, `providerId`, `label`, `owner`, `status` | لا token ولا cookie داخل الكيان المرئي |
| الصلاحيات | `scopes`, `resourceScope`, `expiresAt` | least privilege وscopes قابلة للمراجعة |
| الموافقة | `consentState`, `approvedAt`, `approvalId` | لا اتصال أو tool call قبل consent صريح |
| التحقق | `lastCheckedAt`, `verificationState`, `failureReason` | UNKNOWN يبقى UNKNOWN ولا يتحول إلى connected |
| الإلغاء | `disconnect`, `revoke`, `forgetMetadata` | يتطلب مراجعة وأثرًا في AuditEvent عند حذف أو إبطال |

تُفصل حسابات GitHub وGoogle وOAuth العامة عن provider المحلي وMCP server. لا يعني تسجيل حساب أن agent يملك صلاحية النشر أو الكتابة؛ كل فعل عالي الخطورة يمر عبر capability policy وHuman Gate. يبقى Playwright وPort Forwarding وMCP client خارج التنفيذ حتى تُعتمد identity وSSRF وtrace وcancellation boundaries.

## 2. إدارة التخزين

تجمع الإدارة معلومات profile وSQLite وmemory وbackup وquota في شاشة واحدة مع فصل العمليات. تعرض الشاشة metadata والاستخدام والسياسة، لكنها لا تنفذ نقلًا أو حذفًا أو استعادة من زر عادي. تظل SQLite مصدر الحقيقة عند اعتماد persistence، ويظل in-memory fallback واضحًا في الحالة.

| المجال | الإعدادات | عملية حساسة تحتاج Human Gate |
|---|---|---|
| profile | profile ID ومسار canonical وحالة lock | تغيير profile أو فتح مسار جديد |
| database | memory أو SQLite، schema version، migrations | migration destructive أو downgrade |
| memory | retention، visibility، provider access | purge أو مشاركة خارجية |
| backup | destination، encryption state، آخر manifest/hash | إنشاء نسخة خارجية أو restore |
| quota | max bytes، object count، cleanup policy | حذف تلقائي أو تجاوز quota |

لا تُضاف FTS5 أو object store أو embeddings إلى شريحة إعدادات العرض. أي persistence جديدة يجب أن تأتي مع migration، checksum، restart test، backup/restore، privacy deletion، وlow-memory benchmark مستقل.

## 3. إدارة التطوير الذاتي

المقصود بالتطوير الذاتي هو أن يضيف المالك **توجيهات واستراتيجيات ومخططات ومهارات** يفهمها النظام ويقترح دمجها مع قواعده المعرفية، وليس أن يغير النظام نفسه أو يمنح الوكلاء صلاحيات جديدة من تلقاء ذاته.

تمر كل مادة بالمسار التالي:

```text
User input
   ↓
Self-development candidate
   ↓  classify: instruction | strategy | plan | skill
Local parse + bounded normalization
   ↓
Review required + provenance + scope
   ↓  explicit user confirmation
Active knowledge/rule overlay
   ↓
Preview impact + conflict check + rollback
```

| النوع | ما يخزنه | ما يحتاجه قبل التفعيل |
|---|---|---|
| instruction | صياغة توجيه أو تفضيل عمل | scope وpriority وسبب ومصدر |
| strategy | مبدأ أو أسلوب لحل فئة مسائل | applicability وtrade-offs وexamples |
| plan | خطوات مترابطة لهدف | owner وdependencies وacceptance criteria |
| skill | وصف قدرة أو playbook | inputs/outputs/tools/permissions وtest fixture |

كل عنصر يحمل `candidateId` و`kind` و`title` و`content` و`scope` و`source` و`provenance` و`status` و`version` و`conflicts` و`reviewReason`. القيم الافتراضية هي `review_required` و`providerAccess=never` و`visibility=private` و`retention=until_deleted` أو سياسة يحددها المالك صراحة.

### قواعد الدمج المعرفي

يُدمج العنصر النشط كـ**overlay قابل للإزالة** فوق القواعد الأساسية، ولا يعاد كتابة core policy أو security boundary. لا يغير skill قائمة الصلاحيات، ولا يرفع provider access، ولا ينشئ tool manifest، ولا يبدل Human Gate. عند التعارض بين تعليمات المستخدم وقاعدة أمان أو عقد typed، تسود القاعدة الآمنة ويظهر conflict قابل للمراجعة.

يعامل محتوى التطوير الذاتي كبيانات غير موثوقة؛ فلا ينفذ أوامر داخل النص، ولا يتبع prompt injection أو تعليمات repo/web/PDF كأنها سياسة. لا تصبح المادة `VERIFIED` لمجرد قبولها محليًا، ويظل الفرق واضحًا بين `user_confirmed` و`externally_verified`.

### دورة المراجعة والتراجع

يُظهر النظام diff بين النسخة السابقة والجديدة، والـscope المتأثر، والوكلاء أو الإدارات التي قد تستخدم العنصر، وأي تعارض أو صلاحية إضافية مقترحة. لا ينتقل العنصر من `review_required` إلى `active` إلا بعد تأكيد صريح مسجل. يمكن للمالك `archive` أو `rollback` إلى نسخة سابقة، ويجب أن تبقى النسخ القديمة وسبب القرار ضمن audit bounded دون أسرار أو ملفات المستخدم الخام.

## حدود التنفيذ المرحلي

أُغلقت شريحة **إعدادات العرض العامة**: locale/theme/fontScale/density/reduceMotion. تلتها شريحة `External Accounts — Metadata-only` الموثقة في `docs/87-external-accounts-metadata-only.md`؛ تسجل provider/label/owner/scopes وresourceScope في الذاكرة فقط، وتبدأ `disconnected` مع `consent_required` و`unknown` verification، دون OAuth أو MCP أو persistence أو secrets أو network. تبقى الشريحة التالية Storage Settings، ثم Self-development Candidate Review وRule Overlay. لا تُفعل OAuth أو MCP أو skill execution تلقائيًا، ولا تُضاف قاعدة معرفية دائمة قبل تصميم migration والخصوصية والـrollback.
