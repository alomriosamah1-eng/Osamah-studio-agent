# PROCESS_MAP

| العملية | مكان التشغيل | سبب |
|---|---|---|
| UI/render/layout | renderer/presentation | responsiveness |
| Application use case | core process/service | transaction and policy |
| Agent loop/local model | isolated worker | CPU/RAM/failure isolation |
| Terminal/browser/MCP | sandboxed worker | untrusted execution |
| Metro | worker process | long-running logs/ports |
| Android Emulator | external native process | hardware acceleration |
| iOS Simulator | macOS/Xcode process | Apple tooling constraint |
| PDF/media/build | bounded worker | avoid UI freeze |
| Resource Manager | supervisor process/core | caps/queue/termination |

كل process يحتاج lifecycle، health، cancellation، budget، وdiagnostics contract.
