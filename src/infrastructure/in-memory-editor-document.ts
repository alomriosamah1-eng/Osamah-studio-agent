import type {
  DocumentSnapshot,
  EditProposal,
  EditorDocumentPort,
} from "../application/editor-document.js";
import {
  createDocumentSnapshot,
  createEditProposal,
  EditorDocumentConflictError,
  EditorDocumentError,
} from "../application/editor-document.js";
import { normalizeWorkspaceRelativePath } from "../application/project-explorer.js";
import type { ResourcePolicy } from "../application/resource-policy.js";
import type { WorkspaceFileReaderPort } from "../application/project-explorer.js";

export interface InMemoryEditorDocumentOptions {
  readonly nextProposalId?: () => string;
}

export class InMemoryEditorDocumentStore implements EditorDocumentPort {
  private readonly snapshots = new Map<string, DocumentSnapshot>();
  private readonly nextProposalId: () => string;

  public constructor(
    private readonly reader: Pick<WorkspaceFileReaderPort, "readText">,
    private readonly resourcePolicy: ResourcePolicy,
    options: InMemoryEditorDocumentOptions = {},
  ) {
    this.nextProposalId = options.nextProposalId ?? (() => `editor-proposal-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  }

  public async open(rootPath: string, relativePath: string): Promise<DocumentSnapshot | undefined> {
    const normalizedPath = this.normalizePath(relativePath);
    const content = await this.reader.readText(rootPath, normalizedPath);
    if (content === undefined) return undefined;
    const key = this.key(rootPath, normalizedPath);
    const revision = (this.snapshots.get(key)?.revision ?? 0) + 1;
    const snapshot = await createDocumentSnapshot(normalizedPath, content.content, revision);
    this.snapshots.set(key, snapshot);
    return snapshot;
  }

  public async propose(rootPath: string, relativePath: string, content: string, expectedSha256: string): Promise<EditProposal> {
    const normalizedPath = this.normalizePath(relativePath);
    if (!/^[a-f0-9]{64}$/i.test(expectedSha256)) throw new EditorDocumentError("expectedSha256 is invalid.");
    const bytes = Buffer.byteLength(content, "utf8");
    if (content.includes("\u0000") || bytes > this.resourcePolicy.limits.maxTextFileBytes) throw new EditorDocumentError("Editor content exceeds the bounded text-file policy.");
    const current = await this.reader.readText(rootPath, normalizedPath);
    if (current === undefined) throw new EditorDocumentError(`Editable text file is unavailable: ${normalizedPath}`);
    if (current.sha256 !== expectedSha256.toLowerCase()) {
      throw new EditorDocumentConflictError(`Editor source changed before proposal: ${normalizedPath}.`);
    }
    const proposal = await createEditProposal({
      proposalId: this.nextProposalId(),
      relativePath: normalizedPath,
      before: current.content,
      after: content,
      expectedSha256: current.sha256,
      diffLimits: {
        maxLines: Math.min(512, this.resourcePolicy.limits.maxPreviewWarnings * 2),
        maxBytes: Math.min(128 * 1024, this.resourcePolicy.limits.maxPreviewSourceBytes),
      },
    });
    const key = this.key(rootPath, normalizedPath);
    const revision = (this.snapshots.get(key)?.revision ?? 0) + 1;
    this.snapshots.set(key, { relativePath: normalizedPath, content, bytes, sha256: proposal.nextSha256, revision });
    return proposal;
  }

  public getBuffered(rootPath: string, relativePath: string): DocumentSnapshot | undefined {
    return this.snapshots.get(this.key(rootPath, normalizeWorkspaceRelativePath(relativePath)));
  }

  private normalizePath(relativePath: string): string {
    try {
      return normalizeWorkspaceRelativePath(relativePath);
    } catch (error) {
      throw new EditorDocumentError(error instanceof Error ? error.message : "Editor document path is invalid.");
    }
  }

  private key(rootPath: string, relativePath: string): string {
    return `${rootPath}\u0000${relativePath}`;
  }
}
