# AI_CONTINUATION

## الهوية والهدف

Osamah Studio Agent منصة Desktop محلية أولًا تجمع Intelligent Software Development Environment وProduction Studio وSecond Brain. الهدف هو تحويل الطلب إلى سياق وخطة وتنفيذ قابل للمراجعة ثم artifact أو معرفة قابلة لإعادة الاستخدام، مع حماية الملفات والأسرار والموارد.

## الحالة الدقيقة

المستودع كان وثائقيًا فقط عند بداية هذه المرحلة. أحدث baseline موثق هو `79026c4368d978506ed5dad06a5f48b8f34e4036`. أُضيف الآن Foundation slice TypeScript في `src/` وmobile preview prototype في `prototypes/mobile-preview/index.html`، وكلاهما pending commit. نجح `pnpm check` محليًا: typecheck و8 tests. لا يوجد Electron/SQLite/Metro/native runtime حتى الآن.

## المعمارية

Clean Architecture: Domain مستقل، Application use cases/ports، Interface Adapters، Infrastructure، Presentation. القرار المكتبي هو Electron مؤقتًا مع process isolation. Mobile subsystem له LightweightPreview عبر React Native Web/Expo Web-compatible mode، وnative adapters لـ Metro/Android Emulator/iOS Simulator/physical/EAS. لا يدّعي preview fidelity native.

## الملفات المهمة

`docs/31-gap-analysis.md` سجل الفجوات. `docs/33-mobile-development-architecture.md` قرار mobile. `docs/34-clean-architecture.md` قواعد الطبقات والـ ports. `docs/35-domain-and-events.md` state/event model. `docs/36-foundation-implementation-plan.md` acceptance sequence. `src/domain/entities.ts` القواعد الحالية. `src/domain/mobile.ts` detector/capability model. `src/application/use-cases.ts` use cases. `src/application/mobile-services.ts` detector services. `src/application/ports.ts` ports. `src/infrastructure/in-memory.ts` test adapters. `src/mobile/preview.ts` preview contract/adapter. `src/*test.ts` الاختبارات. `prototypes/mobile-preview/index.html` prototype بصري تفاعلي. `docs/reference/` خرائط المعرفة الحية.

## القواعد

لا يعتمد Domain على UI أو OS أو vendor. لا تضع secrets أو user files أو model weights في Git. لا تشغل native toolchains أو scripts غير موثوقة تلقائيًا. لا تجعل iOS Simulator يبدو متاحًا على Windows/Linux. لا تحول UNKNOWN إلى FACT. كل feature تحتاج architecture، interface، data model، dependencies، risks، acceptance criteria، implementation، tests، docs، commit، push، verification.

## الأوامر الحالية

```bash
pnpm install
pnpm check
pnpm typecheck
pnpm test
git diff --check
```

## Git protocol

قبل العمل: `git fetch --all --prune`, `git pull --ff-only origin main`, ثم اقرأ `PROJECT_STATE.md`. بعد العمل: شغل `pnpm check` وlicense/security checks، حدّث `PROJECT_STATE.md`, `docs/WORK_LOG.md`, `CHANGELOG.md`, وreference maps، ثم commit معنوي وpush و`git ls-remote` للتحقق من تطابق hash. لا تعلن نجاح push دون hash تطابق.

## التسلسل التالي

ابدأ بـ SQLite schema/migration وtyped IPC contracts أو LightweightPreview adapter، لكن لا تنفذهما معًا في commit واحد. أضف أولًا contract tests، ثم adapter in-memory، ثم implementation خارجي bounded. بعد استقرار Foundation، أضف project detector/generator، ثم Metro adapter، ثم Android doctor/ADB، ثم macOS-only iOS adapter، ثم AI visual loop بحدود iteration وapproval.

## أسئلة مفتوحة

OpenTo Desktop ما زال بلا source رسمي. يلزم تحديد React renderer، SQLite driver، browser-metro/Snack integration، دعم EAS/remote، hardware baseline، وسياسة multi-device concurrency. يجب أن تظل هذه الأسئلة في project state حتى يجيب المالك أو يظهر مصدر موثوق.

## آخر مهمة دقيقة

حدّث `docs/WORK_LOG.md` و`CHANGELOG.md`، تحقق من lockfile، شغّل clean checks، ثم commit/push للـ Foundation + gap/mobile architecture + reference maps + preview prototype. سجّل hash في `PROJECT_STATE.md` و`PROJECT_STATUS.md`. بعدها انتقل إلى أول adapter منفصل: SQLite/IPC أو Metro، وليس Android/iOS native قبل doctor contracts.

إعداد: Manus AI. آخر تحديث: 2026-08-22.
