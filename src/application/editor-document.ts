export type DiffLineKind = "equal" | "add" | "remove";

export interface DiffLine {
  readonly kind: DiffLineKind;
  readonly text: string;
  readonly beforeLine?: number;
  readonly afterLine?: number;
}

export interface DocumentSnapshot {
  readonly relativePath: string;
  readonly content: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly revision: number;
}

export interface EditProposal {
  readonly proposalId: string;
  readonly relativePath: string;
  readonly expectedSha256: string;
  readonly nextSha256: string;
  readonly before: string;
  readonly after: string;
  readonly diff: readonly DiffLine[];
  readonly diffTruncated: boolean;
  readonly bytes: number;
}

export interface EditorDocumentPort {
  open(rootPath: string, relativePath: string): Promise<DocumentSnapshot | undefined>;
  propose(rootPath: string, relativePath: string, content: string, expectedSha256: string): Promise<EditProposal>;
}

export class EditorDocumentError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "EditorDocumentError";
  }
}

export class EditorDocumentConflictError extends EditorDocumentError {
  public constructor(message: string) {
    super(message);
    this.name = "EditorDocumentConflictError";
  }
}

export interface DiffLimits {
  readonly maxLines: number;
  readonly maxBytes: number;
}

export const DEFAULT_DIFF_LIMITS: DiffLimits = Object.freeze({ maxLines: 512, maxBytes: 128 * 1024 });

const sha256 = async (content: string): Promise<string> => {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(content, "utf8").digest("hex");
};

const splitLines = (content: string): string[] => content.split("\n");

export const createBoundedDiff = (before: string, after: string, limits: DiffLimits = DEFAULT_DIFF_LIMITS): { readonly lines: readonly DiffLine[]; readonly truncated: boolean } => {
  const beforeLines = splitLines(before);
  const afterLines = splitLines(after);
  const lines: DiffLine[] = [];
  let emittedBytes = 0;
  let truncated = false;
  const append = (line: DiffLine): void => {
    const bytes = Buffer.byteLength(line.text, "utf8") + 1;
    if (lines.length >= Math.max(1, Math.min(4_096, Math.floor(limits.maxLines))) || emittedBytes + bytes > Math.max(1, Math.min(2 * 1024 * 1024, Math.floor(limits.maxBytes)))) {
      truncated = true;
      return;
    }
    lines.push(line);
    emittedBytes += bytes;
  };

  let prefix = 0;
  while (prefix < beforeLines.length && prefix < afterLines.length && beforeLines[prefix] === afterLines[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < beforeLines.length - prefix && suffix < afterLines.length - prefix && beforeLines[beforeLines.length - 1 - suffix] === afterLines[afterLines.length - 1 - suffix]) suffix += 1;

  for (let index = 0; index < prefix; index += 1) append({ kind: "equal", text: beforeLines[index]!, beforeLine: index + 1, afterLine: index + 1 });
  for (let index = prefix; index < beforeLines.length - suffix; index += 1) append({ kind: "remove", text: beforeLines[index]!, beforeLine: index + 1 });
  for (let index = prefix; index < afterLines.length - suffix; index += 1) append({ kind: "add", text: afterLines[index]!, afterLine: index + 1 });
  for (let offset = suffix; offset > 0; offset -= 1) {
    const beforeLine = beforeLines.length - offset + 1;
    const afterLine = afterLines.length - offset + 1;
    append({ kind: "equal", text: beforeLines[beforeLine - 1]!, beforeLine, afterLine });
  }
  return { lines, truncated };
};

export const createDocumentSnapshot = async (relativePath: string, content: string, revision: number): Promise<DocumentSnapshot> => ({
  relativePath,
  content,
  bytes: Buffer.byteLength(content, "utf8"),
  sha256: await sha256(content),
  revision,
});

export const createEditProposal = async (input: {
  proposalId: string;
  relativePath: string;
  before: string;
  after: string;
  expectedSha256: string;
  diffLimits?: DiffLimits;
}): Promise<EditProposal> => {
  const diff = createBoundedDiff(input.before, input.after, input.diffLimits);
  return {
    proposalId: input.proposalId,
    relativePath: input.relativePath,
    expectedSha256: input.expectedSha256,
    nextSha256: await sha256(input.after),
    before: input.before,
    after: input.after,
    diff: diff.lines,
    diffTruncated: diff.truncated,
    bytes: Buffer.byteLength(input.after, "utf8"),
  };
};
