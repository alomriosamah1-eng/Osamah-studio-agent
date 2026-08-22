# تنفيذ Presentation Renderer — الشريحة الثالثة

## النتيجة

أصبح `PreviewRenderNode` قابلًا للعرض داخل Presentation layer بدل إبقاء لوحة الهاتف معتمدة على markup ثابت. يحوّل renderer شجرة العرض التوافقية إلى HTML محدود الدلالات، ثم يركّب الناتج في target يملكه embedded simulator داخل Workspace.

## التصميم

| المكوّن | الملف | المسؤولية |
|---|---|---|
| Renderer contract | `src/presentation/preview-renderer.ts` | تحويل `view/text/card/status` إلى `section/span/article/output` |
| Safe props | `src/presentation/preview-renderer.ts` | ترتيب deterministic، أسماء attributes آمنة، وescaping للنص والقيم |
| Depth guard | `src/presentation/preview-renderer.ts` | رفض شجرة تتجاوز 32 مستوى لمنع recursion غير المنضبط |
| Browser adapter | `prototypes/studio/preview-renderer.js` | توفير نفس السلوك داخل prototype دون اعتماد على framework خارجي |
| Workspace integration | `prototypes/studio/index.html` | تركيب tree داخل `#previewTree` وربطه بتغيير الملف وRun وFast Refresh |
| Contract tests | `src/preview-renderer.test.ts` | semantic mapping، escaping، deterministic props، وdepth guard |

## دورة العرض

ينشئ Workspace snapshot محدودًا من `PreviewRenderNode`، ثم يستدعي `renderPreviewTree(root, target)`. لا يقرأ renderer ملفات المشروع ولا يشغّل JavaScript القادم من المشروع ولا يفسّر JSX؛ هذه المسؤوليات تبقى خلف bundle/runtime boundaries. عند تغيير الملف أو تنفيذ Fast Refresh يعاد تركيب tree في نفس target، مع إبقاء device frame وInspector وConsole داخل اللوحة نفسها.

## الحدود الأمنية

يُعامل النص والـ props كبيانات ويُجرى لهما HTML escaping قبل إدخالهما في markup. تُحوّل أسماء الخصائص إلى أسماء `data-preview-prop-*` آمنة، ولا تُمرر كـ event handlers أو HTML خام. يرفض renderer الأشجار العميقة جدًا. هذا لا يغني عن sandbox حقيقي أو CSP في Electron production shell، ولا يسمح بتشغيل native modules أو project scripts.

## دليل التحقق

نجح `pnpm check` مع `19/19` اختبارًا، ونجح `node --check prototypes/studio/preview-renderer.js`، ونجح secret scan و`git diff --check`. التحقق البصري في `research/presentation-renderer-visual-check.txt` أثبت ظهور tree داخل إطار الهاتف، وتغيير الملف إلى `settings.tsx`، وتغيير orientation، وتنفيذ Fast Refresh مع بقاء labels الخاصة بـ `embedded_web` و`compatibility` واضحة.

## ما لا تدعيه الشريحة

هذه الشريحة تنفذ Presentation renderer bounded لشجرة عرض توافقية. لا تدعي React Native native fidelity، ولا Metro HMR حقيقيًا، ولا Android Emulator أو iOS Simulator. transports الأصلية المستقبلية ستغذي نفس اللوحة خلف عقود مستقلة.

## الخطوة التالية

بعد تثبيت renderer، يمكن إضافة IPC لفتح مشروع filesystem من واجهة Workspace وإرسال bundle إلى controller بدل تمريره يدويًا. يلي ذلك React Native Web/Metro adapter خلف `PreviewRuntime` contract، ثم Electron preload production boundary وSQLite adapter.

إعداد: Manus AI. تاريخ التحديث: 2026-08-22.
