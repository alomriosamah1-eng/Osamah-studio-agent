import { randomUUID } from "node:crypto";
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, unlinkSync, writeSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";

const profileIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export interface ProfilePathOptions {
  readonly userDataDirectory: string;
  readonly profileId?: string;
}

export interface ProfilePaths {
  readonly profileId: string;
  readonly userDataDirectory: string;
  readonly profileDirectory: string;
  readonly databasePath: string;
  readonly lockPath: string;
  readonly backupsDirectory: string;
}

export const validateProfileId = (profileId: string): string => {
  if (!profileIdPattern.test(profileId)) throw new Error("Profile ID must be 1-64 characters using letters, numbers, hyphen, or underscore.");
  return profileId;
};

export const resolveProfilePaths = ({ userDataDirectory, profileId = "default" }: ProfilePathOptions): ProfilePaths => {
  const resolvedUserDataDirectory = resolve(userDataDirectory);
  if (resolvedUserDataDirectory === sep) throw new Error("Profile user-data directory must not be the filesystem root.");
  const validProfileId = validateProfileId(profileId);
  const profileDirectory = join(resolvedUserDataDirectory, "profiles", validProfileId);
  return {
    profileId: validProfileId,
    userDataDirectory: resolvedUserDataDirectory,
    profileDirectory,
    databasePath: join(profileDirectory, "studio.sqlite"),
    lockPath: join(profileDirectory, ".profile.lock"),
    backupsDirectory: join(profileDirectory, "backups"),
  };
};

export interface ProfileLock {
  readonly lockPath: string;
  readonly token: string;
  release(): void;
}

export class ProfileLockedError extends Error {
  public constructor(public readonly path: string) {
    super("Profile is already locked by another Osamah Studio Agent process.");
    this.name = "ProfileLockedError";
  }
}

export class FileProfileLock implements ProfileLock {
  private released = false;

  private constructor(public readonly lockPath: string, public readonly token: string) {}

  public static acquire(profileDirectory: string, lockPath = join(profileDirectory, ".profile.lock")): FileProfileLock {
    mkdirSync(profileDirectory, { recursive: true });
    const token = randomUUID();
    const metadata = JSON.stringify({ pid: process.pid, token, acquiredAt: new Date().toISOString() }) + "\n";
    let fileDescriptor: number;
    try {
      fileDescriptor = openSync(lockPath, "wx", 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new ProfileLockedError(lockPath);
      throw error;
    }
    try {
      writeSync(fileDescriptor, metadata, undefined, "utf8");
      fsyncSync(fileDescriptor);
    } finally {
      closeSync(fileDescriptor);
    }
    return new FileProfileLock(lockPath, token);
  }

  public release(): void {
    if (this.released) return;
    this.released = true;
    if (!existsSync(this.lockPath)) return;
    const metadata = JSON.parse(readFileSync(this.lockPath, "utf8")) as { token?: unknown };
    if (metadata.token !== this.token) throw new Error("Profile lock ownership changed before release.");
    unlinkSync(this.lockPath);
  }
}

export const ensureProfileParent = (databasePath: string): void => {
  mkdirSync(dirname(resolve(databasePath)), { recursive: true });
};
