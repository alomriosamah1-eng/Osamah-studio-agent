# تنفيذ Project Preview Runtime — الشريحة الثانية

## النتيجة

تحولت المعاينة من نموذج واجهة ثابت إلى مسار برمجي يستقبل ملفات مشروع، يبني `ProjectPreviewBundle` deterministic، يستخرج dependencies المحلية، يصنف imports، ينتج render tree توافقية، ثم يحافظ على runtime snapshot والأحداث والـ diagnostics داخل جلسة المحاكي.

## مكونات التنفيذ

| المكون | الملف | ما يثبته |
|---|---|---|
| Bundle builder | `src/mobile/preview-runtime.ts` | entry/modules/assets/sourceHash/capabilities/warnings/render tree |
| Fixture renderer | `src/mobile/preview-runtime.ts` | تحويل TSX fixture إلى View/Text/Card/Status tree آمن |
| Runtime | `FixturePreviewRuntime` | load/input/fast refresh/reload/stop/inspect/events |
| Controller bridge | `src/mobile/embedded-controller.ts` | حقن bundle عند start، input، refresh، inspect diagnostics/events |
| IPC bridge | `src/ipc/contracts.ts`, `embedded-handlers.ts` | `preview.start` و`preview.refresh` و`preview.inspect` عبر protocol v1 |
| Project fixture | `fixtures/mobile-expo/**` | مشروع Expo صغير له entry ومكوّن محلي وmanifest |
| Filesystem scanner | `src/infrastructure/filesystem-project-scanner.ts` | قراءة محدودة وآمنة للملفات وJSON مع منع symlink/path traversal وتجاهل المجلدات المولدة |
| Project preview service | `src/application/project-preview-service.ts` | اختيار entry من manifest أو fallback معروف وبناء bundle من root فعلي دون تشغيل scripts |

## الحدود الأمنية

يمنع builder المسارات المطلقة وpath traversal خارج root، ويرفض imports من `fs` و`child_process` و`net` قبل التنفيذ، ويعلن native-only imports على أنها تحذيرات تحتاج native transport. لا يشغل package scripts أو postinstall. يقرأ `FilesystemProjectScanner` الملفات تحت root المقيد فقط، ويتجاهل symlinks والمجلدات المولدة، ويطبق حدًا لعدد الملفات وحجم النص قبل تمرير file map إلى builder.

## دورة التحديث

تملك كل حزمة `sourceHash`. عند `fast refresh` يعاد حساب bundle ويُسجل `refresh_started` ثم `refresh_completed` مع hash جديد، بينما `reload` يعلن مسارًا منفصلًا. هذه الشريحة لا تدعي HMR حقيقيًا من Metro، لكنها تثبت bounded runtime contract الذي يمكن لــ Metro adapter استبداله لاحقًا.

## دليل الاختبار

أصبح مجموع الاختبارات `17/17` ناجحًا: Foundation، controller، typed IPC، mobile detection، preview adapter، bundle builder، fixture runtime، blocked imports، filesystem scanner، وProjectPreviewService. يشمل الاختبار الجديد قراءة manifest وentry من fixture فعلي، منع path traversal، اختيار entry، وحساب bundle من root. كما يثبت المسار الكامل أن فتح المشروع لا ينفذ package scripts أو postinstall.

## الخطوة التالية

الخطوة التالية هي بناء Presentation renderer فعلي داخل Embedded Workspace يستهلك `PreviewRenderNode` ويعرضه داخل لوحة المحاكي. يبقى React Native Web/Metro adapter خلف نفس `PreviewRuntime` contract، ولا يبدأ تشغيل native toolchain من renderer. بعد renderer يمكن إضافة IPC لفتح مشروع filesystem من واجهة Workspace بدل تمرير bundle يدويًا.

إعداد: Manus AI. تاريخ التحديث: 2026-08-22.
