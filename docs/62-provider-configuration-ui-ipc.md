# Typed Provider Configuration UI وIPC

**الحالة:** منفذة ومتحقق منها داخل Electron Workspace.

## الهدف

تقدم هذه الشريحة سطحًا typed للواجهة كي تعرض providers المسجلة، تحفظ configuration bounded، وتشغّل doctor صريحًا. لا تكشف renderer أي `ipcRenderer` أو Node API، ولا تبدأ provider أو model تلقائيًا عند تحميل Workspace.

| السطح | الوظيفة |
|---|---|
| `provider.list` | عرض metadata آمنة وحالة `configured/enabled` دون أسرار |
| `provider.configure` | حفظ loopback URL وmodel والحدود عبر runtime validation وprovider policy |
| `provider.doctor` | تنفيذ health probe صريح وإرجاع `disabled/blocked/healthy/degraded/unavailable` مع latency |
| Workspace Provider panel | حقول base URL/model، Enable، Save config، وRun doctor باستخدام `textContent` |
| Desktop smoke | يمرر list → configure disabled → doctor disabled عبر Electron IPC دون network |

## حدود الأمان

تظل كل operations على قناة `osamah:dispatch` الموجودة خلف sender validation و`isIpcRequest`. validators ترفض provider IDs غير المعروفة، URLs غير loopback، credentials، والحدود التي تتجاوز سياسة low-memory، خصوصًا `maxConcurrent` الأكبر من واحد. تعرض الواجهة metadata فقط؛ لا توجد حقول API keys أو secrets في هذا السطح.

التكوين لا يساوي الجاهزية. يمكن للمستخدم حفظ provider بحالة disabled، ويعيد doctor حالة `disabled` قبل أي adapter lookup. عند التفعيل، لا يُستدعى health إلا عبر زر doctor أو مسار invoke الصريح؛ لا توجد timers أو probes عند startup.

> **قاعدة fail-closed:** كل payload غير صالح يُرفض قبل الوصول إلى Application layer، وأي provider غير مسجل أو configuration غير loopback لا يتحول إلى available أو healthy افتراضيًا.

## التحقق

| الفحص | النتيجة |
|---|---|
| IPC contract | `provider.list` و`provider.configure` و`provider.doctor` validators وhandlers: PASS |
| renderer boundary | preload surface typed عبر `dispatch` فقط، دون raw IPC exposure: PASS |
| UI safety | Provider cards وحقول doctor والنتائج النصية تستخدم DOM APIs و`textContent`: PASS |
| Electron smoke | provider list/configure disabled/doctor وHuman Gate وroot picker: PASS |
| المشروع الكامل | `98/98` اختبارًا، build وdesktop/performance smoke وmigration/JSON/diff/secret: PASS |

## الحدود والخطوة التالية

لا تشمل الشريحة بعد persistence مستقلة لـprovider configuration، model discovery، streaming، tool execution، أو remote providers. التكوين الحالي يعيش في composition الحالية، ويجب إضافة persistence/backup UX لاحقًا قبل اعتباره إعدادًا دائمًا للمستخدم. الخطوة التالية هي ربط اختيار provider/model بمسار Planner/Critic وAgent Runtime مع بقاء Human Gate قبل mutation، ثم Development Environment العامة. يظل Lightweight Web Preview في آخر مراحل تصميم البيئة.

إعداد: Manus AI. تاريخ الفحص: 2026-08-22.
