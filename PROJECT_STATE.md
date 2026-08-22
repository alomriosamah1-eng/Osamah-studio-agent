# PROJECT_STATE

## الحالة الحالية

| الحقل | القيمة |
|---|---|
| الإصدار | `0.6.0`؛ Lightweight Web Preview وResource Policy وbounded Agent Runtime منفذة دون bump release |
| المرحلة | Lightweight Web Preview + Resource Policy + General Project Detection |
| الحالة | SQLite السابقة وslice الأداء والـ preview العام مدفوعة ومتحقق منها على `origin/main` |
| آخر commit SQLite للشريحة السابقة | `0c51c1e00726afa798182ade0e6dc16ab627eba7` (`feat: add sqlite adapter and observability`) |
| آخر commit للشريحة الحالية | `b9089efee33a174c3958a9295853623beae27503` (`feat: add lightweight preview and resource governance`) |
| آخر فحص | `pnpm check` ناجح، `44/44` اختبارًا، و`pnpm performance:smoke` ناجح، في 2026-08-22 |
| schema | migration `001` ثم `002`، schema version `002` |
| driver | `node:sqlite` / `DatabaseSync` من Node.js 22.13، بلا native npm dependency إضافية |
| حالة push للشريحة السابقة | SQLite code عند `0c51c1e00726afa798182ade0e6dc16ab627eba7`؛ documentation عند `be7d29359a0e95e1d1e83f1e65c0e8e7fe725c83` و`76b47cb24953c4dafd2bd750deefdf03f8be8362`؛ verified |
| حالة push للشريحة الحالية | `b9089efee33a174c3958a9295853623beae27503`؛ `GITHUB_PUSH_VERIFIED=true` وlocal == `origin/main` |

## المكتمل

تمت مراجعة المستودع والوثائق السابقة وإنشاء Gap Analysis وخرائط المراجع وخطة التنفيذ الشاملة للأقسام الثلاثة: Intelligent Software Development Environment وProduction Studio وSecond Brain. أضيفت طبقات Domain وApplication وInfrastructure وPresentation مع entities وstate transitions وdomain events وuse cases وin-memory adapters واختبارات deterministic.

اكتملت شرائح Mobile Preview وEmbedded Simulator وProject Preview Runtime وPresentation Renderer وIPC Project Open. المحاكي مدمج داخل Workspace إلى جانب file tree/editor/Inspector/Console، ويعمل حاليًا في compatibility/fixture mode فقط. يقرأ scanner مشروعًا من root مقيد ويبني bundle ويرفض path traversal ولا يشغل scripts أو `postinstall` أو native toolchains من مشاريع الهاتف.

اكتملت شريحة Electron Shell وTyped Preload مع `contextIsolation` و`sandbox` وCSP وsender validation وdesktop smoke. يمر `preview.openProject` عبر boundary typed، بينما production root picker وwiring النهائية للتخزين ما زالا خطوات لاحقة.

أضيف `db/migrations/002_observability.sql` لجداول `device_profiles` و`preview_sessions` و`observability_logs` وفهارسها. وأضيفت عقود `SqlExecutor` و`ObservabilitySink` و`BackupProvider`، مع `SqliteDatabase` و`SqliteRepositories` و`SqliteEventBus` و`SqliteObservabilitySink` في Infrastructure. يطبق migration runner الملفات بترتيب ثابت ويسجل checksums ويفشل مغلقًا عند mismatch.

أضيف `LocalSqliteBackupProvider` الذي ينشئ snapshot atomic عبر `VACUUM INTO`، ويكتب manifest مع SHA-256، ويتحقق من schema وforeign keys وmigration dry-run على نسخة مؤقتة، ويستعيد إلى profile منفصل دون overwrite للقاعدة الحية. أضيف `InMemoryObservabilitySink` للحفاظ على اختبارات Application سريعة.

أضيفت slice الأداء الخفيف: `ProjectKind` و`PreviewCapability` و`GeneralProjectDetector`، حدود source/module/asset/warning، low-memory `ResourcePolicy`، latest-only refresh queue، و`BoundedAgentRuntime` بعمل وكيل واحد متزامن وqueue/history محدودين. الـ embedded controller يرفض native modes غير المدعومة بدل إعلان native fidelity زائفة.

## التحقق الحالي

| الفحص | النتيجة |
|---|---|
| `pnpm typecheck` | ناجح |
| `pnpm test` | `44/44` ناجحة |
| `pnpm check` | ناجح |
| `pnpm performance:smoke` | ناجح؛ low_memory، React Native → lightweight_web، preview حوالي 10ms، heap delta حوالي 0.3MB، RSS delta حوالي 3.4MB، تحت V8 heap 768MB |
| `python3 scripts/validate_sqlite_migration.py` | ناجح؛ migration count `2`، schema `002`، 10 جداول، 16 index entries |
| repository round-trip/restart | ناجح لجميع entities الحالية |
| event bus وobservability | persistence وrecursive redaction وbounded listing ناجحة |
| backup/restore | manifest وSHA-256 وforeign-key validation وmigration dry-run وtampering tests ناجحة |
| `git diff --check` وsecret scan وdesktop smoke | ناجحة؛ `SECRET_SCAN=PASS` و`DESKTOP_SMOKE=PASS` و`DESKTOP_IPC_SMOKE=PASS` |

## الحدود الحالية

لا يزال SQLite غير مربوط نهائيًا بـ`createEmbeddedApplication`؛ composition يستخدم in-memory repositories مع resource policy وagent runtime خفيفين إلى أن تُنفذ wiring اختيارية مع profile lifecycle وfallback policy. كما لم يُنفذ FTS5 أو object store أو Provider Gateway أو terminal sandbox أو production packaging الموقّع.

لا توجد بعد React Native Web/Metro runtime فعلية، ولا Android doctor/ADB adapter، ولا iOS Xcode adapter، ولا تكاملات remote/EAS. لا ينبغي تشغيل native toolchains أو scripts من مشاريع الهاتف تلقائيًا.

لا يدعي الـ embedded simulator native fidelity؛ compatibility/fixture preview ليس React Native native renderer ولا Metro HMR حقيقيًا. Android Emulator وiOS Simulator transports اختيارية مستقبلية تغذي اللوحة نفسها، ويجب أن تسبقها doctor/resource contracts وقياسات الموارد. OpenTo ما يزال `UNKNOWN / REQUIRES VALIDATION`.

## الخطوة التالية الدقيقة

بعد دفع slice الأداء والـ preview، تبدأ **production root picker عبر typed preload وmain-process dialog**، ثم wiring اختيارية لـSQLite داخل composition root. بعد ذلك يُوسّع bounded Agent Runtime بعقود provider/approval، ثم Provider Gateway، ثم React Native Web/Metro parity عند الحاجة، ثم Android وiOS transports اختياريًا وفق availability وdoctor/resource evidence.

للتسليم إلى وكيل أو مهندس لاحق، ابدأ بقراءة `AI_CONTINUATION.md` ثم `PROJECT_STATE.md` ثم `docs/45-master-implementation-plan.md` و`docs/47-sqlite-adapter-implementation.md`.

آخر تحديث: 2026-08-22. إعداد: Manus AI.
