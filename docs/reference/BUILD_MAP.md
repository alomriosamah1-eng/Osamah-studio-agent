# BUILD_MAP

## Current

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm check
```

## Planned

Foundation → Electron shell → worker packaging → lightweight preview → Metro adapter → Android doctor/build/run → macOS Xcode adapter → signed CI artifacts. Windows/Linux لا يقدمان iOS Simulator native؛ remote/EAS وphysical device مسارات بديلة.

كل build يجب أن يسجل git SHA وruntime versions وartifact hashes وschema version، ويعمل في clean checkout قبل release.
