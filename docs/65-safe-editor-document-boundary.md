# Safe Editor Document Boundary وDiff Preview

**الحالة:** منفذة محليًا، وfull gate ناجح، وقيد commit/push.

## الغرض والنطاق

تضيف هذه الشريحة طبقة محرر آمنة فوق `ProjectExplorer` و`WorkspaceFileReader` دون تحويل واجهة Workspace إلى قناة كتابة مباشرة. النتيجة الأولى هي فتح document نصي داخل buffer محلي، وتعديل محتوى الذاكرة، وإنتاج diff bounded قابل للمراجعة. لا تنفذ هذه الشريحة `writeFile` أو `apply` ولا تستبدل الـHuman Gate الموجود؛ أي تطبيق فعلي سيستخدم لاحقًا `PatchProposal` و`FilesystemPatchAdapter` من دورة WorkCycle بعد approval مطابق.

اختيار محرر نصي خفيف بدل إدخال Monaco الآن مقصود لحماية زمن الإقلاع وذاكرة أجهزة Ubuntu ذات RAM 8GB. يمكن إضافة Monaco أو LSP لاحقًا كـadapter خلف نفس عقود document، بعد benchmark وقياس bundle/RSS، دون تغيير سياسة الملفات أو Human Gate.

## إعادة الاستخدام والحدود

يعتمد المحرر على `WorkspaceFileReaderPort` لفتح الملف والتحقق من root/path/size/symlink/secret policy، وعلى `FilesystemPatchAdapter` كمرجع لعقد `expectedSha256`، وعلى `PatchProposal` عند الانتقال مستقبلًا من diff إلى mutation. لا يعيد المحرر قراءة filesystem في كل ضغطة مفتاح؛ يحتفظ بنسخة bounded في الذاكرة ويعيد حساب hash/diff فقط عند طلب proposal أو debounce محدود.

| المكوّن | دوره في هذه الشريحة | ما لا يفعله |
|---|---|---|
| `WorkspaceFileReaderPort` | فتح snapshot نصي bounded | لا يعرض absolute root ولا يكتب |
| `EditorDocumentPort` | إدارة document snapshot وbuffer وproposal | لا يتجاوز Human Gate ولا ينفذ patch |
| `InMemoryEditorDocumentStore` | حفظ نسخة واحدة/عدد bounded من documents في الذاكرة | لا يصبح مصدر حقيقة دائمًا |
| `DiffEngine` | حساب diff نصي deterministic محدود بالأسطر والبايتات | لا يفسر الكود ولا يشغل formatter أو compiler |
| `FilesystemPatchAdapter` | مسار لاحق للتحقق والتطبيق بعد approval | لا يُستدعى من renderer مباشرة |
| Monaco/LSP | خيار لاحق لتحسين UX/code intelligence | ليست dependency لهذه الشريحة |

## عقود Application

يقترح تثبيت العقود التالية في Application دون اعتماد على Electron أو DOM:

```ts
export interface DocumentSnapshot {
  readonly relativePath: string;
  readonly content: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly revision: number;
}

export interface EditProposal {
  readonly proposalId: string;
  readonly relativePath: string;
  readonly expectedSha256: string;
  readonly nextSha256: string;
  readonly before: string;
  readonly after: string;
  readonly diff: readonly DiffLine[];
  readonly bytes: number;
}

export interface EditorDocumentPort {
  open(rootPath: string, relativePath: string): Promise<DocumentSnapshot | undefined>;
  propose(rootPath: string, relativePath: string, content: string, expectedSha256: string): Promise<EditProposal>;
}
```

`expectedSha256` هو hash النسخة التي فتحها المستخدم، وليس إشارة ثقة من renderer. عند إنشاء proposal يعاد فتح المصدر عبر reader أو adapter آمن ومقارنته بالـhash المتوقع؛ إذا تغير الملف يرفض proposal كـconflict بدل استبداله. لا تُرسل عقود editor محتوى secret محجوبًا إلى provider، ولا تعرض `rootPath` في UI.

## Diff bounded

يقبل الـbuffer النصوص حتى `ResourcePolicy.limits.maxTextFileBytes`، ويحد عدد الأسطر والـdiff lines الناتجة، ويعامل المحتوى الذي يحوي NUL أو binary كغير قابل للتحرير. تحفظ diff lines على شكل `equal` أو `add` أو `remove` مع أرقام أسطر bounded. عند تجاوز حد output لا يُنتج diff ناقصًا يوحي باكتماله؛ يعيد العقد `truncated: true` أو خطأ bounded واضح، بحسب القرار التنفيذي في الاختبارات.

| الخطر | الحماية |
|---|---|
| stale file بعد فتحه | `expectedSha256` وre-read قبل proposal |
| path traversal أو symlink | إعادة استخدام reader canonical/path guards |
| محتوى ضخم | max bytes وmax lines وoutput cap |
| XSS في diff أو code | renderer يستخدم `textContent` وDOM nodes، لا `innerHTML` |
| mutation غير مقصودة | لا توجد `save` أو `apply` في هذا العقد |
| تسريب أسرار | secret-name/binary guards، وعدم إرسال buffer إلى provider تلقائيًا |
| استهلاك ذاكرة متزايد | document count واحد في low-memory profile وeviction صريح لاحقًا |

## IPC وواجهة Workspace

تأتي قنوات IPC في الشريحة التالية أو ضمن التنفيذ نفسه بعد تثبيت العقود:

| method | payload | result |
|---|---|---|
| `editor.open` | `{ rootPath: string; relativePath: string }` | `DocumentSnapshot | undefined` |
| `editor.propose` | `{ rootPath: string; relativePath: string; content: string; expectedSha256: string }` | `EditProposal` |

لا تضاف `editor.save` في هذه المرحلة. إذا احتاج المستخدم تطبيق تعديل، ينشئ النظام `PatchProposal` منفصلًا ويضعه في Human Gate مع scope وexpected hash وdiff وسبب واضح. لا يسمح editor IPC بتغيير provider policy أو approval state أو root path.

## ترتيب التنفيذ

ينفذ المسار بالتتابع: architecture decision وports، ثم contract tests للـsnapshot/hash/stale conflict/diff bounds، ثم in-memory editor store، ثم bounded implementation فوق `WorkspaceFileReaderPort`، ثم typed IPC validators وhandlers، ثم Workspace editor buffer وdiff panel باستخدام DOM text nodes، ثم Electron smoke، ثم full gate والتوثيق والدفع. لا تشغل Monaco أو LSP أو terminal أو formatter أو test scripts تلقائيًا.

## معايير القبول

تنجح الشريحة عندما يفتح المستخدم ملفًا نصيًا من tree، ويعدل نسخة الذاكرة دون تغيير الملف على القرص، ويطلب diff deterministic يعرض before/after وexpected/new hashes. يرفض النظام stale hash وpath traversal وsymlink وbinary والملف الكبير والـpayload غير الصحيح fail-closed. يظل Human Gate هو الحد الفاصل قبل أي mutation، ولا يحدث network أو model loading عند startup، ولا تزيد هذه الشريحة اعتماديات native أو toolchains.

## التنفيذ والتحقق

نفذ التطبيق `EditorDocumentPort` و`DocumentSnapshot` و`EditProposal` و`DiffLine` في Application، ثم `InMemoryEditorDocumentStore` فوق `FilesystemWorkspaceFileReader`. أضيفت قناتا `editor.open` و`editor.propose` إلى typed IPC، وربطتا بالـcomposition والـElectron smoke. أصبحت Workspace تعرض buffer نصيًا خفيفًا، وتسمح بتعديل الذاكرة فقط، ثم تعرض diff proposal آمنًا عبر DOM text nodes. لا توجد `editor.save` أو `apply` في هذه الشريحة، ولذلك لم يحدث mutation للـfilesystem.

| الفحص | النتيجة |
|---|---|
| `pnpm check` | `117/117` اختبارًا ناجحًا |
| Editor contracts | deterministic diff، line metadata، diff cap، snapshot/hash، revision، stale conflict، NUL/size/path guards: PASS |
| Filesystem safety | الملف الأصلي لا يتغير عند proposal؛ reader guards للـtraversal وsymlink وbinary وsecret names ما زالت فعالة: PASS |
| typed IPC | `editor.open` و`editor.propose` validators وhandlers وno-mutation integration: PASS |
| Electron/Workspace | editor buffer وPropose diff وHuman Gate boundary وdesktop smoke: PASS |
| Performance/security | low-memory profile، `PERF_SMOKE=PASS`، migration/JSON/diff/secret scans: PASS |

لا تزال الشريحة bounded؛ لا تدعي توفير Monaco أو LSP أو terminal أو Git write أو test runner. commit التنفيذ والتوثيق يثبتان بعد إغلاق GitHub verification.

## الحدود المفتوحة

لا تثبت هذه الشريحة اكتمال IDE أو دعم LSP أو language services أو terminal أو Git أو test runner أو preview parity. هذه قدرات مستقلة تأتي عبر workers وports وresource budgets. ويبقى Lightweight Web Preview/React Native Web/Metro في آخر مراحل تصميم البيئة وفق قرار المشروع.
