# خطة تنفيذ Foundation Slice

## الهدف

تحويل المشروع من وثائق فقط إلى أول vertical slice قابل للاختبار، دون ادعاء اكتمال Desktop أو mobile native. الـ slice يثبت Domain/Application contracts، إنشاء Workspace، إنشاء Session، طلب Approval، إدارة DeviceProfile، وإنشاء PreviewSession في lightweight mode عبر in-memory adapters.

## التسلسل

| الخطوة | الناتج | الاعتماد | اختبار القبول |
|---|---|---|---|
| 1 | package/TypeScript/test foundation | Node 22 وpnpm | `typecheck` و`test` يعملان clean |
| 2 | domain IDs/errors/entities | requirements + ADR | invalid transitions ترفض |
| 3 | application ports/use cases | domain | workspace/session/approval tests |
| 4 | in-memory adapters | ports | deterministic tests دون OS |
| 5 | DeviceProfile/PreviewSession | mobile architecture | profile geometry وcapabilities صحيحة |
| 6 | SQLite adapter seam placeholder | data decision | contract interface بلا DB assumption |
| 7 | reference maps/state/handoff | living docs | كل module مرتبط بملف وtest |
| 8 | CI minimal | package scripts | clean checkout runs typecheck/test |

## ما لن يُنفذ في هذه الخطوة

لن تُشغّل Electron أو Android Emulator أو Xcode أو Metro الحقيقي، ولن تُضاف React Native dependency كبيرة أو model/provider credentials. هذه الأعمال تحتاج adapter contracts وdoctor/benchmark وsecurity gates لاحقة.

## معايير القبول

تنجح الخطوة عندما ينشئ use case workspace/session، يرفض approval غير المصرح، ينتقل PreviewSession بين الحالات الصحيحة، يتحقق من device dimensions/safe area/orientation، ويجتاز TypeScript tests دون network أو native toolchain. كما يجب أن يكون الكود مستقلًا عن UI وElectron وReact Native.

## مخاطر وتخفيف

خطر over-engineering يُخفف بحدود ملفات قليلة وعقود مباشرة. خطر false native claim يُخفف بتسمية `LightweightPreview`. خطر lock-in يُخفف بـ ports. خطر state inconsistency يُخفف بـ state transition functions واختبارات illegal transitions.

إعداد: Manus AI. تاريخ الفحص: 2026-08-22.
