# Git Read-only Integration وRepository Boundary

**الحالة:** منفذة محليًا، وfull gate ناجح، وقيد commit/push.

## الغرض والنطاق

تضيف هذه الشريحة قراءة حالة مستودع Git وعرض diff فقط داخل Development Environment. لا تنفذ `commit` أو `push` أو `reset` أو `checkout` أو أي mutation، ولا تعرّض renderer إلى `child_process` أو shell. الهدف هو أن يرى المستخدم branch والحالة والتغييرات الحالية مع حدود ثابتة، ثم تُستخدم هذه البيانات لاحقًا في Project Context وWorkCycle دون أن تصبح إذنًا للكتابة.

يوجد في المشروع `GitStatusPort` و`GitStatusAdapter` يقرآن `git status --porcelain=v1 --branch --untracked-files=normal` عبر `execFile` بوسائط منفصلة وtimeout وmaxBuffer. ستبقى هذه القراءة متوافقة، وتضاف عقود مستقلة لـGit status وdiff حتى لا تختلط حالة repository مع filesystem scanner أو Terminal Policy.

## عقود Application

```ts
export interface GitStatusSnapshot {
  readonly isRepository: boolean;
  readonly branch?: string;
  readonly upstream?: string;
  readonly ahead: number;
  readonly behind: number;
  readonly staged: readonly GitChange[];
  readonly unstaged: readonly GitChange[];
  readonly untracked: readonly string[];
  readonly conflicted: readonly string[];
  readonly rawUnavailable?: boolean;
}

export interface GitChange {
  readonly path: string;
  readonly status: string;
  readonly staged: boolean;
}

export interface GitDiffResult {
  readonly relativePath?: string;
  readonly patch: string;
  readonly bytes: number;
  readonly truncated: boolean;
  readonly rawUnavailable?: boolean;
}

export interface GitReadOnlyPort {
  status(rootPath: string): Promise<GitStatusSnapshot>;
  diff(rootPath: string, relativePath?: string): Promise<GitDiffResult>;
}
```

ينبغي الحفاظ على `GitStatusPort` القديم حتى لا يتغير `ProjectContextSnapshot` في هذه الشريحة. يمكن أن يعيد adapter الجديد summary المتوافق منه، أو يشاركه parser داخليًا. لا تعرض العقود raw absolute path أو environment أو stderr كاملًا؛ الرسائل الموجهة للمستخدم تكون bounded ومصنفة.

## الأوامر المسموحة للقراءة فقط

يستعمل adapter `execFile("git", argv, options)` فقط، مع `shell: false` صراحة إذا احتاجت بيئة التشغيل ذلك. لا يُبنى command string ولا تُمرر `git -c` أو alias أو config من renderer. الأوامر المسموحة هي:

| الغرض | argv المقترح | النتيجة |
|---|---|---|
| الحالة | `-C`, canonicalRoot, `status`, `--porcelain=v1`, `--branch`, `--untracked-files=normal` | branch/counts/changes |
| diff الكلي | `-C`, canonicalRoot, `diff`, `--no-ext-diff`, `--no-color`, `--no-renames` | patch bounded |
| diff ملف | نفس السابق مع `--`, relativePath | patch bounded لملف واحد |
| repository check | `-C`, canonicalRoot, `rev-parse`, `--is-inside-work-tree` | boolean داخلي لا يعرض raw output |

لا يسمح بـ`git diff --ext-diff` أو pager أو external diff driver، ولا تُقرأ config أو hooks على أنها تعليمات للتطبيق. إذا فشل Git أو لم يكن root repository تعاد نتيجة `isRepository: false` أو `rawUnavailable: true` دون رمي خطأ يوقف Workspace.

## حدود root/path/output

يُcanonicalize root في main/infrastructure، ويُرفض root غير الموجود أو غير directory أو symlink غير المسموح قبل `execFile`. المسار الاختياري للملف relative فقط، بلا `/` في البداية أو `\` أو `..` أو null byte. يمرر adapter `--` قبل path لمنع تفسير اسم الملف كخيار Git.

| الحد | low-memory policy | السلوك عند التجاوز |
|---|---:|---|
| timeout لكل Git read | 1.5 ثانية افتراضيًا، 10 ثوانٍ حد أعلى | نتيجة unavailable bounded |
| status output | 256 KiB | truncation أو unavailable |
| diff output | 128 KiB | `truncated: true` مع patch جزئي معلّم |
| change entries | 256 | تقليم مع warning bounded |
| path | 512 byte | رفض fail-closed |
| concurrent reads | عملية قراءة واحدة لكل root | رفض/تجميع لاحقًا بدل عمليات متوازية |

لا يجب عرض patch جزئي كما لو كان كاملًا. `truncated` جزء إلزامي من النتيجة، وUI يوضح أن المراجعة غير مكتملة. لا تُرسل diff تلقائيًا إلى provider؛ تبقى user-selected context.

## التكامل مع Workspace وHuman Gate

تضيف الواجهة Git panel يعرض branch والحالة وstaged/unstaged/untracked/conflicted وdiff read-only. لا تحتوي اللوحة زر Commit أو Push في هذه الشريحة. إذا طلب المستخدم commit لاحقًا، يجب أن ينشئ النظام `AgentActionRequest` من نوع `git.commit` مع scope وdiff digest وHuman Gate مستقل، ولا يجوز اشتقاق approval من مجرد قراءة status.

تظل Git status وdiff بيانات غير موثوقة؛ أسماء الملفات وpatch content تعرض باستخدام `textContent` ولا تتحول إلى HTML أو تعليمات. لا يغير Git adapter `cwd` أو environment أو global config، ولا يشغل hooks. لا يختلط `git status` مع `TerminalPolicyPort` execution، بل يظل adapter read-only مخصصًا.

## typed IPC

| method | payload | result |
|---|---|---|
| `git.status` | `{ rootPath: string }` | `GitStatusSnapshot` |
| `git.diff` | `{ rootPath: string; relativePath?: string }` | `GitDiffResult` |

تتحقق IPC validators من root/path/optionals والحدود قبل handler. يتحقق main/infrastructure مرة أخرى من canonical root/path قبل `execFile`. لا يضاف `git.commit` أو `github.push` إلى renderer ضمن هذه الشريحة.

## معايير القبول

تنجح الشريحة عندما تعرض Workspace branch/status/diff لمستودع fixture، وتتعامل مع root غير repository وGit unavailable وtimeout وdiff كبير بنتيجة bounded واضحة. يرفض النظام traversal وabsolute path وshell syntax وpath starting option، ولا توجد mutations أو hooks أو pushes. تثبت tests أن ملفات fixture لا تتغير، وأن parser يميز staged/unstaged/untracked/conflicted، وأن diff output لا يتجاوز الحد ولا يعرض truncation كاكتمال.

## التنفيذ والتحقق

نفذ التطبيق `GitReadOnlyPort` و`FilesystemGitReadOnlyAdapter` لقراءة branch/status/diff عبر `execFile` بوسائط منفصلة و`shell: false`، مع canonical root وrelative path guards و`--` قبل المسار ورفض الخيارات والممرات الخطرة. أضيفت قناتا `git.status` و`git.diff` إلى typed IPC وcomposition، وربطت Workspace بلوحة Git read-only تعرض الحالة وdiff باستخدام `textContent` فقط. لا توجد في هذه الشريحة قنوات commit أو push أو reset أو checkout.

| الفحص | النتيجة |
|---|---|
| `pnpm check` | `130/130` اختبارًا ناجحًا |
| Git adapter contracts | branch/status parsing، staged/unstaged/untracked، bounded diff، truncation، non-repository fallback، no-mutation وpath guards: PASS |
| typed IPC | `git.status` و`git.diff` validators وhandlers وtraversal/option rejection: PASS |
| Workspace/Electron | Git panel وrefresh/status/diff read-only وdesktop smoke دون commit أو push: PASS |
| Performance/security | low-memory profile، `PERF_SMOKE=PASS`، migration/JSON/diff/secret scans: PASS |

لا يستخدم adapter shell أو hooks أو external diff، ولا توجد network calls أو model loading أو Git mutation عند startup أو أثناء القراءة. التنفيذ والتوثيق قيد commit/push قبل تثبيت SHA النهائي.

## الحدود المفتوحة

لا تثبت هذه الشريحة commit أو push أو GitHub authentication أو merge/rebase أو worktree management أو external diff tools. لا يوجد بعد terminal worker فعلي. تأتي mutations عبر approval وdedicated adapter لاحقًا، ويبقى Lightweight Web Preview وReact Native Web/Metro مؤجلين إلى آخر مراحل تصميم البيئة.
