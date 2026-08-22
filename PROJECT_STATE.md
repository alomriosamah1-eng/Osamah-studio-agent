# PROJECT_STATE

## الحالة الحالية

| الحقل | القيمة |
|---|---|
| الإصدار | `0.6.0`؛ Lightweight Web Preview وResource Policy وbounded Agent Runtime منفذة دون bump release |
| المرحلة | Profile Path Policy + Exclusive Lock بعد Optional SQLite Composition |
| الحالة | Profile path policy وexclusive lock منفذان ومدفوعان ومتحقق منهما على `origin/main`؛ الخطوة التالية Provider/Approval contracts |
| آخر commit SQLite للشريحة السابقة | `0c51c1e00726afa798182ade0e6dc16ab627eba7` (`feat: add sqlite adapter and observability`) |
| آخر commit الأداء السابق | `b9089efee33a174c3958a9295853623beae27503` (`feat: add lightweight preview and resource governance`) |
| آخر commit root picker السابق | `197424dc6cbc1f02b92011903f5bbce77e819f6c` (`feat: add production root picker`) |
| آخر commit SQLite composition | `e9a892a42e394b92e4708847f01eafc9205b70ae` (`feat: wire optional sqlite composition`) |
| آخر commit Profile Storage | `e8c4ecca95dd51659b30d62f740c1f67ca5701ff` (`feat: add profile path policy and exclusive lock`) |
| آخر فحص | `pnpm check` ناجح، `53/53` اختبارًا، وfull gate ناجح في 2026-08-22 |
| schema | migration `001` ثم `002`، schema version `002` |
| driver | `node:sqlite` / `DatabaseSync` من Node.js 22.13، بلا native npm dependency إضافية |
| حالة push للشريحة السابقة | SQLite code عند `0c51c1e00726afa798182ade0e6dc16ab627eba7`؛ documentation عند `be7d29359a0e95e1d1e83f1e65c0e8e7fe725c83` و`76b47cb24953c4dafd2bd750deefdf03f8be8362`؛ verified |
| حالة push لشريحة الأداء السابقة | `b9089efee33a174c3958a9295853623beae27503`؛ `GITHUB_PUSH_VERIFIED=true` وlocal == `origin/main` |
| حالة push لشريحة root picker | `197424dc6cbc1f02b92011903f5bbce77e819f6c`؛ `GITHUB_PUSH_VERIFIED=true` وlocal == `origin/main` |
| حالة push لشريحة SQLite composition | `e9a892a42e394b92e4708847f01eafc9205b70ae`؛ `GITHUB_PUSH_VERIFIED=true` وlocal == `origin/main` |
| حالة push لشريحة Profile Path Policy | `e8c4ecca95dd51659b30d62f740c1f67ca5701ff`؛ `GITHUB_PUSH_VERIFIED=true` وlocal == `origin/main` |

## المكتمل

تمت مراجعة المستودع والوثائق السابقة وإنشاء Gap Analysis وخرائط المراجع وخطة التنفيذ الشاملة للأقسام الثلاثة: Intelligent Software Development Environment وProduction Studio وSecond Brain. أضيفت طبقات Domain وApplication وInfrastructure وPresentation مع entities وstate transitions وdomain events وuse cases وin-memory adapters واختبارات deterministic.

اكتملت شرائح Mobile Preview وEmbedded Simulator وProject Preview Runtime وPresentation Renderer وIPC Project Open. المحاكي مدمج داخل Workspace إلى جانب file tree/editor/Inspector/Console، ويعمل حاليًا في compatibility/fixture mode فقط. يقرأ scanner مشروعًا من root مقيد ويبني bundle ويرفض path traversal ولا يشغل scripts أو `postinstall` أو native toolchains من مشاريع الهاتف.

اكتملت شريحة Electron Shell وTyped Preload مع `contextIsolation` و`sandbox` وCSP وsender validation وdesktop smoke. يمر `preview.openProject` عبر boundary typed، بينما production root picker وwiring النهائية للتخزين ما زالا خطوات لاحقة.

أضيف `db/migrations/002_observability.sql` لجداول `device_profiles` و`preview_sessions` و`observability_logs` وفهارسها. وأضيفت عقود `SqlExecutor` و`ObservabilitySink` و`BackupProvider`، مع `SqliteDatabase` و`SqliteRepositories` و`SqliteEventBus` و`SqliteObservabilitySink` في Infrastructure. يطبق migration runner الملفات بترتيب ثابت ويسجل checksums ويفشل مغلقًا عند mismatch.

أضيف `LocalSqliteBackupProvider` الذي ينشئ snapshot atomic عبر `VACUUM INTO`، ويكتب manifest مع SHA-256، ويتحقق من schema وforeign keys وmigration dry-run على نسخة مؤقتة، ويستعيد إلى profile منفصل دون overwrite للقاعدة الحية. أضيف `InMemoryObservabilitySink` للحفاظ على اختبارات Application سريعة.

أضيفت slice الأداء الخفيف: `ProjectKind` و`PreviewCapability` و`GeneralProjectDetector`، حدود source/module/asset/warning، low-memory `ResourcePolicy`، latest-only refresh queue، و`BoundedAgentRuntime` بعمل وكيل واحد متزامن وqueue/history محدودين. الـ embedded controller يرفض native modes غير المدعومة بدل إعلان native fidelity زائفة.

أضيف production root picker: `chooseProjectRoot` عبر main-process dialog وtyped preload وcanonical path validation وtrusted sender، مع زر Workspace واختبار desktop smoke deterministic. الإلغاء والخطأ typed، ورسائل filesystem الخام لا تصل إلى renderer.

أضيف optional SQLite composition wiring: `createEmbeddedApplication({ storage })` يبقي memory default، ويفتح SQLite فقط عند opt-in، ويدعم restart persistence وfallback صريحًا و`close()` idempotent. عولجت event ID collision المحتملة باستخدام UUID وإغلاق الاتصال عند initialization failure.

أضيفت profile path policy: `resolveProfilePaths` لمسارات profile قياسية، و`validateProfileId` لمنع traversal والجذر، و`FileProfileLock` بقفل حصري `wx` وownership-token release idempotent. أضيف `sqlite-profile` composition مع إطلاق lock عند close أو initialization failure، واختبارات deterministic لـpolicy وlifecycle.

## التحقق الحالي

| الفحص | النتيجة |
|---|---|
| `pnpm typecheck` | ناجح |
| `pnpm test` | `53/53` ناجحة |
| `pnpm check` | ناجح |
| `pnpm performance:smoke` | ناجح؛ low_memory، React Native → lightweight_web، preview حوالي 10ms، heap delta حوالي 0.3MB، RSS delta حوالي 3.4MB، تحت V8 heap 768MB |
| `pnpm desktop:smoke` | ناجح؛ `DESKTOP_ROOT_PICKER_SMOKE=PASS` و`DESKTOP_IPC_SMOKE=PASS` |
| composition SQLite | opt-in/restart/fallback/close lifecycle PASS |
| profile storage | deterministic paths وunsafe-ID rejection وexclusive lock وidempotent release وcomposition reopen PASS؛ delivery `e8c4ecca95dd51659b30d62f740c1f67ca5701ff`، local == `origin/main` |
| `python3 scripts/validate_sqlite_migration.py` | ناجح؛ migration count `2`، schema `002`، 10 جداول، 16 index entries |
| repository round-trip/restart | ناجح لجميع entities الحالية |
| event bus وobservability | persistence وrecursive redaction وbounded listing ناجحة |
| backup/restore | manifest وSHA-256 وforeign-key validation وmigration dry-run وtampering tests ناجحة |
| `git diff --check` وsecret scan وdesktop smoke | ناجحة؛ `SECRET_SCAN=PASS` و`DESKTOP_SMOKE=PASS` و`DESKTOP_IPC_SMOKE=PASS` |

## الحدود الحالية

أصبح SQLite مربوطًا اختياريًا بـ`createEmbeddedApplication` مع profile path policy وقفل حصري عند استخدام `sqlite-profile`. لم يُنفذ بعد FTS5 أو object store أو Provider Gateway أو terminal sandbox أو production packaging الموقّع.

لا توجد بعد React Native Web/Metro runtime فعلية، ولا Android doctor/ADB adapter، ولا iOS Xcode adapter، ولا تكاملات remote/EAS. لا ينبغي تشغيل native toolchains أو scripts من مشاريع الهاتف تلقائيًا.

لا يدعي الـ embedded simulator native fidelity؛ compatibility/fixture preview ليس React Native native renderer ولا Metro HMR حقيقيًا. Android Emulator وiOS Simulator transports اختيارية مستقبلية تغذي اللوحة نفسها، ويجب أن تسبقها doctor/resource contracts وقياسات الموارد. OpenTo ما يزال `UNKNOWN / REQUIRES VALIDATION`.

## الخطوة التالية الدقيقة

بعد إغلاق profile path policy وexclusive lock، تبدأ عقود provider/approval حول BoundedAgentRuntime ثم Provider Gateway. يأتي backup UX وencryption/key management عند الحاجة، ويظل استكمال Lightweight Web Preview إلى آخر مراحل تصميم البيئة؛ لا يبدأ Android/iOS native قبل doctor/resource contracts وقياسات الموارد.

للتسليم إلى وكيل أو مهندس لاحق، ابدأ بقراءة `AI_CONTINUATION.md` ثم `PROJECT_STATE.md` ثم `docs/45-master-implementation-plan.md` و`docs/47-sqlite-adapter-implementation.md`.

آخر تحديث: 2026-08-22. إعداد: Manus AI. آخر delivery: `e8c4ecca95dd51659b30d62f740c1f67ca5701ff`؛ `GITHUB_PUSH_VERIFIED=true`.
