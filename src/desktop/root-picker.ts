import { realpath, stat } from "node:fs/promises";
import { resolve } from "node:path";

export interface DirectoryDialogResult {
  readonly canceled: boolean;
  readonly filePaths: readonly string[];
}

export interface DirectoryDialog {
  showOpenDialog(options: { readonly properties: readonly ["openDirectory"] }): Promise<DirectoryDialogResult>;
}

export type RootPickerResult =
  | { readonly canceled: true }
  | { readonly canceled: false; readonly rootPath: string }
  | { readonly canceled: false; readonly error: "INVALID_ROOT" | "NO_DIRECTORY_SELECTED"; readonly message: string };

export class InvalidProjectRootError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "InvalidProjectRootError";
  }
}

export const validateProjectRoot = async (candidate: string): Promise<string> => {
  if (!candidate || candidate.includes("\0")) throw new InvalidProjectRootError("The selected project root is invalid.");
  const canonicalPath = await realpath(resolve(candidate));
  const info = await stat(canonicalPath);
  if (!info.isDirectory()) throw new InvalidProjectRootError("The selected project root is not a directory.");
  return canonicalPath;
};

export const chooseProjectRoot = async (dialog: DirectoryDialog): Promise<RootPickerResult> => {
  const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  if (result.canceled) return { canceled: true };
  const candidate = result.filePaths[0];
  if (!candidate) return { canceled: false, error: "NO_DIRECTORY_SELECTED", message: "No project directory was selected." };
  try {
    return { canceled: false, rootPath: await validateProjectRoot(candidate) };
  } catch (error) {
    const message = error instanceof InvalidProjectRootError ? error.message : "The selected project root is invalid.";
    return { canceled: false, error: "INVALID_ROOT", message };
  }
};
