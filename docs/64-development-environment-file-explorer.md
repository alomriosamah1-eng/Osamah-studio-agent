# Development Environment: Project Explorer وBounded File Reader

**الحالة:** منفذة ومدفوعة ومتحقق منها ضمن الشريحة الحالية.

## الغرض والنطاق

تبدأ هذه الشريحة إكمال **Intelligent Software Development Environment** فوق الأساس الموجود في Osamah Studio Agent. النطاق محدود عمدًا إلى عرض بنية المشروع وفتح ملف نصي للقراءة داخل Workspace. لا تضيف الشريحة terminal أو Git write أو Monaco أو React Native Web/Metro runtime، ولا تغيّر قرار إبقاء Lightweight Web Preview إلى آخر مراحل تصميم البيئة.

الهدف هو استبدال شجرة الملفات الثابتة في prototype ببيانات مشروع حقيقية، مع إبقاء العملية محلية ومحدودة الذاكرة. كل قراءة تمر عبر root اختاره المستخدم، ومسار نسبي canonical، وحد أقصى للحجم، وفحص نوع الملف والروابط الرمزية. لا تمنح هذه الشريحة renderer صلاحية filesystem ولا صلاحية الكتابة.

## الوضع القائم وإعادة الاستخدام

يوجد `FilesystemProjectScanner` و`ProjectScanner` داخل Application/Infrastructure، ويقدمان listing للملفات وقراءة نصية وJSON مع تجاهل `.git` و`node_modules` و`.expo` و`dist` و`build` و`coverage`. كما يوجد `FilesystemProjectContextIndex` لكنه مخصص لبناء context للوكيل، وليس عقد UI؛ لذلك لا يُستخدم مباشرة في renderer ولا يُحمّل إلى واجهة المستخدم كاملًا.

| الموجود | يعاد استخدامه | لا يُعاد استخدامه مباشرة في UI |
|---|---|---|
| `ProjectScanner.listRelativeFiles` | الحصول على قائمة files bounded من root | لا يعبر raw scanner عبر IPC |
| `FilesystemProjectScanner` | canonical root، ignored directories، limits، text/JSON read | لا يسمح له بكتابة الملفات |
| `ProjectContextSnapshot` | لاستخدام agent context لاحقًا | ليس schema لعرض شجرة Workspace |
| `ResourcePolicy` | مصدر الحدود الخاصة بالذاكرة والحجم | لا يسمح للrenderer بتعديل الحدود |
| `preview.openProject` وroot picker | اختيار root والتحقق الأولي | لا يفتح مشروعًا أو يشغل scripts تلقائيًا |

## العقود المقترحة

يضاف في Application port مستقل، مع إبقاء `ProjectScanner` قائمًا لمسار agent context:

```ts
export interface ProjectTreeNode {
  readonly name: string;
  readonly relativePath: string;
  readonly kind: "directory" | "file";
  readonly extension?: string;
  readonly children?: readonly ProjectTreeNode[];
}

export interface ProjectExplorerPort {
  list(rootPath: string): Promise<ProjectTreeNode>;
}

export interface WorkspaceFileContent {
  readonly relativePath: string;
  readonly content: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly truncated: boolean;
}

export interface WorkspaceFileReaderPort {
  readText(rootPath: string, relativePath: string): Promise<WorkspaceFileContent | undefined>;
}
```

تظل هذه العقود في Application ولا تعتمد على Electron أو Node APIs. يعيد `ProjectExplorerPort` شجرة مرتبة deterministic من قائمة الملفات bounded. لا تُنشأ عقد directories غير اللازمة من filesystem traversal منفصل؛ بل تُبنى من paths التي يسمح بها scanner، وبذلك تظل حدود عدد الملفات والذاكرة موحدة.

## حدود البيانات والسياسة

يستخدم التنفيذ حدود `ResourcePolicy` الحالية: أقصى عدد ملفات منخفض الذاكرة، وأقصى حجم للملف النصي، وحد أقصى لاستجابة IPC. لا يرسل `package.json` أو `.env` أو ملفات credentials إلى renderer تلقائيًا؛ إذا اختار المستخدم ملفًا نصيًا فستطبق السياسة نفسها، وتبقى إخفاءات الأسرار والـlogs قائمة. لا يحتوي رد `project.tree` على محتوى الملفات، ولا يحتوي `file.openText` على absolute root أو بيانات خارج الملف المطلوب.

| الحالة | النتيجة |
|---|---|
| root غير موجود أو ليس directory | `INVALID_REQUEST` أو domain error bounded، دون استثناء مكشوف للrenderer |
| relative path فارغ أو traversal أو absolute | رفض fail-closed |
| path يشير إلى symlink | رفض القراءة وعدم اتباع الرابط |
| ملف binary أو أكبر من الحد | `undefined` أو نتيجة bounded واضحة، دون تحميله إلى الذاكرة |
| directory أو ignored path | لا يظهر في tree أو لا يُفتح كنص |
| tree يتجاوز حد الملفات | tree bounded مع warning، دون تجميد UI |
| request غير مطابق | رفضه قبل Application handler عبر typed validator |

## IPC وPreload

تضاف قناتان إلى `IpcMethodMap` الحالية:

| method | payload | result | الصلاحية |
|---|---|---|---|
| `project.tree` | `{ rootPath: string }` | `ProjectTreeNode` مع `truncated` و`warnings` | قراءة metadata فقط |
| `file.openText` | `{ rootPath: string; relativePath: string }` | `WorkspaceFileContent` | قراءة ملف واحد bounded |

تستمر القناة الفيزيائية `osamah:dispatch` مع protocol v1 وduplicate protection وsender validation وCSP. لا يضاف `readFile` إلى preload ولا تُمرر `ipcRenderer` خامًا. يضيف preload فقط dispatch typed الموجود أصلًا، وتبقى معرفة methods في Application/IPC contracts.

## ترتيب التنفيذ الإلزامي

ينفذ المسار بالتتابع الآتي: architecture decision وports، ثم contract tests للـtree والـreader، ثم in-memory adapter deterministic، ثم `FilesystemProjectExplorer` و`FilesystemWorkspaceFileReader` بحدود root/path/size/symlink، ثم typed IPC handlers وvalidators، ثم Workspace tree renderer وفتح الملف باستخدام `textContent`، ثم Electron smoke وperformance/security gates، ثم التوثيق وcommit/push والتحقق من SHA.

لا تدخل Monaco في هذه الشريحة؛ يستخدم المحرر الحالي لعرض النص escaped حتى تثبت عقود القراءة والحدود. يمكن استبدال العرض لاحقًا بمحرر حقيقي خلف نفس `file.openText` contract. ولا يدخل xterm.js أو terminal worker قبل شريحة مستقلة للعزل والسياسات والـoutput caps.

## معايير القبول

تنجح الشريحة عندما يختار المستخدم root محليًا، فيظهر tree حقيقي bounded بدل القائمة الثابتة، وعند اختيار ملف نصي يظهر محتواه دون HTML injection أو كشف absolute path غير لازم. تفشل traversal وsymlink والملفات الكبيرة وpayloads غير الصحيحة fail-closed. يظل التطبيق بلا scripts أو native toolchains أو network calls عند startup، ويمر `pnpm check` و`pnpm build` و`pnpm desktop:smoke` و`pnpm performance:smoke` وmigration/JSON/diff/secret scans.

## التنفيذ والتحقق

نفذ التطبيق `ProjectExplorerPort` و`WorkspaceFileReaderPort` في Application، ثم `FilesystemProjectExplorer` و`FilesystemWorkspaceFileReader` في Infrastructure. أضيفت قناتا `project.tree` و`file.openText` إلى typed IPC، وربطتا بـcomposition وElectron main bridge. أصبحت Workspace تستبدل الشجرة الثابتة بشجرة حقيقية عند اختيار root، وتفتح النص عبر `file.openText` وتعرضه باستخدام DOM nodes و`textContent` دون HTML injection. بقي fallback البصري متاحًا عند تشغيل prototype خارج Electron.

| الفحص | النتيجة |
|---|---|
| `pnpm check` | `111/111` اختبارًا ناجحًا |
| Project Explorer/File Reader | ordering deterministic، ignored directories، truncation، hash، UTF-8 bounds، binary/size guards، traversal/symlink/secret-name guards: PASS |
| typed IPC | `project.tree` و`file.openText` validators وhandlers وpath errors: PASS |
| Workspace/Electron | dynamic tree وsafe file rendering وdesktop smoke لـtree/file open/root picker/Human Gate: PASS |
| Performance/security | low-memory profile، `PERF_SMOKE=PASS`، migration/JSON/diff/secret scans: PASS |

لا تزال الشريحة bounded؛ لا تدعي توفير Monaco أو LSP أو terminal أو Git write أو test runner. commit التنفيذ والتوثيق يثبتان بعد إغلاق GitHub verification.

## الحدود المفتوحة

لا تثبت هذه الشريحة دعم Monaco أو LSP أو terminal أو Git operations أو test runner أو Metro. ستأتي تلك الوحدات عبر ports وworkers مستقلة. كما لا يجوز اعتبار عرض شجرة الملفات أو نص الملف دليلًا على اكتمال Development Environment أو Desktop MVP؛ ذلك يتطلب لاحقًا دورة التعديل والـdiff والاختبار والتراجع، مع بقاء Lightweight Web Preview في نهاية تصميم البيئة.
