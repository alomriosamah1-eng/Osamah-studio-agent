# Production Studio Provenance Research — 2026-08-22

## W3C PROV-DM

المصدر: [W3C PROV-DM](https://www.w3.org/TR/prov-dm/).

تعرّف مواصفة PROV-DM provenance بوصفها معلومات عن الكيانات والأنشطة والأشخاص المشاركين في إنتاج بيانات أو شيء، بما يدعم تقييم الجودة والموثوقية والثقة. تميز المواصفة بين `Entity` و`Activity` و`Agent`، وتصف علاقات مثل `used` و`wasGeneratedBy` و`wasDerivedFrom` و`wasAttributedTo`. النموذج عام المجال وقابل للتوسعة، ويمكن استخدامه لتتبع اشتقاق artifact أو claim من source وعملية إنتاج وagent دون أن يصبح شكل التخزين الداخلي للمشروع هو نفسه معيار التبادل.

قرار للاستخدام المحلي: نستخدم المفاهيم كإلهام لعقود `SourceRecord` و`CitationRecord` و`ProvenanceLink`، لكن لا نضيف OWL/RDF أو graph database في هذه الشريحة. يجب أن تكون كل علاقة مشتقة قابلة للعرض، وبـsource hash ووقت الالتقاط وسبب القراءة، ولا تعتبر provenance assertion حقيقة موثوقة لمجرد وجودها.

## C2PA Content Credentials

المصدر: [C2PA Technical Specification 2.4](https://spec.c2pa.org/specifications/specifications/2.4/specs/C2PA_Specification.html).

تصف مواصفة C2PA manifest موقّعًا رقميًا يحوي assertions عن provenance الخاصة بـasset، مع claim مقاوم للعبث يربط assertions بالمحتوى عبر content bindings. يمكن أن تتسلسل manifests وتشير إلى manifests أخرى، وتوجد عمليات تحقق منفصلة للتوقيع وهوية الموقّع وصحة assertions وhashes وtime-stamps وasset references. تؤكد المواصفة قابلية التوسع، ولا يعني وجود assertion وحده أن كل معلومة موثوقة cryptographically.

قرار للاستخدام المحلي: نأخذ مبدأ manifest/hash/validation كاتجاه لاحق لمخرجات Production Studio الإعلامية. في Source Registry الأولى نكتفي بـcontent hash وsource identity وcapture metadata وprovenance status وvalidation warnings، ولا ننفذ توقيع C2PA أو key management أو publish/export تلقائيًا. أي claim أو citation يبقى `unverified` حتى ينجح validation مناسب، ولا يتحول UNKNOWN إلى FACT.

## التصميم المستنتج للشريحة

سيكون `SourceRegistryPort` مسؤولًا عن التسجيل والقراءة والبحث المحدود في المصادر المحلية أو التي يضيفها المستخدم صراحةً، وليس عن web crawling أو network discovery عند startup. يحتوي المصدر على identity آمنة، kind، locator غير سري، content hash إن توفر، byte count bounded، capture time، status، وprovenance warnings. يربط `CitationRecord` موضع claim بمصدر وsource span أو صفحة/فقرة إن كانت متاحة، مع `verificationState` صريح.

تظل الملفات والمحتويات الكبيرة خارج IPC المباشر؛ يعاد إلى renderer metadata وhash وpreview bounded بعد طلب صريح. لا تُحفظ secrets أو auth headers أو user files غير المطلوبة في logs أو Git. كل ingest أو export لاحق يحتاج policy/consent وHuman Gate المناسب، بينما التسجيل المحلي الأولي read/review-only.
