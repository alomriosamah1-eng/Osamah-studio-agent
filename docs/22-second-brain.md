# Second Brain

## الوظيفة

Second Brain ليس تطبيق Notes منفصلًا، بل طبقة معرفة مرتبطة بالـ workspace. كل project وtask وdocument وdecision وresearch source يمكن أن يصبح node قابلاً للبحث والربط، مع فصل واضح بين raw source وsummary وhuman-confirmed fact.

## المجالات

يدعم النموذج tasks، projects، goals، notes، documents، learning، ideas، research، calendar hooks، habits، وpersonal planning تدريجيًا. لا تدخل finance أو health أو sensitive domains في MVP إلا كـ generic records مع privacy policy، لأن النظام ليس مستشارًا طبيًا أو ماليًا.

## دورة المعرفة

```mermaid
flowchart LR
  Capture[Capture note/file/task] --> Parse[Parse + classify]
  Parse --> Link[Link to project/source]
  Link --> Index[FTS/vector index]
  Index --> Retrieve[Agent retrieval]
  Retrieve --> Produce[Report/task/action]
  Produce --> Review[Human review]
  Review --> Consolidate[Memory consolidation]
```

## المعرفة المرتبطة بالفعل

عند إنشاء مشروع، يحصل agent على project brief وpolicy. عند إضافة document، ينشئ النظام extraction job ويعرض source. عند إنشاء task، يمكن agent اقتراح خطة لكنه لا ينفذ تلقائيًا. عند إنتاج report، يسحب Studio source registry وcitations. عند تعلم شيء، يحفظه كملاحظة مع provenance.

## الرسوم والروابط

يستطيع المستخدم ربط note بـ task أو file أو session أو decision. لا يُفترض أن graph database ضرورية؛ relational links وFTS كافية في MVP. يضاف Graphiti أو graph store بعد benchmark إذا أصبحت temporal relationships مفيدة [1].

## الخصوصية

لكل item scope وvisibility وretention. يحدد المستخدم ما إذا كان searchable للوكيل وما إذا كان قابلاً للإرسال إلى provider. الحذف يجب أن يزيل الفهرس والـ embeddings والنسخ المؤقتة.

## مراجع البدائل

تستفيد الدراسة من مبادئ Logseq وAppFlowy، لكن كلاهما AGPL-3.0 حسب metadata وقت الفحص؛ لذلك يُستفاد من UX ideas لا من core code دون مراجعة [2] [3]. Mem0 وGraphiti مرشحان كproviders قابلين للعزل [4] [5].

## مراجع

[1]: https://github.com/getzep/graphiti "Graphiti repository"
[2]: https://github.com/logseq/logseq "Logseq repository"
[3]: https://github.com/AppFlowy-IO/AppFlowy "AppFlowy repository"
[4]: https://github.com/mem0ai/mem0 "Mem0 repository"
[5]: https://github.com/volcengine/OpenViking "OpenViking repository"

إعداد: Manus AI. تاريخ الفحص: 2026-08-21.
