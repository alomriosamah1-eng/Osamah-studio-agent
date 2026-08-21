# القرارات المعمارية

هذا الملف ملخص تنفيذي؛ التفاصيل والبدائل في `docs/27-technology-decision-records.md`.

| القرار | الحالة | سبب مختصر |
|---|---|---|
| Modular monolith + process isolation | مقترح معتمد | يقلل تعقيد microservices ويحمي UI من workers |
| Electron لـ MVP | مقترح معتمد مؤقتًا | ecosystem وPTY وcross-platform patterns مثبتة |
| SQLite + FTS5 | معتمد لـ MVP | local-first، portability، backup |
| Provider registry/routing | معتمد | free/local-first، failover، لا lock-in |
| MCP خلف policy/consent | معتمد | الأدوات تنفيذ كود ويجب أن تكون user-controlled |
| OpenTo adapter only | blocked | لا يوجد مصدر رسمي قابل للتحقق |
| 70 agent definitions مع cap | معتمد | يوازن التخصص والموارد |
| Voice optional | معتمد | جودة العربية والتراخيص والموارد غير محسومة |
| Markdown/PDF قبل DOCX/PPTX/video | معتمد | أصغر slice إنتاجي قابل للتحقق |
| No full fork of references | معتمد | تقليل coupling والمخاطر القانونية والصيانة |

آخر تحديث: 2026-08-21.
إعداد: Manus AI.
