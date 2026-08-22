# Avatar study repository inventory

## Git

HEAD=278c473bdfb80bd6d02ca70888519423587fb3eb
REMOTE=278c473bdfb80bd6d02ca70888519423587fb3eb
STATUS=[31m??[m research/avatar-repo-inventory-2026-08-22.md;

## Package

{
  "name": "osamah-studio-agent",
  "version": "0.6.0",
  "private": true,
  "type": "module",
  "main": "dist/desktop/main.js",
  "description": "Local-first Electron desktop foundation with embedded preview and typed IPC for Osamah Studio Agent",
  "scripts": {
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "tsx --test src/*.test.ts src/**/*.test.ts",
    "check": "pnpm typecheck && pnpm test",
    "build": "tsc -p tsconfig.json && cp src/desktop/preload.cjs dist/desktop/preload.cjs",
    "desktop:start": "pnpm build && electron dist/desktop/main.js",
    "desktop:smoke": "pnpm build && node scripts/desktop-smoke.mjs",
    "performance:smoke": "pnpm build && node --max-old-space-size=768 scripts/performance-smoke.mjs"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "electron": "43.4.1",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  }
}

## Source tree

src/agent-catalog.test.ts
src/agent-runtime.test.ts
src/agent-task-preview.test.ts
src/agent-work-cycle.test.ts
src/application-settings.test.ts
src/application/agent-catalog.ts
src/application/agent-contracts.ts
src/application/agent-runtime.ts
src/application/agent-task-preview.ts
src/application/agent-work-cycle.ts
src/application/application-settings.ts
src/application/approval-workflow.ts
src/application/artifact-assembly.ts
src/application/asset-catalog.ts
src/application/audit-policy.ts
src/application/content-plan.ts
src/application/editor-document.ts
src/application/git-read-only.ts
src/application/human-gate.ts
src/application/memory-capture.ts
src/application/mobile-services.ts
src/application/planner-critic.ts
src/application/ports.ts
src/application/project-context.ts
src/application/project-explorer.ts
src/application/project-preview-service.ts
src/application/provider-contracts.ts
src/application/provider-gateway.ts
src/application/provider-policy.ts
src/application/render-policy.ts
src/application/report-document.ts
src/application/resource-policy.ts
src/application/source-registry.ts
src/application/terminal-policy.ts
src/application/use-cases.ts
src/approval-workflow.test.ts
src/artifact-assembly.test.ts
src/asset-catalog.test.ts
src/composition.test.ts
src/composition.ts
src/content-plan.test.ts
src/desktop/main.ts
src/desktop/preload-api.ts
src/desktop/preload.cjs
src/desktop/root-picker.ts
src/desktop/security.test.ts
src/desktop/security.ts
src/domain/entities.ts
src/domain/errors.ts
src/domain/events.ts
src/domain/mobile.ts
src/domain/primitives.ts
src/domain/project.ts
src/editor-document.test.ts
src/embedded-controller.test.ts
src/filesystem-patch.test.ts
src/filesystem-scanner.test.ts
src/foundation.test.ts
src/git-read-only.test.ts
src/infrastructure/audit-export.ts
src/infrastructure/filesystem-patch.ts
src/infrastructure/filesystem-project-explorer.ts
src/infrastructure/filesystem-project-scanner.ts
src/infrastructure/fixture-provider.ts
src/infrastructure/git-read-only.ts
src/infrastructure/git-status.ts
src/infrastructure/in-memory-editor-document.ts
src/infrastructure/in-memory.ts
src/infrastructure/local-http-provider.ts
src/infrastructure/local-provider-doctor.ts
src/infrastructure/profile-storage.ts
src/infrastructure/sqlite-backup.ts
src/infrastructure/sqlite.ts
src/ipc.test.ts
src/ipc/contracts.ts
src/ipc/embedded-handlers.ts
src/ipc/in-memory-transport.ts
src/local-http-provider.test.ts
src/memory-capture.test.ts
src/mobile-services.test.ts
src/mobile/embedded-controller.ts
src/mobile/preview-runtime.ts
src/mobile/preview.ts
src/planner-critic.test.ts
src/presentation/preview-renderer.ts
src/preview-adapter.test.ts
src/preview-renderer.test.ts
src/preview-runtime.test.ts
src/profile-storage.test.ts
src/project-context.test.ts
src/project-explorer.test.ts
src/project-preview-service.test.ts
src/provider-gateway.test.ts
src/provider-policy.test.ts
src/render-policy.test.ts
src/report-document.test.ts
src/resource-policy.test.ts
src/root-picker.test.ts
src/source-registry.test.ts
src/sqlite.test.ts
src/terminal-policy.test.ts

## Relevant references

docs/45-master-implementation-plan.md
project/master-implementation-plan.json
prototypes/mobile-preview/index.html
prototypes/studio/index.html
prototypes/studio/preview-renderer.js
prototypes/studio/workspace.js
src/agent-catalog.test.ts
src/agent-runtime.test.ts
src/agent-work-cycle.test.ts
src/application-settings.test.ts
src/application/agent-catalog.ts
src/application/agent-runtime.ts
src/application/application-settings.ts
src/application/asset-catalog.ts
src/application/memory-capture.ts
src/application/project-explorer.ts
src/application/project-preview-service.ts
src/application/provider-policy.ts
src/application/render-policy.ts
src/application/resource-policy.ts
src/application/terminal-policy.ts
src/approval-workflow.test.ts
src/asset-catalog.test.ts
src/composition.test.ts
src/composition.ts
src/domain/entities.ts
src/editor-document.test.ts
src/embedded-controller.test.ts
src/filesystem-patch.test.ts
src/foundation.test.ts
src/infrastructure/filesystem-project-explorer.ts
src/infrastructure/profile-storage.ts
src/infrastructure/sqlite.ts
src/ipc.test.ts
src/ipc/contracts.ts
src/ipc/embedded-handlers.ts
src/memory-capture.test.ts
src/mobile/embedded-controller.ts
src/mobile/preview-runtime.ts
src/mobile/preview.ts
src/presentation/preview-renderer.ts
src/project-context.test.ts
src/project-explorer.test.ts
src/provider-gateway.test.ts
src/provider-policy.test.ts
src/render-policy.test.ts
src/resource-policy.test.ts
src/sqlite.test.ts
src/terminal-policy.test.ts

## Explicit absence checks

AvatarRuntime: 0
VoiceManager: 0
WakeWord: 0
TTS: 0
STT: 0
Desktop Overlay: 0
Virtual Human: 0
