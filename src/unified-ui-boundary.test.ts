import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const repositoryRoot = process.cwd();
const interfaceRoots = ["src/desktop", "src/ipc", "prototypes/studio"] as const;
const forbiddenUpstreamUiImportPatterns = [
  /^\s*import(?:\s+[^"']+\s+from\s+|\s*\()\s*["']@opencode-ai\//m,
  /^\s*import(?:\s+[^"']+\s+from\s+|\s*\()\s*["']@deepseek-ai\//m,
  /^\s*import(?:\s+[^"']+\s+from\s+|\s*\()\s*["']@agentclientprotocol\//m,
  /^\s*import(?:\s+[^"']+\s+from\s+|\s*\()\s*["']@monaco-editor\//m,
  /^\s*import(?:\s+[^"']+\s+from\s+|\s*\()\s*["']monaco-editor["']/m,
  /^\s*import(?:\s+[^"']+\s+from\s+|\s*\()\s*["']xterm["']/m,
  /^\s*import(?:\s+[^"']+\s+from\s+|\s*\()\s*["']react-native-web["']/m,
  /^\s*import(?:\s+[^"']+\s+from\s+|\s*\()\s*["']react-native["']/m,
  /^\s*import(?:\s+[^"']+\s+from\s+|\s*\()\s*["']hermes-agent["']/m,
  /^\s*import(?:\s+[^"']+\s+from\s+|\s*\()\s*["']three-vrm["']/m,
  /^\s*(?:const|let|var)\s+\w+\s*=\s*require\(\s*["'](?:@opencode-ai|@deepseek-ai|@agentclientprotocol|@monaco-editor|monaco-editor|xterm|react-native-web|react-native|hermes-agent|three-vrm)/m,
];

const sourceFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(join(repositoryRoot, directory), { withFileTypes: true });
  const paths: string[] = [];
  for (const entry of entries) {
    const relativePath = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await sourceFiles(relativePath));
    else if (/\.(?:ts|tsx|js|cjs|mjs)$/.test(entry.name)) paths.push(relativePath);
  }
  return paths;
};

test("unified Osamah UI boundary has no upstream UI imports or route leakage", async () => {
  const files = (await Promise.all(interfaceRoots.map(sourceFiles))).flat();
  const violations: string[] = [];
  for (const file of files) {
    const content = await readFile(join(repositoryRoot, file), "utf8");
    for (const pattern of forbiddenUpstreamUiImportPatterns) {
      if (pattern.test(content)) violations.push(`${file}: ${pattern.source}`);
    }
  }
  assert.deepEqual(violations, []);
});

test("preload exposes only Osamah-owned typed IPC surface", async () => {
  const content = await readFile(join(repositoryRoot, "src/desktop/preload-api.ts"), "utf8");
  assert.match(content, /export interface OsamahPreloadApi/);
  assert.match(content, /dispatch<M extends IpcMethod>/);
  assert.match(content, /chooseProjectRoot\(\)/);
  assert.match(content, /subscribe\(listener: \(event: IpcEvent\) => void\)/);
  for (const pattern of forbiddenUpstreamUiImportPatterns) assert.equal(pattern.test(content), false, `preload leaked ${pattern.source}`);
});
