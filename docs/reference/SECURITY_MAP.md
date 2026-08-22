# SECURITY_MAP

| السطح | التهديد | الضبط | اختبار مطلوب |
|---|---|---|---|
| Renderer/IPC | RCE/XSS | context isolation، sandbox، nodeIntegration=false، typed preload، CSP، sender validation، navigation/window deny | `src/desktop/security.test.ts` وdesktop smoke |
| Agent content | prompt injection | data/instruction boundary وapproval | malicious fixture |
| Terminal/filesystem | destructive/exfiltration | roots، allowlist/denylist، timeout، sandbox | policy tests |
| MCP/plugins | tool compromise | manifest، scopes، consent، lifecycle | permission contract |
| Secrets | token leakage | OS secret store، redaction، no logs/backups | secret scan/redaction |
| Dependencies | supply-chain/license | lockfiles، SBOM، Gitleaks/Trivy/Scorecard | CI security |
| Mobile tooling | hostile scripts/native builds | doctor، isolated process، no auto postinstall | build sandbox |
| Preview/AI visual loop | infinite modification | max iterations/diff budget/approval | bounded-loop test |

المصدر الأساسي: `docs/17-security-model.md` و`docs/46-electron-shell-and-preload-implementation.md`.
