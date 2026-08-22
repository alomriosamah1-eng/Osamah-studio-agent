import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitStatusPort, GitStatusSummary } from "../application/project-context.js";

const execFileAsync = promisify(execFile);
const conflictCodes = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]);

export class GitStatusAdapter implements GitStatusPort {
  public constructor(private readonly timeoutMs = 1_500) {}

  public async read(rootPath: string): Promise<GitStatusSummary> {
    try {
      const { stdout } = await execFileAsync(
        "git",
        ["-C", rootPath, "status", "--porcelain=v1", "--branch", "--untracked-files=normal"],
        { timeout: this.timeoutMs, maxBuffer: 256 * 1024 },
      );
      const lines = stdout.split(/\r?\n/).filter(Boolean);
      const branchLine = lines.find((line) => line.startsWith("## "));
      const branch = branchLine?.slice(3).split("...")[0] || undefined;
      let stagedCount = 0;
      let unstagedCount = 0;
      let untrackedCount = 0;
      let conflictedCount = 0;
      for (const line of lines) {
        if (line.startsWith("## ")) continue;
        const code = line.slice(0, 2);
        if (code === "??") {
          untrackedCount += 1;
          continue;
        }
        if (code[0] && code[0] !== " ") stagedCount += 1;
        if (code[1] && code[1] !== " ") unstagedCount += 1;
        if (conflictCodes.has(code)) conflictedCount += 1;
      }
      return { isRepository: true, branch, stagedCount, unstagedCount, untrackedCount, conflictedCount };
    } catch {
      return { isRepository: false, stagedCount: 0, unstagedCount: 0, untrackedCount: 0, conflictedCount: 0, rawUnavailable: true };
    }
  }
}
