# Terminal Policy Preview وCommand Boundary

**الحالة:** منفذة محليًا، وfull gate ناجح، وقيد commit/push.

## الغرض والنطاق

تضيف هذه الشريحة حدًا آمنًا بين Workspace وأي terminal worker مستقبلي. لا تنفذ أوامر، ولا تنشئ child process، ولا تستدعي shell أو scripts أو toolchain في هذه المرحلة. وظيفتها الوحيدة هي تحليل طلب command وإعادة قرار bounded قابل للعرض: مرفوض، أو يحتاج موافقة صريحة، مع سبب ونطاق وقيود الموارد.

هذا الفصل ضروري لأن وجود `terminal.exec` في `AgentActionKind` لا يعني أن التنفيذ متاح. يبقى `default deny` هو السلوك الافتراضي، وتظل أوامر الهاتف وpackage scripts وnative toolchains محظورة تلقائيًا وفق قاعدة المشروع. أي انتقال لاحق من policy preview إلى execution يحتاج Terminal Worker مستقلًا، وHuman Gate، وaudit، وcancellation، وقياس RAM/CPU.

## العقود المقترحة في Application

لا يُمرر إلى policy نص shell خام قابل لإعادة التفسير. يستخدم الطلب executable وargv منفصلين، ويكون `cwd` مسارًا نسبيًا إلى root يختاره المستخدم. لا يقبل العقد environment عشوائيًا أو stdin أو redirection أو pipeline في هذه الشريحة.

```ts
export type TerminalCommandClass = "read_only" | "mutating" | "toolchain" | "privileged" | "unknown";
export type TerminalDecision = "denied" | "approval_required";

export interface TerminalCommandRequest {
  readonly requestId: string;
  readonly sessionId: string;
  readonly rootPath: string;
  readonly cwd: string;
  readonly executable: string;
  readonly args: readonly string[];
  readonly timeoutMs?: number;
  readonly maxOutputBytes?: number;
}

export interface TerminalPolicyDecision {
  readonly decision: TerminalDecision;
  readonly commandClass: TerminalCommandClass;
  readonly displayCommand: string;
  readonly cwd: string;
  readonly timeoutMs: number;
  readonly maxOutputBytes: number;
  readonly reason: string;
  readonly requiresHumanGate: boolean;
}

export interface TerminalPolicyPort {
  inspect(request: TerminalCommandRequest): TerminalPolicyDecision;
}
```

`displayCommand` ليس مصدر تنفيذ؛ هو عرض masked/bounded فقط. يجب أن يحذف أو يستبدل قيم arguments التي تشبه token أو password أو api key قبل العرض والتدقيق. لا يعيد القرار absolute root أو environment أو محتوى أسرار.

## تصنيف الأوامر

تستعمل السياسة allowlist وصفية ضيقة للتحليل فقط. حتى الأوامر المصنفة `read_only` لا تُشغّل تلقائيًا؛ القرار في هذه الشريحة هو `approval_required` للطلبات المعروفة أو `denied` للطلبات غير المعروفة/عالية الخطورة. هذا يمنع أن يتحول terminal panel إلى shell مقنّع.

| الفئة | أمثلة تحليلية | القرار الافتراضي | ملاحظات |
|---|---|---|---|
| `read_only` | `pwd`، `ls`، `find`، `git status`، `git diff --no-ext-diff` | `approval_required` | لا تنفيذ فعلي في الشريحة الحالية |
| `mutating` | `rm`، `mv`، `cp`، `mkdir`، `chmod`، `git checkout` | `denied` أو approval لاحقًا | يحتاج patch/rollback أو Human Gate خاص |
| `toolchain` | `pnpm`، `npm`، `yarn`، `npx`، `node`، `python`، `cargo`، `make` | `denied` | لا scripts أو postinstall أو test hooks تلقائيًا |
| `native` | `adb`، `gradle`، `xcodebuild`، `pod`، `emulator` | `denied` | لا native toolchains قبل doctor/resource contracts |
| `privileged` | `sudo`، `doas`، أوامر تغيّر النظام | `denied` | لا صلاحيات تصعيد من التطبيق |
| `unknown` | أي executable غير معروف أو wrapper shell | `denied` | لا fallback إلى shell |

ترفض السياسة shell wrappers مثل `sh -c` و`bash -c` و`zsh -c` و`cmd /c` و`powershell`، كما ترفض أي argument يحوي `;` أو `&&` أو `||` أو `|` أو redirection أو null byte. وجود هذه الرموز لا يُعالج بالـescaping ثم التنفيذ؛ بل يؤدي إلى deny لأن مصدر الطلب قد يكون غير موثوق.

## حدود root وcwd والموارد

يجب أن يكون `rootPath` canonical root ناتجًا عن root picker، وأن يكون `cwd` نسبيًا وغير فارغ ولا يحتوي traversal أو backslash أو null byte. لا يسمح بالوصول إلى parent أو symlink عبر policy؛ التحقق النهائي يجب أن يعاد داخل worker لاحقًا قبل كل execution لأن policy preview وحده ليس ضمان filesystem.

| الحد | low-memory profile | سبب الحماية |
|---|---:|---|
| عدد جلسات terminal | 0 execution في هذه الشريحة؛ 1 لاحقًا | منع background processes المتراكمة |
| timeout | 1–120 ثانية بعد approval | منع hanging commands |
| output | 4 KiB–256 KiB bounded | منع امتلاء الذاكرة والـUI |
| argv | 64 عنصرًا، 4 KiB لكل عنصر | منع payload amplification |
| executable | 128 byte | منع input abuse |
| cwd | 512 byte نسبي | منع تسريب root أو traversal |
| environment | لا يُقبل من renderer | منع secret injection |

## التكامل مع Agent Runtime وHuman Gate

يُبنى `AgentActionRequest` لاحقًا من القرار مع `kind: "terminal.exec"` وscope نسبي وidempotency key. لا يستطيع Agent Runtime تجاوز policy؛ فإذا كانت النتيجة `denied` تنتهي العملية، وإذا كانت `approval_required` تُنشأ تذكرة Human Gate وتظهر في Audit. لا تُعد موافقة على أمر واحد موافقة على executable آخر أو cwd آخر أو argv مختلف؛ يجب مطابقة digest للطلب كاملًا.

لا تستخدم `TerminalPolicyPort` في هذه الشريحة `ApprovalWorkflow` لتنفيذ الأمر، بل يمكنها فقط إرجاع metadata يحتاجها handler. مسار التنفيذ المستقبلي يجب أن يكون: inspect → policy decision → Human Gate → revalidate canonical cwd → acquire resource slot → spawn بدون shell وبـargv array → stream bounded output → cancellation/timeout → audit → cleanup.

## typed IPC وWorkspace

تضاف لاحقًا قناتا `terminal.inspect` أو `terminal.preview` فقط:

| method | payload | result |
|---|---|---|
| `terminal.inspect` | `TerminalCommandRequest` bounded | `TerminalPolicyDecision` |
| `terminal.preview` | alias read-only للعرض، إن لزم | نفس القرار دون execution |

لا تضاف `terminal.exec` إلى renderer في هذه الشريحة. يستخدم Workspace لوحة Terminal لعرض command class والقرار والسبب والـcwd النسبي والحدود، مع زر approval لاحق غير موصول بتنفيذ. لا يعرض panel output لأنه لا يوجد process.

## معايير القبول

تنجح الشريحة عندما يرفض evaluator كل unknown/shell wrapper/native/toolchain/privileged/mutating request، ويصنف allowlist الوصفي read-only كـapproval required دون spawn. يرفض malformed payload وtraversal وshell metacharacters وnull bytes والـargv/env غير المسموح. تكون القرارات deterministic، bounded، قابلة للتدقيق، ولا تحدث network أو model loading أو child process عند startup أو أثناء inspect.

## التنفيذ والتحقق

نفذ التطبيق `TerminalPolicyPort` و`BoundedTerminalPolicy` في Application مع تصنيف deterministic إلى `read_only` و`mutating` و`toolchain` و`native` و`privileged` و`unknown`. أضيفت قنطرة `terminal.inspect` إلى typed IPC وcomposition، وربطت Workspace بلوحة Inspect only لا تبدأ process ولا تستدعي shell. صُنّفت أوامر القراءة كـ`approval_required`، بينما رُفضت أوامر التعديل وtoolchains وnative والامتيازات والأوامر غير المعروفة fail-closed.

| الفحص | النتيجة |
|---|---|
| `pnpm check` | `124/124` اختبارًا ناجحًا |
| Policy contracts | التصنيف، deny-by-default، Human Gate metadata، digest deterministic، secret display redaction، shell syntax وbounds: PASS |
| typed IPC | `terminal.inspect` payload validator وhandler وmalformed/traversal rejection: PASS |
| Workspace/Electron | Terminal Policy panel وInspect only وdesktop smoke مع no-process assertion: PASS |
| Performance/security | low-memory profile، `PERF_SMOKE=PASS`، migration/JSON/diff/secret scans: PASS |

لا توجد `terminal.exec` أو `spawn` أو PTY أو xterm.js في هذه الشريحة. commit التنفيذ والتوثيق يثبتان بعد إغلاق GitHub verification.

## الحدود المفتوحة

لا تثبت هذه الشريحة وجود terminal فعلي أو xterm.js أو streaming أو background session أو PTY أو command execution أو test runner. لا يجوز اعتبار `approval_required` تصريحًا بالتنفيذ. تأتي تلك القدرات فقط بعد Terminal Worker مع process isolation وresource admission وHuman Gate وredaction وcancellation. ويبقى Lightweight Web Preview/React Native Web/Metro مؤجلًا إلى آخر مراحل تصميم البيئة.
