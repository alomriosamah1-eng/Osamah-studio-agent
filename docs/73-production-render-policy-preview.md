# Production Studio: Render Job Policy وValidation Preview

**الحالة:** Architecture decision معتمد للتنفيذ التالي؛ هذه الشريحة تقرأ `ArtifactDraft` وتصدر قرارًا bounded فقط، ولا تشغّل renderer أو converter أو export.

## الغرض

بعد بناء `ArtifactManifest` تحتاج Production Studio إلى فحص مسبق للجاهزية والصيغة والموارد والوجهة قبل إنشاء render job حقيقي. يقدم `RenderJobPolicy` قرارًا قابلًا للمراجعة يحدد هل يمكن طلب render لاحقًا، وما التحذيرات والحدود، من دون تنفيذ العملية. لا يستخدم القرار `child_process` أو `fetch` أو filesystem، ولا يكتب outputPath أو ينشئ ملفًا.

تتبع الشريحة المسار `artifact draft → render policy preview → render worker لاحقًا → validation → export`. وجود قرار `allowed_preview` لا يعني أن renderer نجح أو أن artifact صار منشورًا، ولا يمنح موافقة Human Gate لأي mutation.

## النموذج

```ts
export type RenderFormat = "markdown" | "html" | "pptx" | "pdf" | "image" | "video";
export type RenderDecision = "blocked" | "review_required" | "allowed_preview";

export interface RenderBudget {
  readonly timeoutMs: number;
  readonly maxMemoryMb: number;
  readonly maxOutputBytes: number;
  readonly maxPages: number;
}

export interface RenderPolicyRequest {
  readonly artifactId: string;
  readonly format: RenderFormat;
  readonly relativeDestination?: string;
  readonly budget?: Partial<RenderBudget>;
}

export interface RenderPolicyPreview {
  readonly artifactId: string;
  readonly format: RenderFormat;
  readonly decision: RenderDecision;
  readonly adapter: "markdown" | "html" | "slides" | "document" | "media" | "none";
  readonly budget: RenderBudget;
  readonly warnings: readonly string[];
  readonly checks: readonly string[];
  readonly executionStarted: false;
}
```

## قواعد السياسة

| الفحص | القرار |
|---|---|
| artifact غير موجود أو `blocked` | `blocked` |
| format غير متوافق مع artifact kind | `blocked` |
| destination مطلق أو يحوي traversal/backslash/NUL | `blocked` |
| artifact `needs_review` أو format يحتاج adapter غير متاح | `review_required` |
| budgets خارج low-memory bounds | `blocked` |
| artifact مكتمل، format معروف، والوجهة النسبية آمنة | `allowed_preview` |

تظل `pdf` و`pptx` صيغ مراجعة سياسة فقط في هذه الشريحة؛ لا تُحوّل المستندات أو الشرائح إلى ملفات فعلية. لا تستدعي الخدمة `manus-export-slides` أو Pandoc أو LibreOffice أو qpdf أو FFmpeg. adapter في النتيجة هو اسم policy route وليس كائنًا قابلًا للتنفيذ.

الحدود الافتراضية منخفضة الذاكرة هي `timeoutMs <= 30_000`، و`maxMemoryMb <= 512`، و`maxOutputBytes <= 64 MiB`، و`maxPages <= 100`. أي طلب أكبر يرفض fail-closed قبل أي worker. لا تُقبل `outputPath` مطلقًا؛ إن وُجدت الوجهة فهي relative metadata وتبقى غير مكتوبة.

## Application وIPC وWorkspace

يعرف Application port العملية `preview(request): RenderPolicyPreview` ويقرأ draft من `ArtifactAssemblyPort`. يعيد `checks` deterministic مثل `artifact_manifest_present` و`claims_supported` و`tools_not_invoked`، ويحافظ دائمًا على `executionStarted: false`. لا يقبل renderer manifest أو adapter أو shell arguments، بل يقبل artifact ID وصيغة وbudget bounded فقط.

تضيف IPC method مثل `production.render.policy.preview`. validator يتحقق من enum وIDs والوجهة النسبية والـbudget قبل Application، ويمنع duplicate أو unknown fields التنفيذية مثل `command`, `outputPath` المطلق، `env`, `provider`, و`execute`. يعرض Workspace بطاقة Render Readiness مع decision وadapter وbudget وchecks والتحذيرات، وزرًا واحدًا `Preview render policy` لا يبدأ render.

## الاختبارات وبوابة الخروج

تثبت الاختبارات أن artifact blocked أو missing يحجب القرار، وأن artifact needs_review يعيد review_required، وأن format/destination/budget غير الصالحة ترفض قبل Application. تثبت أن policy لا تستدعي filesystem أو network أو child process، وأن `executionStarted` ثابتة false، وأن القيم bounded وredacted، وأن Human Gate queue لا تتغير. يضاف Electron smoke لقرار blocked من Content Plan غير موثق وقرار allowed_preview من fixture مكتمل، دون output file.

تبقى render workers، format validators الفعلية، output destination manager، export، signed manifest، media conversion، وHuman Gate لمسار النشر شرائح مستقلة لاحقة. لا تُستخدم هذه الشريحة لإخفاء فشل renderer أو اعتبار preview policy artifact نهائيًا.

إعداد: Manus AI. تاريخ التحديث: 2026-08-22.
