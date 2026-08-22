import { spawn } from "node:child_process";
import electronPath from "electron";

const child = spawn(electronPath, ["dist/desktop/main.js"], {
  env: { ...process.env, OSAMAH_SMOKE: "1", OSAMAH_ROOT_PICKER_SMOKE: "1", OSAMAH_DISABLE_GPU: "1" },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
const collect = (chunk) => { output += chunk.toString(); };
child.stdout.on("data", collect);
child.stderr.on("data", collect);

const timeout = setTimeout(() => child.kill(), 15_000);
child.on("close", (code, signal) => {
  clearTimeout(timeout);
  process.stdout.write(output);
  if (code !== 0 || !output.includes("Osamah Studio Agent desktop shell ready.") || !output.includes("DESKTOP_IPC_SMOKE=PASS") || !output.includes("DESKTOP_ROOT_PICKER_SMOKE=PASS")) {
    console.error(`Desktop smoke failed: code=${code ?? "null"} signal=${signal ?? "none"}`);
    process.exit(1);
  }
  console.log("DESKTOP_SMOKE=PASS");
});
