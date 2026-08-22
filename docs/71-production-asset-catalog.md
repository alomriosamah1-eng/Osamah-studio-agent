# Production Studio: Asset Catalog وCreative Brief

**الحالة:** Architecture decision معتمد للتنفيذ التالي؛ لا توجد في هذه الشريحة عملية media generation أو import أو converter execution.

## الغرض

تضيف هذه الشريحة سجلًا خفيفًا للأصول الإبداعية فوق `ContentPlan` و`SourceRegistry`. يسجل السجل هوية الأصل وmedia type وhash/bytes عند توفرهما، ومعلومات الترخيص والإسناد، وروابط provenance، وحالة الاستخدام. أما `CreativeBrief` فيحوّل نية section أو artifact إلى متطلبات قابلة للمراجعة مثل الاتجاه البصري، المقاس، النبرة، القيود، والأصول المطلوبة. لا ينفذ السجل إنشاء صورة أو فيديو أو صوت، ولا ينزّل أصلًا من الشبكة، ولا يشغّل FFmpeg أو ComfyUI أو converters عند التسجيل أو الإقلاع.

يتبع المسار العام `content plan → assets → assembly → render → validation → export` كما هو موثق في [Production Studio scope](23-production-studio.md)، لكن هذه الشريحة تتوقف عند metadata والـbrief. يبقى assembly/render/export مسارًا لاحقًا مستقلًا، ويجب أن يحمل artifact النهائي manifest بالمصادر والأدوات بعد وجود عقد منفصلة.

## النموذج والحدود

| المجال | قرار النسخة الأولى |
|---|---|
| Asset locator | نص metadata bounded؛ لا يفتح `file://` أو URL تلقائيًا ولا يعرض absolute root غير الضروري |
| Content | لا يحفظ raw binary أو prompt سري أو auth header؛ يحفظ bytes/hash فقط عند إدخالها صراحة |
| License | اسم الترخيص والإسناد والحالة `declared/unverified/verified/blocked`؛ لا يفترض صلاحية تجارية من الاسم وحده |
| Provenance | `sourceIds` معروفة من `SourceRegistry`، وروابط provenance اختيارية؛ الأصل بلا مصدر يبقى warning |
| Creative brief | intent وvisual direction وconstraints وasset slots bounded؛ لا يعني أمر تنفيذ |
| Generation | خارج النطاق؛ لا provider/network/model loading ولا ComfyUI/FFmpeg invocation |
| Storage | in-memory أولًا؛ object store وSQLite persistence لاحقان عبر migrations مستقلة |
| Export | خارج النطاق؛ لا يُنشأ artifact أو manifest نهائي من هذه الخدمة |

## العقود التطبيقية

```ts
export type AssetKind = "image" | "video" | "audio" | "document" | "other";
export type LicenseState = "declared" | "unverified" | "verified" | "blocked";

export interface AssetLicense {
  readonly name: string;
  readonly attribution?: string;
  readonly sourceLocator?: string;
  readonly state: LicenseState;
  readonly warnings: readonly string[];
}

export interface AssetRecord {
  readonly assetId: string;
  readonly kind: AssetKind;
  readonly title: string;
  readonly locator: string;
  readonly mediaType?: string;
  readonly bytes?: number;
  readonly sha256?: string;
  readonly license: AssetLicense;
  readonly sourceIds: readonly string[];
  readonly warnings: readonly string[];
}

export interface CreativeBrief {
  readonly briefId: string;
  readonly title: string;
  readonly intent: string;
  readonly visualDirection?: string;
  readonly constraints: readonly string[];
  readonly assetSlots: readonly string[];
  readonly assetIds: readonly string[];
  readonly warnings: readonly string[];
}
```

يعرف Application port العمليات `registerAsset` و`listAssets` و`createBrief` و`getBrief` و`attachAsset`. يمرر أي ربط للأصل بـ`assetId` فقط بعد تسجيله، وتتحقق الخدمة من وجود asset ومن أن `sourceIds` موجودة في Source Registry. يُرفض asset ذو hash غير صالح أو bytes غير آمنة أو locator يحتوي NUL أو traversal أو raw secret-like token. تكون كل القوائم والـwarnings محدودة، ولا تسترجع الخدمة binary أو محتوى ملف.

## الترخيص والـprovenance

تُفصل حالة الترخيص عن حالة المصدر. `verified` هنا تعني أن metadata الخاصة بالترخيص اجتازت validator المحلي أو أدخلها مستخدم موثوق، ولا تعني أن النظام اشترى الحق أو تحقّق من مالك العمل. `blocked` يمنع ربط الأصل بــbrief جديد، بينما `unverified` يسمح بعرضه مع warning ولا يسمح بتقديمه في artifact منشور قبل مراجعة لاحقة. لا تتحول أي معلومة من webpage أو PDF أو provider إلى FACT أو license grant تلقائيًا.

عند وجود `sourceIds`، تتحقق الخدمة من أن كل ID معروف في `SourceRegistry`; إذا كان source غير موجود، يرفض التسجيل fail-closed بدل إنشاء provenance مكسور. إذا كان المصدر أو citation غير موثق، يبقى الأصل ظاهرًا لكن warning صريحًا. لا تستخدم الخدمة `fetch` أو browser أو filesystem للوصول إلى locator، وبالتالي لا يوجد network side effect أو تسريب لمسار محلي.

## الواجهة وIPC

تضيف الطبقة methods bounded مثل `production.asset.register` و`production.asset.list` و`production.brief.create` و`production.brief.get` و`production.brief.asset.attach`. تتحقق IPC من enum وstring bounds وhash/bytes وlicense state وsource ID count قبل Application. لا يقبل renderer object binary أو license headers، ولا يسمح للـlocator بأن يصبح رابطًا قابلًا للنقر تلقائيًا.

يعرض Workspace بطاقة metadata للأصل، وحالة الترخيص، وعدد المصادر، وتحذيرات brief، وasset slots. يستخدم renderer `textContent` و`replaceChildren`، ويظهر بوضوح أن الأزرار تنشئ سجلًا محليًا أو brief فقط ولا تبدأ generation أو conversion أو export أو كتابة ملفات.

## الاختبارات وبوابة الخروج

يجب أن تثبت الاختبارات التسجيل bounded وdeduplication أو رفض التكرار، والتحقق من hash/bytes، ورفض source IDs المجهولة، ورفض license state `blocked` عند attach، وحماية حدود title/locator/constraints/asset slots، وعدم حفظ raw binary أو secrets. يجب أن تثبت IPC malformed payload rejection، وdesktop smoke asset/brief metadata flow، وعدم وجود network أو converter process أو filesystem mutation، وبقاء Human Gate queue كما هي.

تظل الخطوات التالية منفصلة: media generation provider policy، local ComfyUI integration، FFmpeg worker، object store، artifact assembly، render/validation، C2PA أو manifest signing، وexport. لا يجوز اختصار هذه الحدود بإضافة زر Generate إلى هذه اللوحة.

إعداد: Manus AI. تاريخ التحديث: 2026-08-22.
