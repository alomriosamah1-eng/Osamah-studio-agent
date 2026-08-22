# تنفيذ Electron Shell وTyped Preload

## النتيجة

أضيفت أول طبقة Desktop فعلية فوق النواة الحالية. يتكون المسار من Electron main process وBrowserWindow معزولة وpreload محدود وقناة IPC واحدة allowlisted. يحافظ main process على ownership للنواة و`createEmbeddedApplication`، بينما لا يرى renderer filesystem أو secrets أو `ipcRenderer` الخام.

## الملفات

| الملف | المسؤولية |
|---|---|
| `src/desktop/main.ts` | إنشاء BrowserWindow، تحميل Workspace، CSP، navigation policy، sender validation، وربط IPC بالنواة |
| `src/desktop/preload-api.ts` | العقد TypeScript للـ API المسموح للـ renderer |
| `src/desktop/preload.cjs` | runtime bridge صغير يعرّض `osamah.dispatch` عبر `contextBridge` |
| `src/desktop/security.ts` | channel constant وCSP وworkspace URL/sender predicates القابلة للاختبار |
| `scripts/desktop-smoke.mjs` | تشغيل shell مؤقتًا والتحقق من startup وpreload و`preview.openProject` |
| `prototypes/studio/workspace.js` | منطق Workspace الخارجي، مع إزالة inline script للسماح بـ `script-src 'self'` |

## حدود الأمان

يستخدم BrowserWindow `contextIsolation: true` و`sandbox: true` و`nodeIntegration: false` و`webSecurity: true`. يرفض main process النوافذ الجديدة والتنقل إلى URLs مختلفة، ويقبل IPC فقط من WebContents المتوقع ومن file URL الخاص بـ Workspace. يسمح CSP بالـ scripts من نفس المصدر فقط، ولا يسمح بـ `unsafe-inline` للـ scripts. بقي `unsafe-inline` في styles مؤقتًا لأن prototype يستخدم inline style؛ يزال قبل production shell النهائي.

لا يمرر preload أي Node API إلى renderer؛ الدالة الوحيدة هي `osamah.dispatch(request)`. وتبقى validation البروتوكولية في main process، لأن TypeScript لا يحمي استدعاءات JavaScript الخارجية وقت التشغيل. الأخطاء غير الموثوقة لا تغيّر policy، وproject scripts أو postinstall أو native toolchains لا تُشغّل ضمن هذا المسار.

## مسار smoke

عند تشغيل `pnpm desktop:smoke` يُبنى TypeScript، ينسخ preload CommonJS إلى `dist/desktop`، يشغل Electron مع تعطيل GPU فقط لبيئة smoke، ويفتح Workspace مع hash مؤقت. يستدعي Workspace `preview.openProject` عبر preload باستخدام fixture محلي، ثم يعيد main process النتيجة عبر typed in-memory IPC، ويغلق التطبيق تلقائيًا بعد تسجيل `DESKTOP_IPC_SMOKE=PASS`.

تعطيل GPU خاص بالتحقق المعزول ولا يمثل إعدادًا دائمًا للتطبيق. أما التطبيق العادي فيستخدم hardware acceleration الافتراضي إلى أن تضاف resource governance وGPU fallback رسميتان.

## التحقق

| الفحص | معيار القبول |
|---|---|
| `pnpm typecheck` | ينجح بدون أخطاء main/preload/security |
| `pnpm test` | يشمل CSP وsender URL tests وبقية عقود النواة |
| `pnpm desktop:smoke` | startup + preload + IPC `preview.openProject` ينجحان |
| `git diff --check` | لا توجد مسافات أو أخطاء patch |
| secret scan | لا توجد مفاتيح في source أو prototype أو scripts |

## الحدود الحالية

هذه ليست بعد production packaging موقعة، ولا تختار Workspace root عبر native dialog، ولا تعرض كل methods للواجهة الفعلية، ولا تحتوي SQLite native adapter. كما أن browser/fixture preview ما زال compatibility mode، وليس React Native native runtime أو Android Emulator أو iOS Simulator.

## الخطوة التالية

تضاف واجهة Workspace typed adapter لاختيار root path عبر main process وفتح مشروع باستخدام `preview.openProject` دون تمرير path غير موثوق، ثم يبدأ SQLite adapter خلف ports الحالية. قبل release تزال inline styles، تضاف signed packaging وCSP production الصارمة وmigration/backup smoke tests.

إعداد: Manus AI. تاريخ التحديث: 2026-08-22.
