# Production Studio: Content Plan وClaim/Citation Integrity

**الحالة:** منفذة ومدفوعة ومتحقق منها عند feature `403372b4b13c2545818d4fd0fddff180bde89983`؛ docs-close مستقل ويحدّث summaries فقط. لا توجد في هذه الشريحة كتابة مستند نهائي أو توليد provider-backed أو تصدير.

## الغرض

تضيف هذه الشريحة طبقة مراجعة بين Source Registry وبين أي مستند أو عرض لاحق. يحتفظ `ContentPlan` بهدف إنتاجي bounded، وبأقسام مرتبة، وبـ`ClaimRecord` لكل ادعاء قابل للإسناد، وبحالة citation واضحة. لا يسمح النظام بإعلان claim موثق إذا لم يرتبط بمصدر معروف وبـcitation موجودة؛ ولا يسمح بربط claim بمصدر لم تُسجل له قراءة أو metadata كافية. يبقى claim غير الموثق ظاهرًا كـ`unresolved` بدل إسقاطه أو تحويله إلى FACT.

تلتزم الشريحة بمبدأ Production Studio القائم على فصل `content plan → assets → assembly → render → validation → export`، وبأن source discovery وfinal copy مساران منفصلان. كما تحافظ على قاعدة البحث الأكاديمي: لا يسمح بإسناد مرجع لم تتم قراءته، مع إبقاء القراءة والتحقق مستقلين عن التوليد.

## النطاق والحدود

تدعم النسخة الأولى إنشاء خطة محتوى من brief قصير، وإضافة sections وclaims، وربط claim بـ`CitationRecord` موجود في `SourceRegistryPort`، ثم حساب integrity summary bounded. لا تستدعي هذه الطبقة provider أو browser أو network، ولا تنفذ document converter أو slide renderer أو media job، ولا تكتب ملفات المستخدم. أي توليد لغوي لاحق يحتاج مسارًا منفصلًا يمر عبر provider policy وHuman Gate عند اللزوم.

| القرار | التطبيق |
|---|---|
| مصدر citation | `SourceRegistryPort` فقط؛ لا يقبل claim locator حرًا كمرجع |
| حالة claim الافتراضية | `unresolved` حتى يثبت وجود citation ومصدر معروف |
| دليل القراءة | `CitationRecord` مع span/page/section أو `quotePreview` bounded؛ غياب الموضع يظل warning لا proof |
| صحة المصدر | `verificationState` موروثة وتظهر للمستخدم؛ لا تساوي صحة علمية أو قانونية |
| التوليد | غير موجود في هذه الشريحة، ولا provider/network عند startup أو preview |
| التخزين | in-memory أولًا؛ SQLite persistence لاحقًا عبر migration مستقلة |
| العرض | brief/sections/claims وstatus/warnings فقط؛ لا transcript أو محتوى كامل عبر IPC |
| التصدير | غير موجود؛ manifest/export يحتاج feature وعقدًا مستقلين |

## النموذج الأولي

```ts
export type ClaimVerificationState = "unresolved" | "supported" | "conflicted";

export interface ContentSection {
  readonly sectionId: string;
  readonly title: string;
  readonly order: number;
  readonly summary?: string;
}

export interface ClaimRecord {
  readonly claimId: string;
  readonly sectionId: string;
  readonly text: string;
  readonly citationIds: readonly string[];
  readonly verificationState: ClaimVerificationState;
  readonly confidence?: number;
  readonly warnings: readonly string[];
}

export interface ContentPlan {
  readonly planId: string;
  readonly brief: string;
  readonly sections: readonly ContentSection[];
  readonly claims: readonly ClaimRecord[];
  readonly integrity: {
    readonly totalClaims: number;
    readonly supportedClaims: number;
    readonly unresolvedClaims: number;
    readonly conflictedClaims: number;
    readonly warnings: readonly string[];
  };
}
```

تُحدّث `ClaimRecord.verificationState` بصورة deterministic من citation graph: `supported` فقط عندما تكون كل citation IDs موجودة ومربوطة بمصدر معروف، ولا تكون citations فارغة، ولا توجد حالة `invalid` في المصدر أو citation. إذا غاب المصدر، أو فُقدت citation، أو تعارضت الأدلة، تصبح الحالة `unresolved` أو `conflicted` مع warning قابل للعرض. لا يقرر النظام صحة النص نفسه ولا يستبدل المراجعة البشرية.

## Ports ومسار الاستخدام

يعرف Application port العمليات bounded التالية: `createPlan(brief)`، `addSection(planId, section)`، `addClaim(planId, claim)`، `attachCitation(planId, claimId, citationId)`، و`getPlan(planId)`. يعتمد port على `SourceRegistryPort` لقراءة citations والمصادر، ولا يحتوي على `fetch` أو `fs` أو provider dependency. يجب أن تكون كل عملية idempotent قدر الإمكان، وأن ترفض plan/section/claim/citation IDs المجهولة أو النصوص الفارغة أو الحدود المتجاوزة fail-closed.

يكون الناتج `ContentPlan` قابلاً للمراجعة وليس instruction للتنفيذ. لا ينشئ approval ticket ولا checkpoint ولا artifact. إذا احتاج المستخدم لاحقًا إلى توليد section copy، ينشأ `ContentGenerationJob` مستقل يستهلك الخطة بعد مراجعة integrity ولا يفترض أن كل claim supported.

## IPC وواجهة Production Studio

يضيف IPC المستقبلي methods bounded مثل `production.plan.create` و`production.plan.get` و`production.plan.claim.add` و`production.plan.citation.attach`. لا يسمح validator بتمرير citation object كامل من renderer إلى Application؛ يمرر citationId فقط، ويتحقق Application من وجوده داخل Source Registry. يعرض panel brief/sections/claims وحالة citation وعدادات integrity، مع تنبيه واضح بأن `unresolved` يحتاج مصدرًا أو مراجعة ولا توجد كتابة أو export.

يستخدم renderer `textContent` و`replaceChildren`، ولا يبني HTML من claim أو brief أو quote. لا يعرض absolute root أو raw headers أو local file secrets، ولا يضع locator في `href` تلقائيًا. أي URL يعرض كنص غير موثوق ما لم تُبنَ سياسة فتح/متصفح مستقلة.

## الاختبارات وبوابة الخروج

لا تنتقل الشريحة إلى implementation اللاحقة قبل نجاح: إنشاء plan bounded، رفض brief فارغ أو كبير، منع claim بلا section، رفض citation مجهولة، منع duplicate citation attachment، preservation لحالة `invalid`، deterministic integrity counts، propagation للتحذيرات، وعدم استدعاء `fetch` أو provider وعدم mutation للملفات وعدم إنشاء approval ticket. يجب أن تثبت اختبارات IPC أن malformed IDs والقيود غير الصالحة ترفض قبل Application.

تظل persistence SQLite، FTS5، source extraction، browser discovery، claim generation، academic ranking، C2PA manifest، export، render، وHuman Gate لمسار نشر artifact خارج هذه الشريحة. بعد إغلاقها ستكون الخطوة التالية إما content outline/sections أوسع أو artifact assembly وفق أولوية Production Studio.

إعداد: Manus AI. تاريخ التحديث: 2026-08-22.
