#!/usr/bin/env bash
set -euo pipefail

printf '%s\n' 'AUDIT_GATE_START'
pnpm check
pnpm build
pnpm desktop:smoke
pnpm performance:smoke
python3 scripts/validate_sqlite_migration.py
python3 -m json.tool project/master-implementation-plan.json >/dev/null
node --check prototypes/studio/workspace.js
node --check prototypes/studio/preview-renderer.js
git diff --check

# High-confidence scan: production/config surfaces only; test fixtures and generated output are excluded.
scan_files=()
while IFS= read -r file; do
  case "$file" in
    src/*.test.ts|src/**/*.test.ts|fixtures/*|dist/*|research/*|docs/*) continue ;;
    *) scan_files+=("$file") ;;
  esac
done < <(git ls-files -- 'src/**' 'scripts/**' 'project/**' 'db/**' 'prototypes/**' 'package.json' 'pnpm-lock.yaml' '.github/**')

if ((${#scan_files[@]} > 0)) && grep -nHE 'sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|AIza[0-9A-Za-z_-]{30,}|-----BEGIN (RSA|EC|OPENSSH|DSA|PGP) PRIVATE KEY-----|Authorization:[[:space:]]*Bearer[[:space:]]+[A-Za-z0-9._-]{20,}' "${scan_files[@]}"; then
  printf '%s\n' 'SECRET_SCAN=FAIL'
  exit 1
fi
printf '%s\n' 'SECRET_SCAN=PASS'
printf '%s\n' 'AUDIT_GATE=PASS'
