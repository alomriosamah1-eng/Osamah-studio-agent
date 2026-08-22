# عقد تشغيل مشروع الهاتف داخل Embedded Preview

## الهدف

ينتقل المحاكي من شاشة ثابتة إلى تشغيل **Project Preview Bundle** مشتق من ملفات مشروع الهاتف. لا يعني ذلك تنفيذ native modules داخل Web؛ بل يعني تحليل project manifest، تحويل entry code إلى preview-compatible module graph عند توفر adapter، ثم تشغيله داخل runtime مع device profile وdiagnostics واضحة.

## Project Preview Bundle

```ts
interface ProjectPreviewBundle {
  readonly projectId: string;
  readonly entry: string;
  readonly sourceHash: string;
  readonly modules: readonly PreviewModule[];
  readonly assets: readonly PreviewAsset[];
  readonly warnings: readonly CompatibilityWarning[];
  readonly capabilities: readonly string[];
}
```

كل module يملك `id`, `source`, `sourceMap?`, `dependencies`, و`format`. لا تُنفذ ملفات خارج root، ولا تُحل حزم غير مدرجة في manifest. يتم رفض package scripts وnative postinstall تلقائيًا. asset paths تُقيد إلى project root ويُحظر traversal.

## Preview Runtime

`PreviewRuntime` مسؤول عن تحميل bundle وعرضه عبر compatibility renderer، استقبال input، وإرجاع `PreviewEvent` و`PreviewDiagnostic`. runtime لا يملك filesystem ولا child process. الـ controller ينسق lifecycle، والـ IPC ينقل commands/events، وrenderer يعرض state فقط.

| الحالة | المعنى | الانتقال التالي |
|---|---|---|
| `created` | bundle لم يُحمّل | `loading` |
| `loading` | تحليل/تحميل آمن | `ready` أو `failed` |
| `ready` | التطبيق ظاهر | `refreshing`/`stopping` |
| `refreshing` | patch/HMR bounded | `ready` أو `reloading` |
| `reloading` | إعادة تشغيل bundle | `ready` أو `failed` |
| `failed` | diagnostics متاحة | `loading` أو `stopped` |
| `stopped` | لا runtime فعال | `loading` |

## Renderer strategy

الشريحة الحالية تستخدم **fixture renderer** deterministic يقرأ ProjectPreviewBundle ويعرض مجموعة UI primitives آمنة مثل View/Text/Card/Status/Stack. عند إضافة React Native Web، يُستبدل renderer خلف نفس العقد ولا تتغير Domain/IPC. هذا يضمن أن المحاكي المدمج يعمل حتى قبل تنزيل React packages أو تشغيل Metro.

## Compatibility warnings

يُصنف كل import أو API إلى `supported`, `web_compatible`, `native_only`, أو `blocked`. `native_only` يظهر warning ويتحول إلى fallback أو placeholder. `blocked` يفشل التحميل قبل التنفيذ. لا تُخفى warnings عن المستخدم أو الوكيل.

## Refresh

`fast` يعيد بناء modules المتغيرة فقط عندما لا تتغير exports أو native capability. `reload` يعيد bundle كاملًا ويعيد state إلى initial. كل refresh له `refreshId`, sourceHash قبل/بعد، duration، وwarnings. الحد الأقصى للمحاولات يطبق من Resource Manager لاحقًا.

## معايير القبول

تُقبل الشريحة عندما يقرأ runtime fixture project من root معروف، يبني bundle deterministic، يعرضه داخل embedded simulator، يغير output عند تعديل fixture، يسجل source hash وdiagnostics، ويرفض path traversal وnative-only/blocked imports وفق policy. لا يُسمح بإيهام المستخدم بأن fixture renderer هو React Native native runtime.

## References

[1]: ./39-embedded-simulator-architecture.md "Embedded Simulator Architecture"
[2]: ./40-embedded-simulator-implementation.md "Embedded Simulator Implementation"
[3]: https://necolas.github.io/react-native-web/docs/ "React Native for Web"
[4]: https://reactnative.dev/docs/fast-refresh "Fast Refresh"

إعداد: Manus AI. تاريخ التحديث: 2026-08-22.
