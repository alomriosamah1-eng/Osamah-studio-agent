# SYSTEM_MAP

## النظام

Osamah Studio Agent منصة Desktop local-first. الحالة الفعلية الحالية هي Foundation slice في TypeScript دون Electron أو runtime native. الطبقات المستهدفة هي Domain، Application، Interface Adapters، Infrastructure، Presentation.

| المسار | الحالة الحالية | المصدر |
|---|---|---|
| Domain primitives/entities/events | منفذ ومختبر | `src/domain/` |
| Application ports/use cases | منفذ ومختبر | `src/application/` |
| In-memory infrastructure | منفذ ومختبر | `src/infrastructure/` |
| Desktop shell/IPC | مخطط فقط | `docs/06`, `docs/34` |
| Mobile preview | domain lifecycle فقط | `docs/33`, `src/domain/entities.ts` |
| SQLite/Git/provider/Metro/ADB/Xcode | ports/architecture فقط | `docs/10`, `docs/33`, `docs/34` |

القاعدة: لا يحق لأي واجهة أو adapter تجاوز Application إلى concrete infrastructure.

آخر تحديث: 2026-08-22.
