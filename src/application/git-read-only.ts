export interface GitChange {
  readonly path: string;
  readonly status: string;
  readonly staged: boolean;
}

export interface GitStatusSnapshot {
  readonly isRepository: boolean;
  readonly branch?: string;
  readonly upstream?: string;
  readonly ahead: number;
  readonly behind: number;
  readonly staged: readonly GitChange[];
  readonly unstaged: readonly GitChange[];
  readonly untracked: readonly string[];
  readonly conflicted: readonly string[];
  readonly truncated?: boolean;
  readonly rawUnavailable?: boolean;
}

export interface GitDiffResult {
  readonly relativePath?: string;
  readonly patch: string;
  readonly bytes: number;
  readonly truncated: boolean;
  readonly rawUnavailable?: boolean;
}

export interface GitReadOnlyPort {
  status(rootPath: string): Promise<GitStatusSnapshot>;
  diff(rootPath: string, relativePath?: string): Promise<GitDiffResult>;
}

export class GitReadOnlyError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "GitReadOnlyError";
  }
}
