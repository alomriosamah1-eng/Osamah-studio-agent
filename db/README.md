# Database Contract

`migrations/001_initial.sql` هو schema contract للشريحة الأولى. يطبق داخل transaction، ويسجل `schema_version=001` في `schema_meta`. لا يجوز تعديل migration بعد نشرها؛ يضاف ملف رقمي جديد مع checksum في طبقة migrator لاحقًا.

هذه المرحلة لا تضيف native SQLite dependency. يمر التخزين الفعلي لاحقًا عبر `SqlExecutor` port مع adapter يختاره المشروع بعد مراجعة build/licensing. Domain/Application لا يستوردان driver.

## الجداول

`workspaces` و`sessions` و`approvals` تغطي الحالة الحالية. `jobs` و`artifacts` و`domain_events` تمهد للتشغيل والتدقيق والاستعادة. لا تخزن الجداول secrets أو prompts كاملة أو tokens.

## قبول migration

يجب أن يمر الملف على SQLite parser داخل CI، وأن يرفض checksum mismatch، وأن تُنسخ قاعدة المستخدم احتياطيًا قبل migration فاشلة. لا تنفذ migration على قاعدة غير معروفة دون consent/recovery path.
