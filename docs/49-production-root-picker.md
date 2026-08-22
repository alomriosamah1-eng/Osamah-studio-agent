# Production Root Picker

**الحالة:** منفذ ومدفوع ومتحقق منه عند `197424dc6cbc1f02b92011903f5bbce77e819f6c`.

**النطاق:** اختيار مجلد مشروع محلي من خلال Electron main process، مع typed preload، canonical path validation، وعدم تشغيل المشروع أو أي script تلقائيًا.

## القرار

يستخدم Workspace دالة `window.osamah.chooseProjectRoot()` بدل كشف `ipcRenderer` أو أي Node API إلى renderer. ينفذ Electron `dialog.showOpenDialog` في main process بخاصية `openDirectory` فقط، ثم يمرر النتيجة إلى validator مستقل يتحقق من وجود المسار وكونه directory ويعيد canonical path عبر `realpath`. يطابق ذلك نموذج Electron الرسمي الذي يعيد من `showOpenDialog` كائنًا يحتوي `canceled` و`filePaths`، ويسمح بخيار `openDirectory` لاختيار المجلدات [1].

> **قاعدة الأمان:** اختيار root لا يعني منح renderer صلاحية filesystem مفتوحة، ولا يعني تشغيل المشروع. يستخدم المسار لاحقًا فقط عبر application services المقيّدة بالـ root والسياسات والـ resource budgets.

## المسار التنفيذي

| المرحلة | التنفيذ |
|---|---|
| Renderer | زر `Open Project` يستدعي wrapper typed، ويعرض cancel أو error أو اسم المجلد فقط في حالة النجاح |
| Preload | `contextBridge.exposeInMainWorld` يعرّض `dispatch` و`chooseProjectRoot` فقط؛ لا يعرّض `ipcRenderer` كاملًا |
| Main | قناة allowlisted باسم `osamah:choose-project-root`، مع trusted sender وworkspace URL validation |
| Dialog | `dialog.showOpenDialog(ownerWindow, { properties: ["openDirectory"] })` في main process |
| Validation | رفض القيمة الفارغة وNUL، `realpath`، ثم `stat` و`isDirectory`، وتحويل الفشل إلى typed result بدل exception للـ renderer |
| بعد الاختيار | لا يتم تشغيل scripts أو Metro أو Expo أو native toolchains؛ يعرض Workspace root selected فقط، وتأتي عملية open/preview في خطوة typed مستقلة |

## عقد النتيجة

يعيد `RootPickerResult` واحدًا من ثلاثة أشكال: `{ canceled: true }` عند إغلاق dialog، أو `{ canceled: false, rootPath }` عند نجاح canonicalization، أو `{ canceled: false, error, message }` عند عدم وجود اختيار أو عدم صلاحية المسار. هذا يمنع تسريب stack traces أو أخطاء filesystem الخام إلى واجهة المستخدم، ويجعل حالة الإلغاء مختلفة عن الفشل.

تتحقق القناة من هوية sender ورابط frame قبل فتح dialog. كما أن dialog مرتبط بـ`BrowserWindow` المالكة حتى يبقى جزءًا من دورة النافذة بدل إنشاء سطح مستقل غير مرتبط. توصي وثائق Electron بتمرير نافذة مالكة عند الحاجة إلى جعل dialog modal ومربوطًا بالنافذة الأب [1]. ويستخدم preload wrapper صغيرًا بدل تمرير `ipcRenderer` الكامل، وهو النمط الذي توضحه وثائق `contextBridge` لتجنب منح renderer قناة إرسال عامة [2].

## الأداء على Ubuntu RAM 8GB

عملية اختيار المجلد لا تبدأ scan أو preview أو agent job. بعد أن يختار المستخدم root، تبقى عملية فتح المشروع خاضعة لـ`ResourcePolicy`: جلسة preview واحدة، source/modules/assets budgets، وlatest-only refresh. لا يضيف root picker workerًا دائمًا أو dependency native، ولا يبدأ local model أو native emulator عند الإقلاع.

## التحقق

| الاختبار | النتيجة |
|---|---|
| canonical directory selection | PASS؛ يعيد root path بعد `realpath` |
| cancellation | PASS؛ الإلغاء لا يتحول إلى failure |
| empty selection | PASS؛ `NO_DIRECTORY_SELECTED` |
| missing/non-directory path | PASS؛ `INVALID_ROOT` دون throw للـ renderer |
| trusted channel | PASS؛ sender وframe URL يمران عبر security predicate |
| desktop IPC smoke | PASS؛ `DESKTOP_ROOT_PICKER_SMOKE=PASS` و`DESKTOP_IPC_SMOKE=PASS` |
| suite | `47/47` اختبارًا ناجحًا بعد إضافة root-picker tests |

اختبار smoke يستخدم adapter deterministic لمسار fixture فقط، ولا يفتح dialog تفاعليًا أثناء CI أو الاختبار المحلي. أما المسار الإنتاجي فيستخدم native directory dialog عند استدعائه من Workspace.

## الحدود

لا تحفظ الشريحة root path في SQLite أو profile lifecycle بعد؛ ذلك جزء من wiring الإنتاجية التالية. ولا تفتح هذه الشريحة مشروعًا تلقائيًا بعد اختيار المجلد، لأن تحديد `projectId` وentry وpreview capability يحتاج contract منفصلًا. كذلك لا تحاول الشريحة حل symlink policy أو workspace trust policy الكاملة؛ `realpath` وdirectory validation هما boundary أولى، بينما policy/permissions وterminal sandbox تأتي لاحقًا.

لا تعني نتيجة الاختبارات أن أي مشروع كبير يمكن قراءته بلا حدود. بعد root selection يجب أن يستمر scanner وpreview service في فرض budgets ورفض الملفات أو bundles التي تتجاوز low-memory profile.

## الملفات

الملفات الأساسية هي `src/desktop/root-picker.ts`، و`src/desktop/preload-api.ts`، و`src/desktop/preload.cjs`، و`src/desktop/main.ts`، و`src/desktop/security.ts`، و`src/root-picker.test.ts`، و`prototypes/studio/index.html`، و`prototypes/studio/workspace.js`، و`scripts/desktop-smoke.mjs`.

## المراجع

[1]: https://www.electronjs.org/docs/latest/api/dialog "Electron dialog API"

[2]: https://www.electronjs.org/docs/latest/api/context-bridge "Electron contextBridge API"
