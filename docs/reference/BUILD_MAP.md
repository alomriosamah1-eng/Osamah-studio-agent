# BUILD_MAP

## Current

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm check
pnpm build
pnpm desktop:smoke
python3 scripts/validate_sqlite_migration.py
```

## Planned

Foundation → Embedded Studio/Simulator controller → typed IPC → Electron shell + typed preload + desktop smoke → SQLite adapter → worker packaging → Metro adapter → Android doctor/build/run → macOS Xcode adapter → signed CI artifacts. Windows/Linux لا يقدمان iOS Simulator native؛ remote/EAS وphysical device مسارات بديلة.

كل build يجب أن يسجل git SHA وruntime versions وartifact hashes وschema version، ويعمل في clean checkout قبل release.
