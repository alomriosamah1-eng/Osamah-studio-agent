# OPEN_SOURCE_MAP

| المشروع | الدور | التصنيف | الترخيص/التحقق |
|---|---|---|---|
| OpenCode | coding/desktop reference | ADAPT/WRAP | MIT؛ راجع source snapshot |
| Hermes Agent | agents/memory/skills | ADAPT/WRAP | MIT؛ راجع source snapshot |
| OmniRoute | provider routing | REFERENCE/ADAPT | MIT؛ dependency audit مطلوب |
| DeepSeek Harness | plugin seams | REFERENCE/ADAPT | MIT؛ notices مطلوب |
| Electron | desktop shell وprocess isolation | USE | MIT؛ shell/preload smoke منفذ، packaging النهائي لاحقًا |
| React Native Web | lightweight preview | USE/WRAP candidate | review npm/license؛ Fixture/Presentation compatibility منفذ حاليًا |
| Expo Snack | browser preview architecture | REFERENCE/ADAPT | MIT root؛ dependencies مختلفة |
| browser-metro/reactnative.run | browser bundling | REFERENCE/ADAPT candidate | MIT حسب project docs؛ audit مطلوب |
| Playwright | browser automation | USE/WRAP | Apache-2.0 |
| Android Emulator | native runtime | external toolchain | Android SDK terms |
| Xcode Simulator | native iOS runtime | external macOS toolchain | Apple terms |

Electron shell وtyped preload منفذان جزئيًا في `src/desktop/` مع `desktop:smoke`. لا تُضاف dependency جديدة إلى root قبل package lock وSBOM وlicense/security review. المصدر التفصيلي: `project/open-source-components.json` و`docs/28-open-source-license-audit.md`.
