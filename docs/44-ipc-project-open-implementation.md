# تنفيذ IPC لفتح مشروع الهاتف — الشريحة الرابعة

## النتيجة

أضيفت رسالة typed IPC باسم `preview.openProject` لفتح مشروع هاتف من filesystem عبر واجهة موحدة. يستقبل handler `projectId` و`rootPath` و`deviceProfileId` واختياريًا `entry` و`mode`، ثم يستدعي `ProjectPreviewService` لبناء bundle، ويمرر bundle إلى `EmbeddedSimulatorController.start` لبدء جلسة المعاينة المدمجة.

## مسار البيانات

| المرحلة | المكوّن | الناتج |
|---|---|---|
| 1 | `preview.openProject` request | payload typed داخل protocol v1 |
| 2 | `FilesystemProjectPreviewService` | manifest/entry/files إلى `ProjectPreviewBundle` |
| 3 | `EmbeddedSimulatorController.start` | session بحالة `ready` مع runtime وbundle |
| 4 | response | session metadata وprojectId/entry/sourceHash/moduleCount/warningCount |
| 5 | `preview.inspect` | render tree وdiagnostics وevents المرتبطة بالجلسة |

## الحدود الأمنية

لا يشغّل handler scripts أو `postinstall` أو native toolchain. يظل filesystem access خلف `FilesystemProjectScanner` الذي يفرض root boundaries ويتجاهل symlinks ويطبق limits. ويظل entry خاضعًا لتطبيع builder، لذلك تُرفض entries التي تتجاوز الجذر قبل إنشاء الجلسة. لا يُرسل source map الكامل في response؛ يعاد فقط summary محدود للحزمة.

## حقن الاعتماديات

يُنشئ `createEmbeddedApplication` `FilesystemProjectScanner` و`FilesystemProjectPreviewService` ويمررهما إلى handlers في composition root. لا يعرف `EmbeddedSimulatorController` filesystem أو root paths؛ يستقبل `ProjectPreviewBundle` فقط، وبذلك يبقى الفصل بين Application وMobile runtime محفوظًا.

## دليل التحقق

نجحت اختبارات IPC الخاصة بفتح مشروع فعلي من `fixtures/mobile-expo`، وفحص session وbundle summary وinspect، كما نجح اختبار رفض `../package.json` عبر IPC. آخر تشغيل لـ `pnpm check` أعطى `21/21` اختبارًا ناجحًا.

## الحدود الحالية

هذه الشريحة لا تضيف Electron preload production boundary أو dialog لاختيار مجلد أو persistence أو React Native Web/Metro runtime. واجهة Workspace الحالية ما تزال prototype، ويمكن للواجهة المستقبلية استدعاء نفس method بعد إضافة preload typed adapter. لا تزال المعاينة compatibility/fixture mode ولا تدعي native fidelity.

## الخطوة التالية

الخطوة التالية هي typed Electron preload boundary أو، قبلها عند الحاجة، adapter واجهة Workspace يطلب root path من المستخدم ويعرض نتيجة `preview.openProject` دون تمرير Node APIs مباشرة إلى renderer. يجب أن تسبق ذلك contract tests وCSP/sandbox policy.

إعداد: Manus AI. تاريخ التحديث: 2026-08-22.
