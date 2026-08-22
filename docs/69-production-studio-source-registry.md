# Production Studio: Source Registry وProvenance

**الحالة:** منفذة ومدفوعة ومتحقق منها عند feature `fc738f4c89ce5f5df54c6fdbee9f302e13285f7c`؛ docs-close مستقل ويحدّث summaries فقط. لا توجد دعوى بأن التوقيع أو التحقق الإعلامي الكامل منفذ.

## القرار

تبدأ Production Studio بـ`SourceRegistry` محلي محدود يحفظ هوية المصادر وhash وmetadata ومواضع الاستشهاد وروابط provenance القابلة للمراجعة. لا يبدأ النظام web crawling أو network discovery عند startup، ولا يستورد أسرارًا أو auth headers إلى السجل، ولا يعامل المصدر أو النص المستخرج أو claim الوارد من webpage أو PDF أو نموذج على أنه حقيقة موثوقة دون `verificationState` صريح.

يستعير التصميم مفاهيم W3C PROV-DM التي تميز بين entity وactivity وagent وعلاقات الاشتقاق والاستخدام والمسؤولية، مع إبقاء التخزين الداخلي أبسط من PROV graph وقابلًا للتحويل مستقبلًا [1]. ويستعير من C2PA مبدأ manifest/hash/content binding وvalidation states للمخرجات الإعلامية، دون تنفيذ C2PA signatures أو key management أو trust lists في هذه الشريحة [2].

> **قاعدة provenance:** وجود source record أو citation لا يثبت صحة الادعاء. السجل يثبت ما التقطه النظام، ومن أي locator، وبأي hash وزمن وحالة تحقق، لا صحة المحتوى بذاته.

## الحدود والنطاق

النطاق الأول هو تسجيل مصدر أضافه المستخدم أو التقطه adapter محلي صريح، وعرض metadata وpreview bounded وربط citation بمصدر. يشمل ذلك الملفات المحلية التي يسمح بها المستخدم، والنصوص التي تدخل عبر surface typed لاحقًا، ومرجع URL لا يُجلب تلقائيًا في هذه الشريحة. لا يشمل web search أو browser automation أو PDF parsing غير المحدود أو media publishing أو C2PA signing أو embedding أو vector indexing أو FTS5.

| القرار | النتيجة |
|---|---|
| مصدر الحقيقة | SQLite/port لاحقًا، مع in-memory adapter في أول تنفيذ |
| التشغيل الافتراضي | local-only، offline، لا startup ingest ولا network |
| تعريف المصدر | `SourceRecord` مستقل عن artifact وclaim وcitation |
| سلامة المحتوى | SHA-256 وbytes وcapture timestamp عند توفر المحتوى |
| الثقة | `unverified` افتراضيًا، مع حالات validation صريحة |
| العرض | metadata وpreview محدود فقط؛ المحتوى الكامل ليس IPC default |
| provenance | روابط مشتقة bounded، قابلة للمراجعة وليست authorization |
| التصدير | مؤجل؛ أي export لاحق يمر بسياسة ومراجعة، وقد يضيف manifest |
| secrets | لا auth headers أو tokens أو private keys أو model weights في السجل أو logs |

## الطبقات

يتبع التنفيذ Clean Architecture الحالية. يعرّف Domain/Application الأنواع والـports فقط. ينفذ Infrastructure لاحقًا adapters للملف المحلي وSQLite، بينما يربط IPC methods validators وhandlers ويعرض Presentation قائمة المصادر والاستشهادات باستخدام DOM آمن. لا يعتمد Source Registry على Electron أو `fs` أو `fetch` في Application، ولا يستدعي Agent Runtime أو Provider Gateway تلقائيًا.

```text
Production Studio UI
        │ typed preload / IPC
Source Registry IPC handlers
        │ validated request/result
SourceRegistryPort + CitationPort
        │
In-memory bounded adapter  →  لاحقًا SQLite repository
        │
Provenance records / hashes / validation states
```

## نموذج البيانات الأولي

```ts
export type SourceKind = "local_file" | "user_url" | "generated_artifact" | "workspace_document";
export type SourceVerificationState = "unverified" | "metadata_validated" | "content_validated" | "invalid";

export interface SourceRecord {
  readonly sourceId: string;
  readonly kind: SourceKind;
  readonly locator: string;
  readonly title?: string;
  readonly contentType?: string;
  readonly bytes?: number;
  readonly sha256?: string;
  readonly capturedAt: string;
  readonly verificationState: SourceVerificationState;
  readonly warnings: readonly string[];
}

export interface CitationRecord {
  readonly citationId: string;
  readonly sourceId: string;
  readonly label: string;
  readonly span?: { readonly start: number; readonly end: number };
  readonly page?: number;
  readonly section?: string;
  readonly quotePreview?: string;
  readonly verificationState: SourceVerificationState;
}

export interface ProvenanceLink {
  readonly linkId: string;
  readonly fromId: string;
  readonly toId: string;
  readonly relation: "derived_from" | "used" | "generated_by" | "attributed_to";
  readonly activityId?: string;
  readonly createdAt: string;
  readonly evidence: readonly string[];
}
```

تُراجع هذه الأنواع قبل التنفيذ النهائي؛ لا يجوز إضافة locator raw أو quote غير bounded أو content كامل إلى نتيجة IPC دون سبب واضح. يجب أن تكون كل string قابلة للتنظيف والحد، وأن ترفض IDs والمسارات والـspans غير الصحيحة fail-closed. `verificationState` لا يساوي `accepted` في Production Studio؛ القبول التحريري أو القانوني أو العلمي مسار مراجعة مستقل.

## Port وعمليات المراجعة

يبدأ port بالعمليات التالية: `registerSource` لتسجيل metadata أضافها المستخدم، `getSource` للقراءة، `listSources` بحد، `addCitation` لربط استشهاد موجود بمصدر، و`listCitations` لمصدر محدد. لا يتضمن port `crawl` أو `download` أو `publish` أو `sign` أو `deleteAll` أو أي عملية صامتة. إن احتاج مصدر محلي إلى hashing، يكون ذلك داخل adapter bounded وبإدخال صريح، مع رفض الملفات الكبيرة أو الثنائية حسب ResourcePolicy.

تتضمن نتيجة كل عملية `warnings` و`truncated` عند الحاجة. لا تُخفى حالة عدم توفر المحتوى خلف عنوان أو hash قديم، ولا يكتب registry إلى user project files. الحذف المستقبلي يجب أن يزيل citations وprovenance links التابعة وفق retention policy، لكن لا يدخل delete في أول read/review slice إلا بعقد مستقل ومراجعة صريحة.

## provenance وC2PA مستقبلًا

يُستخدم `SourceRecord` و`CitationRecord` كطبقة داخلية مفيدة قبل بناء artifact. عند إنتاج مستند أو صورة أو عرض يمكن لاحقًا بناء manifest يربط artifact بالـsources والأنشطة والـagent والـhash. لكن signature، signer identity، trust list، tamper validation، وembedding في asset تتطلب تصميمًا منفصلًا، ولا يجوز تسميتها Content Credentials مكتملة في النسخة الحالية. استنادًا إلى C2PA، يجب فصل claim عن assertions وربط المحتوى بالhash قبل إعلان validation [2].

وبالمثل، لا يفرض النظام PROV-O أو RDF في SQLite الأولى. إذا احتجنا interoperability لاحقًا، يمكن تصدير mapping من records الداخلية إلى PROV entities/activities/agents بعد إضافة schema version وmigration واختبارات round-trip، دون جعل graph الخارجي مصدر الحقيقة [1].

## الخصوصية والأمان

الـlocator المحلي يُحفظ كمرجع قابل للعرض بعد redaction أو projection مناسب، ولا تُرسل absolute user root أو private path إلى renderer إلا إذا كان ذلك ضروريًا. URLs التي يضيفها المستخدم تُعامل كبيانات غير موثوقة؛ لا تتحول إلى fetch instruction. النصوص والاقتباسات والمصادر تعرض عبر `textContent`، ويجب قص quote preview لمنع تضخم الذاكرة أو حقن HTML. لا تُحفظ cookies أو authorization headers أو query secrets، ولا يجري probing أو browser login أو upload في هذه الشريحة.

## بوابة الخروج

لا تنتقل الشريحة إلى IPC قبل نجاح عقود Application وin-memory adapter: duplicate source handling، stable hash/bytes، bounded warnings، citation span validation، missing-source rejection، verification-state preservation، وno-network/no-filesystem-mutation tests. ولا تنتقل إلى Production artifact pipeline قبل إثبات أن source/citation/provenance records قابلة للمراجعة وأن كل claim غير موثق يبقى معلّمًا بوضوح.

## المراجع

[1]: https://www.w3.org/TR/prov-dm/ "W3C PROV-DM: The PROV Data Model"

[2]: https://spec.c2pa.org/specifications/specifications/2.4/specs/C2PA_Specification.html "C2PA Technical Specification 2.4"
