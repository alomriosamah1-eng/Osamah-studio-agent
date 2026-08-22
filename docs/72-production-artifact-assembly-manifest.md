# Production Studio: Artifact Assembly وManifest Review

**الحالة:** منفذة ومدفوعة ومتحقق منها عند feature `5244ed3e3b237a98e16f92aeec7453c1195b356d`؛ docs-close مستقل ويحدّث summaries فقط. تنشئ الشريحة draft assembly وmanifest في الذاكرة فقط، ولا تنفذ render أو export أو كتابة ملفات.

## الغرض

تضيف هذه الشريحة طبقة تجميع قابلة للمراجعة بين `ContentPlan` و`AssetCatalog` وقبل render/export. يجمع `ArtifactDraft` خطة المحتوى، claims، creative brief، والأصول المشار إليها، ثم يبني manifest bounded يوضح provenance والمصادر والأدوات المستخدمة. لا ينتج الملف النهائي ولا يشغّل converter أو FFmpeg أو ComfyUI، ولا يفتح locator أو يقرأ binary. الهدف هو كشف النقص والتعارض قبل أي job تنفيذي مستقل.

يظل المسار الإنتاجي المفصول هو `content plan → assets → assembly → render → validation → export`. هذه الشريحة تغطي assembly review وmanifest completeness فقط، ولا تختصر `render` أو `validation` أو `export` في زر واحد. كل نتيجة غير مكتملة تبقى `blocked` أو `needs_review` ولا تُعرض كـartifact نهائي.

## النموذج

```ts
export type ArtifactKind = "document" | "presentation" | "media_bundle" | "markdown";
export type ArtifactReviewState = "needs_review" | "ready_for_render" | "blocked";

export interface ArtifactManifest {
  readonly sources: readonly string[];
  readonly assets: readonly string[];
  readonly tools: readonly string[];
  readonly claims: readonly string[];
  readonly warnings: readonly string[];
}

export interface ArtifactDraft {
  readonly artifactId: string;
  readonly kind: ArtifactKind;
  readonly title: string;
  readonly contentPlanId: string;
  readonly briefId?: string;
  readonly claimIds: readonly string[];
  readonly assetIds: readonly string[];
  readonly reviewState: ArtifactReviewState;
  readonly manifest: ArtifactManifest;
  readonly warnings: readonly string[];
}
```

يُنشئ Application port draft من IDs فقط: `createDraft` و`getDraft`. تتحقق الخدمة من وجود `ContentPlan` و`CreativeBrief` وassets في ports الخاصة بها، وتعيد بناء claim/asset/source sets من مصدر الحقيقة بدل قبول manifest كامل من renderer. لا يُسمح بإضافة source أو tool يدويًا إلى manifest؛ الأدوات في هذه الشريحة تظل قائمة فارغة لأن أي converter أو renderer لم يُستدعَ.

## completeness والـprovenance

يكون draft `ready_for_render` فقط إذا كانت الخطة موجودة، وكل claims المرتبطة بها `supported`، ولا يوجد asset محظور أو brief ناقص، ولا يوجد ID مجهول. وجود citation أو asset license في حالة `unverified` لا يحوّلها إلى verified؛ يبقى warning ظاهرًا، ويمكن أن تكون النتيجة `needs_review` قبل render. claim غير الموثق أو المتعارض يجعل draft `blocked`، بينما لا تسقط الخدمة claim ولا تخفي warning.

يجمع manifest source IDs من citations المرتبطة بالclaims ومن source IDs للأصول المرتبطة بالbrief. تُزال التكرارات وتُرتب deterministically وتُحد القوائم. يحفظ manifest IDs وmetadata فقط، ولا ينسخ quote أو binary أو prompt أو auth header أو absolute root. لا يثبت manifest الملكية أو الصلاحية التجارية أو الحقيقة العلمية؛ هو سجل تتبع محلي قابل للتدقيق.

| الحالة | الشرط |
|---|---|
| `blocked` | plan/brief/asset ID مجهول، claim unresolved/conflicted، أو asset license `blocked` |
| `needs_review` | IDs صالحة لكن توجد source/license warnings أو brief slots ناقصة |
| `ready_for_render` | جميع المراجع صالحة ومراجعة، ولا توجد warnings blocking؛ لا يعني أن render نجح |

## IPC وWorkspace

تضيف الطبقة methods مثل `production.artifact.draft.create` و`production.artifact.draft.get`. يمرر renderer `contentPlanId` و`briefId` وIDs bounded، ويعرض response manifest والـreview state والتحذيرات. لا يُسمح بأي payload binary أو outputPath أو converter arguments أو execution flag. validator يرفض enums غير المعروفة والقوائم المكررة والـIDs الفارغة أو المتجاوزة.

يعرض Workspace Artifact Review بطاقة draft وstate وعدد claims/assets/sources، وقائمة manifest نصية، وتحذيرًا ثابتًا: «هذه معاينة assembly فقط؛ لا render ولا export ولا كتابة ملفات». يستخدم `textContent` و`replaceChildren`، ولا ينشئ `href` من source أو asset locator. لا تُضاف أزرار render/export في هذه الشريحة.

## الاختبارات وبوابة الخروج

تثبت الاختبارات أن draft يحافظ على عدم التغيير، ويرفض plan/brief/asset المجهولة، ويجمع IDs deterministically، ويمنع blocked assets والclaims غير المدعومة، ويُظهر unverified warnings، ويضع `tools` فارغة، ويحد القوائم. تثبت اختبارات IPC fail-closed للـpayload المشوه والقوائم المكررة، وتثبت Electron smoke تدفق draft/manifest مع بقاء Human Gate بلا تذكرة جديدة.

يجب أن يبقى startup بلا network أو model loading، ولا تُشغّل scripts أو native toolchains أو converters. persistence SQLite وobject store وsigned manifest وrender workers وformat validators وexport destinations وHuman Gate لمسار نشر artifact تؤجل إلى شرائح منفصلة.

إعداد: Manus AI. تاريخ التحديث: 2026-08-22.
