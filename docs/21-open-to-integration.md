# تكامل OpenTo

## نتيجة البحث

لم يُعثر في البحث العام أو GitHub على مشروع رسمي واضح يطابق اسم `OpenTo Desktop` أو على مواصفة extension/IPC قابلة للتحقق. هذه ليست نتيجة أن OpenTo غير موجود؛ هي نتيجة أن **هوية المنصة غير قابلة للإثبات من الأدلة المتاحة**. لذلك يصنف كل ادعاء عن runtime أو plugin أو filesystem أو packaging في هذا الملف كـ `UNKNOWN / REQUIRES VALIDATION`.

## ما يلزم من مالك المشروع

يلزم رابط رسمي أو repository، الإصدارات المدعومة، نظام التشغيل، طريقة فتح المشاريع، extension/plugin API، process model، IPC، terminal/filesystem contracts، الشبكة، packaging، update channel، وsecurity model. كما يلزم مثال extension صغير يعمل على نسخة OpenTo مستهدفة.

## adapter contract المؤقت

```ts
interface OpenToAdapter {
  detect(): Promise<{ installed: boolean; version?: string; evidence: string[] }>
  getCapabilities(): Promise<OpenToCapabilities>
  openProject(input: { path: string }): Promise<OpenToProject>
  sendCommand(input: OpenToCommand): Promise<OpenToResult>
  subscribeEvents(handler: (event: OpenToEvent) => void): Disposable
}
```

الـ default implementation لا يشغل أي شيء ويعيد `NOT_CONFIGURED`. أي implementation حقيقي يجب أن يمر بـ contract tests على كل إصدار/نظام مستهدف. لا يحق لـ agent استدعاء adapter غير healthy.

## مقارنة desktop shell

| الخيار | نقاط القوة | نقاط الضعف | القرار |
|---|---|---|---|
| Electron | Chromium ثابت، Node، IPC، PTY، ecosystem؛ مثبت في OpenCode/Hermes [1] [2] | حجم وRAM أكبر، مسؤولية hardening | MVP |
| Tauri | أصغر، WebView النظام، Rust security boundary [3] | اختلاف WebView، Rust، تكامل runtimes يحتاج sidecars | V1/V2 benchmark |
| Native Windows | تكامل أصلي قوي | يضيق cross-platform ويزيد تكلفة فريق متعدد الأنظمة | ليس MVP |
| Web/PWA | نشر سهل | filesystem/terminal/offline محدود | companion لا shell رئيسي |

## استراتيجية التوافق

يبقى OpenTo integration خلف adapter، ولا تتسرب أنواع OpenTo إلى core. يستخدم process bridge إن كان OpenTo يوفر CLI/stdio، أو IPC إن كانت مواصفته تسمح. لا يعتمد التطبيق على private APIs أو screen scraping. إذا ثبت أن OpenTo لا يملك extension API، يتحول التكامل إلى file/project import مع user-visible limitations.

## بوابات القرار

لا يبدأ تنفيذ التكامل إلا بعد: (1) مصدر رسمي، (2) proof-of-concept read-only، (3) توثيق permissions، (4) smoke test على Windows، (5) failure/recovery contract، و(6) مراجعة أمنية. حتى ذلك الوقت، يُسمح فقط بتطوير core المستقل.

## المراجع العامة للمقارنة

[1]: https://github.com/anomalyco/opencode/blob/dev/packages/desktop/package.json "OpenCode desktop manifest"
[2]: https://github.com/NousResearch/hermes-agent/blob/main/apps/desktop/package.json "Hermes desktop manifest"
[3]: https://v2.tauri.app/concept/architecture/ "Tauri Architecture"
[4]: https://electronjs.org/docs/latest/tutorial/process-model "Electron Process Model"
[5]: https://www.electronjs.org/docs/latest/tutorial/security "Electron Security"

إعداد: Manus AI. تاريخ الفحص: 2026-08-21.
