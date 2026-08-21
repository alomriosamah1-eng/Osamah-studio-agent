# خارطة الطريق

## Phase 0 — Discovery

الهدف تثبيت الهوية والحدود والمصادر. المخرجات هي هذه الوثائق، OpenTo evidence، technology matrix، risk register، وMVP definition. معيار القبول هو أن يقرأ مهندس جديد المشروع دون إعادة البحث. التعقيد متوسط؛ الخطر الأكبر هو اتساع النطاق.

## Phase 1 — Foundation

إنشاء monorepo بسيط، Electron shell، React/Solid UI، TypeScript contracts، Python/Node worker bridge، SQLite migrations، logging، config، وCI skeleton. يعتمد على قرار desktop. القبول: فتح workspace وتشغيل smoke test. التعقيد متوسط.

## Phase 2 — Core AI Runtime

بناء session/event model، agent loop محدود، provider registry، tool registry، policy/approval، context budget، وlocal provider adapter. القبول: read-only task ورفض write غير المعتمد. التعقيد عالٍ.

## Phase 3 — Agent Organization

إضافة task DAG، supervisor، workers، validator، critic، judge، checkpoints، queue، وrecovery. القبول: workflow بثلاث خطوات مع فشل وإعادة. التعقيد عالٍ.

## Phase 4 — Development Environment

Monaco، terminal، Git diff، test runner، skill registry، وproject conventions. القبول: تعديل صغير مع diff/test/rollback. التعقيد عالٍ.

## Phase 5 — Production Studio

Markdown/PDF أولًا، ثم DOCX/PPTX، ثم images/media. القبول: report موثق قابل للتصدير مع render check. التعقيد عالٍ.

## Phase 6 — Second Brain

Notes/tasks/projects، FTS5، memory scopes، source registry، optional embeddings. القبول: إضافة ملاحظة واسترجاعها من agent دون تسريب scope. التعقيد متوسط-عالٍ.

## Phase 7 — Voice

VAD، STT، TTS، streaming، barge-in، العربية/الإنجليزية. القبول: benchmark offline وpermission/deletion. التعقيد عالٍ.

## Phase 8 — Automation

Manual/assisted workflows، schedule، event triggers، approvals، pause/recovery. القبول: job مجدول محدود لا يتكرر بلا نهاية. التعقيد عالٍ.

## Phase 9 — Optimization

benchmarks، lazy loading، caching، compression، memory/GPU governor. القبول: NFR targets وregression history. التعقيد متوسط.

## Phase 10 — Security Hardening

Threat tests، sandbox، secrets، MCP consent، supply chain، SBOM، incident playbook. القبول: critical threats covered ولا secrets في repo. التعقيد عالٍ.

## Phase 11 — CI/CD

Windows/Linux build، optional macOS، signed artifacts، release workflows، migrations، docs gates. القبول: clean install وsmoke test وhash verification. التعقيد عالٍ.

## Phase 12 — Release

Beta pilot، telemetry opt-in، support docs، rollback، compatibility matrix، ثم release. القبول: user acceptance وno known critical blocker. التعقيد عالٍ.

## تقدير نسبي

لا يُحدد زمن تقويمي قبل معرفة حجم الفريق وOpenTo. من حيث person-weeks، Foundation 4–8، Core 8–16، Development 8–16، Studio 8–20، Brain 6–12، Voice 8–20، Automation 8–16، Security/CI/Release 8–16. هذه تقديرات **HYPOTHESIS** لتخطيط السعة وليست التزامًا زمنيًا.

إعداد: Manus AI. تاريخ الفحص: 2026-08-21.
