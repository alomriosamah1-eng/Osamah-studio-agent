# Audit Export وRetention Policy

**الحالة:** منفذة ومختبرة ومربوطة بالمسارين memory وSQLite عبر `createEmbeddedApplication`.

## الهدف والنطاق

تضيف هذه الشريحة مخرجًا محليًا قابلًا للمراجعة لسجلات `AuditRecord`، مع سياسة احتفاظ محافظة لا تحذف السجلات الحديثة ولا تسمح بحذف غير bounded. لا تتضمن الشريحة تشفيرًا أو توقيعًا أو hash chain؛ لذلك لا تُعامل artifact على أنها سجل قانوني tamper-evident، وتبقى تلك المتطلبات لاحقة.

| المكوّن | المسؤولية |
|---|---|
| `AuditRetentionStore` | `deleteBefore` و`deleteIds` خلف عقد Application مستقل |
| `BoundedAuditRetentionPolicy` | cutoff زمني بحد أدنى يوم واحد وحد أقصى 365 يومًا، وحد سجلات أقصى 256 |
| `AuditExportProvider` | إنشاء `audit.ndjson` وmanifest محلي bounded حتى 256 سجلًا |
| `LocalAuditExportProvider` | كتابة ذرية، SHA-256 وbyte count، redaction إضافي، ومنع destination داخل live profile |
| `InMemoryAuditTrail` و`SqliteAuditTrail` | تنفيذ الحذف المحدود مع إبقاء ترتيب newest-first |
| composition | expose لـ`auditExport` و`auditRetention` دون network أو خدمة خلفية دائمة |

## صيغة التصدير

يحتوي `audit.ndjson` على سجل JSON واحد في كل سطر، بترتيب الأحدث أولًا، وتُكتب معه `manifest.json` بالشكل التالي:

```json
{
  "formatVersion": 1,
  "createdAt": "2026-08-22T10:09:00.000Z",
  "recordCount": 2,
  "bytes": 512,
  "sha256": "<64 lowercase hexadecimal characters>",
  "relativePath": "audit.ndjson"
}
```

يُحسب digest من المحتوى النهائي للـNDJSON، وتُكتب الملفات عبر temporary path عشوائي ثم rename. يرفض provider الجذر غير الآمن، ويرفض destination المطابق أو الواقع داخل live profile عند تزويده بمسار profile المصدر. لا يُسمح بكتابة artifact فوق قاعدة SQLite الحية.

## سياسة الاحتفاظ

يستعمل `BoundedAuditRetentionPolicy.prune()` ساعة النظام من خلال `Clock`، ثم يحذف السجلات الأقدم من cutoff، وبعد ذلك يحذف overflow من أقدم السجلات إذا تجاوز العدد الحد المطلوب. العمر الأدنى المسموح به يوم واحد، والعمر الأقصى 365 يومًا، والحد الأقصى للسجلات 256. أي قيمة غير صالحة أو أقل من الحد الأدنى تفشل مغلقًا قبل الحذف.

> **قاعدة محافظة:** لا تنفذ السياسة حذفًا دوريًا تلقائيًا ولا تعمل كخدمة خلفية؛ يستدعيها مسار صريح بعد موافقة المنتج. لذلك لا توجد مفاجآت حذف عند الإقلاع، ولا حاجة إلى daemon أو persistent computing في هذه الشريحة.

## الحماية والحدود

تُعاد sanitization للـ`scope` و`reason` عند التصدير حتى لو وصل السجل من adapter غير مثالي. لا يضيف التصدير raw secrets أو user files إلى Git، ولا يقرأ ملفات خارج سجلات AuditTrail. أما manifest وSHA-256 فهما للتحقق من سلامة النقل المحلي فقط، وليسا توقيعًا من جهة موثوقة. لا توجد multi-user identity أو RBAC أو تشفير artifact.

## التحقق

| الفحص | النتيجة |
|---|---|
| `pnpm check` | `81/81` اختبارًا ناجحًا |
| export | bounded NDJSON وmanifest وSHA/bytes وredaction PASS |
| destination safety | رفض live profile والجذر المتداخل PASS |
| retention | حذف age/count bounded ورفض العمر الأقل من يوم PASS |
| performance | low-memory profile وpreview حوالي 11.68ms وRSS delta حوالي 3MB، PASS |
| migration | schema `004`، 12 جدولًا، 24 index entry، PASS |

## الخطوة التالية

بعد هذه الشريحة تنتقل الخطة إلى planner/critic contracts ثم provider adapters الفعلية، مع إبقاء FTS5 وobject store وterminal sandbox وpackaging والتشفير والـbackup UX لاحقة. يبقى Lightweight Web Preview في آخر مراحل تصميم البيئة، ولا تبدأ Android/iOS native قبل doctor/resource contracts وقياسات الموارد.

إعداد: Manus AI. تاريخ الفحص: 2026-08-22.
