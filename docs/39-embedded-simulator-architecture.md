# معمارية المحاكي المدمج داخل Osamah Studio Agent

## القرار

المحاكي المدمج ليس صفحة منفصلة أو أداة اختبار خارجية؛ هو **لوحة أساسية داخل بيئة التطوير** تظهر إلى جانب شجرة الملفات والمحرر والطرفية والسجلات. يتيح للمطور كتابة الكود، اختيار جهاز افتراضي، تشغيل المعاينة، التفاعل معها، رؤية السجلات والـ Inspector، ثم حفظ screenshot أو إرسال نتيجة إلى الوكيل، دون مغادرة التطبيق.

يظل هذا المحاكي في طبقة `LightweightPreview` متوافقًا مع React Native Web/Expo Web عندما يكون ذلك ممكنًا. أما Android Emulator وiOS Simulator والجهاز الفعلي فهي transports اختيارية للتحقق native، وتغذي اللوحة المدمجة بالصور والسجلات والحالة نفسها. المحاكي المدمج هو المسار الافتراضي للتطوير السريع، وليس مجرد fallback.

## شكل البيئة

```text
┌───────────────────────────────────────────────────────────────────┐
│ Workspace / Project / Device / Run / Refresh / Capture / Approve  │
├──────────────┬───────────────────────────────┬────────────────────┤
│ File Tree    │ Editor + Embedded Simulator    │ Inspector / Logs    │
│              │ ┌─────────────┬─────────────┐ │                    │
│ app/         │ │ Code Editor │ Device Frame│ │ Device Profile     │
│ components/  │ │             │ └─────────────┘ │ Runtime State       │
│ package.json │ │ Terminal / Metro / Console │ │ UI Tree            │
└──────────────┴───────────────────────────────┴────────────────────┘
```

## الوظائف الأساسية داخل التطبيق

| الوظيفة | السلوك المطلوب | الدليل/الحالة |
|---|---|---|
| فتح مشروع الهاتف | اختيار root وقراءة الملفات والـ package metadata دون تنفيذ scripts | detector منفذ؛ UI قادم |
| شجرة الملفات | عرض الملفات وتحديد الملف الحالي مع حماية roots | مخطط |
| المحرر | تحرير TS/TSX/JSON، حفظ، dirty state، keyboard shortcuts | مخطط |
| Device Profiles | Pixel/iPhone/Tablet/custom مع geometry وsafe area وtheme | domain + prototype منفذ |
| Start/Stop | إنشاء PreviewSession وإظهار الحالة والقدرات | domain منفذ؛ UI prototype منفذ |
| تفاعل الهاتف | tap/long press/swipe/scroll/drag/keyboard/copy/paste/back/home | contract منفذ؛ renderer مرحلي |
| Fast Refresh | تحديث preview مع حفظ الحالة عندما يسمح runtime، وإظهار full reload عندما يلزم | mock/prototype؛ Metro adapter قادم |
| Inspector | profile، orientation، theme، capability، UI tree، event timeline | prototype جزئي |
| Capture | screenshot مع metadata وcorrelation ID وربطه بالجلسة/المهمة | adapter contract منفذ |
| Native validation | تحويل target إلى Android/iOS/physical/EAS مع نفس اللوحة | adapters لاحقة |
| AI bridge | screenshot/log/tree إلى agent tool بحدود payload وموافقة عند التعديل | مخطط أمنيًا |

## حدود الحالة

`EmbeddedSimulatorView` لا يملك domain state بنفسه؛ يقرأ `PreviewSession`, `DeviceProfile`, `PreviewFrame`, `PreviewEvent`, و`Diagnostic`. كل تغيير يمر عبر application command أو typed IPC. لا يسمح renderer بتغيير filesystem أو تشغيل subprocess. عند عدم دعم native API، يظهر `compatibility warning` ولا يتحول إلى نجاح زائف.

## العقود القادمة

```ts
interface EmbeddedSimulatorController {
  openProject(rootPath: string): Promise<MobileProjectDescriptor>;
  selectDevice(profileId: DeviceProfileId): Promise<void>;
  start(mode: PreviewSession["mode"]): Promise<PreviewSession>;
  sendInput(input: PreviewInput): Promise<PreviewFrame>;
  refresh(kind: "fast" | "reload"): Promise<void>;
  capture(): Promise<PreviewScreenshot>;
  inspect(): Promise<PreviewInspection>;
  stop(): Promise<void>;
}
```

## معايير القبول لهذه الشريحة

تُقبل الشريحة عندما يظهر simulator داخل workspace layout واحد، ويكون device profile قابلًا للتبديل، وتعمل rotate/theme/refresh/capture من اللوحة نفسها، وتظهر الحالة والـ inspector والـ console، وتُسجل الأحداث في session timeline، وتظل filesystem/native operations خلف ports/IPC. لا يُعدّ وجود إطار هاتف ثابت وحده اكتمالًا للمحاكي.

## ما ينفذ الآن

ستُنفذ أولًا واجهة Embedded Studio Prototype مرتبطة بنموذج `LightweightPreviewAdapter` والعقود الحالية، مع Project/File panel وPreview panel وInspector/Console. بعد التحقق البصري، تُنقل الأحداث إلى typed IPC ثم storage/session persistence، وبعدها Metro/Fast Refresh الحقيقي.

## References

[1]: ./33-mobile-development-architecture.md "Mobile Development and Preview Architecture"
[2]: ./34-clean-architecture.md "Clean Architecture and Bounded Contexts"
[3]: ./35-domain-and-events.md "Domain and Event Model"
[4]: https://necolas.github.io/react-native-web/docs/ "React Native for Web"
[5]: https://reactnative.dev/docs/fast-refresh "Fast Refresh"

إعداد: Manus AI. تاريخ التحديث: 2026-08-22.
