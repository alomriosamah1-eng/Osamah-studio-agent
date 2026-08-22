export type StorageBackend = "memory" | "sqlite";
export type StorageLocation = "ephemeral_memory" | "configured_path" | "profile_directory";
export type StorageLockState = "not_applicable" | "held";
export type StorageCapabilityState = "not_configured" | "not_measured" | "available_by_explicit_flow";
export type StorageFallbackReason = "sqlite_initialization_failed";

export interface StorageSettings {
  readonly version: 1;
  readonly backend: StorageBackend;
  readonly location: StorageLocation;
  readonly profileId?: string;
  readonly databaseFile?: "studio.sqlite";
  readonly schemaVersion?: number;
  readonly lockState: StorageLockState;
  readonly fallbackReason?: StorageFallbackReason;
  readonly backupState: StorageCapabilityState;
  readonly retentionState: StorageCapabilityState;
  readonly quotaState: StorageCapabilityState;
}

export interface StorageSettingsPort {
  get(): StorageSettings;
}

export class StorageSettingsError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "StorageSettingsError";
  }
}

const cloneSnapshot = (snapshot: StorageSettings): StorageSettings => Object.freeze({
  ...snapshot,
  ...(snapshot.profileId === undefined ? {} : { profileId: snapshot.profileId }),
  ...(snapshot.databaseFile === undefined ? {} : { databaseFile: snapshot.databaseFile }),
  ...(snapshot.schemaVersion === undefined ? {} : { schemaVersion: snapshot.schemaVersion }),
  ...(snapshot.fallbackReason === undefined ? {} : { fallbackReason: snapshot.fallbackReason }),
});

export class StaticStorageSettings implements StorageSettingsPort {
  private readonly snapshot: StorageSettings;

  public constructor(snapshot: StorageSettings) {
    if (snapshot.version !== 1) throw new StorageSettingsError("Unsupported storage settings version.");
    if (snapshot.backend !== "memory" && snapshot.backend !== "sqlite") throw new StorageSettingsError("Storage backend is invalid.");
    if (snapshot.location !== "ephemeral_memory" && snapshot.location !== "configured_path" && snapshot.location !== "profile_directory") throw new StorageSettingsError("Storage location is invalid.");
    if (snapshot.backend === "memory" && snapshot.location !== "ephemeral_memory") throw new StorageSettingsError("Memory backend must use ephemeral_memory location.");
    if (snapshot.backend === "sqlite" && snapshot.location === "ephemeral_memory") throw new StorageSettingsError("SQLite backend must use a configured location.");
    if (snapshot.location === "profile_directory" && !snapshot.profileId) throw new StorageSettingsError("Profile directory storage requires a profile ID.");
    if (snapshot.backend === "sqlite" && snapshot.databaseFile !== "studio.sqlite") throw new StorageSettingsError("SQLite storage must expose the canonical database file metadata.");
    if (snapshot.schemaVersion !== undefined && (!Number.isSafeInteger(snapshot.schemaVersion) || snapshot.schemaVersion < 1 || snapshot.schemaVersion > 999)) throw new StorageSettingsError("Storage schema version is invalid.");
    if (snapshot.lockState !== "not_applicable" && snapshot.lockState !== "held") throw new StorageSettingsError("Storage lock state is invalid.");
    this.snapshot = cloneSnapshot(snapshot);
  }

  public get(): StorageSettings {
    return this.snapshot;
  }
}

export const createStorageSettingsSnapshot = (input: {
  readonly storageKind: StorageBackend;
  readonly profileId?: string;
  readonly hasProfileLock: boolean;
  readonly fallbackReason?: StorageFallbackReason;
}): StorageSettings => {
  if (input.storageKind === "memory") return Object.freeze({
    version: 1,
    backend: "memory",
    location: "ephemeral_memory",
    lockState: "not_applicable",
    backupState: "not_configured",
    retentionState: "not_configured",
    quotaState: "not_measured",
    ...(input.fallbackReason === undefined ? {} : { fallbackReason: input.fallbackReason }),
  });
  return Object.freeze({
    version: 1,
    backend: "sqlite",
    location: input.profileId ? "profile_directory" : "configured_path",
    ...(input.profileId === undefined ? {} : { profileId: input.profileId }),
    databaseFile: "studio.sqlite" as const,
    schemaVersion: 4,
    lockState: input.hasProfileLock ? "held" as const : "not_applicable" as const,
    backupState: "available_by_explicit_flow" as const,
    retentionState: "not_configured" as const,
    quotaState: "not_measured" as const,
  });
};

export const storageSettingsContract = {
  mutatesFilesystem: false,
  changesBackend: false,
  startsBackup: false,
  startsRestore: false,
  deletesData: false,
  requiresHumanGate: false,
} as const;
