# Second Brain: Memory Capture وKnowledge Entry Review

**الحالة:** منفذة ومدفوعة ومتحقق منها عند feature `39bd89c7f4242abab76fd624045b493b72e48088`، ثم أضيفت لها persistence اختيارية ومحدودة في feature `48daaf1f83bbc4cc7f01ff2a4e873c5e1a9a31ad`. تضيف الشريحة التقاط معرفة محليًا ومراجعة entry bounded؛ ويمكن لملف SQLite المفعّل حفظ الـentries واستعادتها بعد restart، بينما يبقى backend الافتراضي in-memory. لا تبني embeddings أو FTS أو مزامنة network أو autosave من renderer.

## الغرض

Second Brain في Osamah Studio Agent هو طبقة معرفة مرتبطة بالمشروع وليست دفتر Notes منفصلًا. تبدأ هذه الشريحة بأصغر مسار آمن: إنشاء `MemoryEntry` من نص يقدمه المستخدم أو من artifact/source references مع تصنيف يدوي أو deterministic، ثم عرضه للمراجعة قبل الحفظ الدائم أو الإتاحة للوكيل. لا تُستنتج `FACT` من citation أو provider output تلقائيًا، ولا تُرسل entry إلى provider إلا في مسار صريح لاحقًا.

تستخدم الشريحة مفاهيم `SourceRegistry` و`ProvenanceLink` القائمة، لكنها لا تنسخ raw source ولا تفتح locator ولا تحفظ محتوى workspace تلقائيًا. كل entry يعلن visibility وsearchability وprovider sharing policy وretention بصورة صريحة.

## حدود النموذج

| الحقل | السياسة |
|---|---|
| `kind` | `note` أو `decision` أو `task` أو `research` أو `learning` أو `idea` أو `summary` |
| `state` | `draft` أو `review_required` أو `confirmed` أو `archived`؛ الإنشاء يبدأ بـ`review_required` |
| `visibility` | `private` أو `workspace` أو `project` |
| `providerAccess` | `never` أو `explicit_only`؛ الافتراضي `never` |
| `retention` | `session` أو `project` أو `until_deleted` |
| `content` | نص bounded، redacted قبل التخزين، بلا binary أو raw secret-shaped values |
| `provenance` | IDs معروفة فقط إلى Source/Artifact/Task references؛ لا locator حر من renderer |

لا يسمح `MemoryEntry` بأكثر من 128 tag، أو 32 relation، أو 16 provenance links، أو 64 KiB من النص قبل redaction. العناوين والأنواع والـIDs محدودة الطول. entry التي تتضمن secret-shaped value تُرفض إذا بقي السر بعد redaction أو تُحفظ بنسخة redacted واضحة حسب سياسة `agent-contracts` المشتركة.

## Application ports

```ts
export interface MemoryEntry {
  readonly entryId: string;
  readonly kind: MemoryEntryKind;
  readonly title: string;
  readonly content: string;
  readonly state: "review_required" | "confirmed" | "archived";
  readonly visibility: "private" | "workspace" | "project";
  readonly providerAccess: "never" | "explicit_only";
  readonly retention: "session" | "project" | "until_deleted";
  readonly tags: readonly string[];
  readonly provenance: readonly ProvenanceRef[];
  readonly warnings: readonly string[];
  readonly createdAt: string;
}

export interface MemoryCapturePort {
  capture(request: CaptureMemoryRequest): MemoryEntry;
  get(entryId: string): MemoryEntry | undefined;
  list(limit?: number): readonly MemoryEntry[];
  searchLocal(query: string, limit?: number): readonly MemoryEntry[];
}
```

الـadapter الأول `InMemoryMemoryCapture` ما يزال deterministic وbounded، ويقبل `MemoryEntryPersistencePort` اختياريًا. عند اختيار SQLite profile فقط تُحفظ الإدخالات المنقحة في جدول `memory_entries` وتُعاد hydration عند restart؛ وعند عدم اختيار SQLite لا يوجد persistence. `searchLocal` بحث نصي محلي bounded في الذاكرة؛ يطبع العربية والإنجليزية، يشترط تطابق جميع كلمات الاستعلام، ويرتب title/tag/content ترتيبًا deterministic. لا يستدعي provider أو vector database، ولا تمثل هذه الإضافة FTS أو semantic retrieval. التفاصيل في `docs/92-memory-local-retrieval-bounded.md`.

## Provenance ودرجة اليقين

الـentry قد ترتبط بـ`sourceId` أو `artifactId` أو `taskId`، لكن هذه الروابط لا تغيّر `state` إلى `confirmed`. `confirmed` يحتاج إجراء مستخدم صريح في شريحة مستقلة؛ لا تضيف هذه الشريحة mutation تلقائية أو approval ticket، وسيكون confirmation نفسه مراجعة بشرية typed لاحقًا. أي summary يحتفظ بتحذير أنه summary وليس fact إذا لم توجد provenance مؤكدة.

لا تحفظ الخدمة root paths المطلقة أو محتوى ملفات المشروع من دون طلب صريح. عند الربط بمصدر محلي يحتفظ entry بالمعرف وrelative label المسموح، ويمنع absolute path و`..` وNUL. لا تُسجّل النصوص الخام في logs أو audit events؛ تُستخدم redaction مشتركة وdigest عند الحاجة.

## Presentation وIPC

يضاف typed IPC مثل `brain.memory.capture`, `brain.memory.get`, `brain.memory.list`, و`brain.memory.searchLocal`. validators ترفض enum غير معروف، النص الفارغ، القوائم المكررة، الـIDs غير الآمنة، القيم غير bounded، وحقولًا تنفيذية مثل `provider`, `send`, `embed`, `persist`, و`execute`. renderer يحصل على projection آمن للـentry ويعرض content bounded عبر `textContent`، مع شارة واضحة `review_required` و`providerAccess=never`.

واجهة Second Brain تعرض capture form، قائمة entries، search محلي، tags، provenance IDs، والتحذيرات. زر capture هو إنشاء reviewable entry محليًا، وليس autosave عالميًا أو إرسالًا للوكيل. لا تظهر في هذه الشريحة أزرار confirm/share/embed/delete الدائم حتى تُعرّف عقود Human Review وretention لاحقًا.

## الاختبارات وبوابة الخروج

تثبت اختبارات Application حدود الطول والقوائم والـredaction والـprovenance unknown IDs والبحث المحلي وdeduplication وعدم mutation. تثبت اختبارات IPC أن malformed payload يفشل قبل Application، وأن `providerAccess=never` لا يستدعي provider، وأن entry لا تكتب ملفات ولا تنشئ approval ticket ولا network request. يثبت Electron smoke capture/list/search وsafe rendering، ويقاس الأداء تحت `low_memory` مع إبقاء الإدخالات والنتائج bounded.

أصبحت SQLite persistence الاختيارية المحدودة لـ`MemoryEntry` منفذة عبر migration 005، مع بقاء FTS5/vector embeddings وGraphiti/Mem0/OpenViking providers وsemantic retrieval وautomatic consolidation وprovider sharing شِرائح لاحقة. Human confirmation هو review محلي صريح ولا يتحول إلى تحقق خارجي. لا يُسمح لهذه الشريحة أن تتحول إلى خدمة ذاكرة خفية أو قناة exfiltration.

إعداد: Manus AI. تاريخ التحديث: 2026-08-22.
