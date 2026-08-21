# SECURITY_MAP

| السطح | التهديد | الضبط | اختبار مطلوب |
|---|---|---|---|
| Renderer/IPC | RCE/XSS | context isolation، typed preload، CSP، sender validation | IPC fuzz/sender tests |
| Agent content | prompt injection | data/instruction boundary وapproval | malicious fixture |
| Terminal/filesystem | destructive/exfiltration | roots، allowlist/denylist، timeout، sandbox | policy tests |
| MCP/plugins | tool compromise | manifest، scopes، consent، lifecycle | permission contract |
| Secrets | token leakage | OS secret store، redaction، no logs/backups | secret scan/redaction |
| Dependencies | supply-chain/license | lockfiles، SBOM، Gitleaks/Trivy/Scorecard | CI security |
| Mobile tooling | hostile scripts/native builds | doctor، isolated process، no auto postinstall | build sandbox |
| Preview/AI visual loop | infinite modification | max iterations/diff budget/approval | bounded-loop test |

المصدر الأساسي: `docs/17-security-model.md`.
