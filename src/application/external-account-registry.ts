import { sanitizeAuditText } from "./agent-contracts.js";

export type ExternalAccountStatus = "disconnected" | "consent_required" | "connected" | "expired" | "error";
export type ExternalAccountConsentState = "required" | "granted" | "revoked";
export type ExternalAccountVerificationState = "unknown" | "metadata_validated" | "verified" | "failed";

export interface ExternalAccountRecord {
  readonly accountId: string;
  readonly providerId: string;
  readonly label: string;
  readonly owner: string;
  readonly status: ExternalAccountStatus;
  readonly scopes: readonly string[];
  readonly resourceScope: string;
  readonly expiresAt?: string;
  readonly consentState: ExternalAccountConsentState;
  readonly approvedAt?: string;
  readonly approvalId?: string;
  readonly lastCheckedAt?: string;
  readonly verificationState: ExternalAccountVerificationState;
  readonly failureReason?: string;
  readonly createdAt: string;
}

export interface RegisterExternalAccountRequest {
  readonly providerId: string;
  readonly label: string;
  readonly owner: string;
  readonly scopes?: readonly string[];
  readonly resourceScope?: string;
  readonly expiresAt?: string;
}

export interface ExternalAccountRegistryPort {
  register(request: RegisterExternalAccountRequest): ExternalAccountRecord;
  get(accountId: string): ExternalAccountRecord | undefined;
  list(limit?: number): readonly ExternalAccountRecord[];
}

export interface ExternalAccountRegistryOptions {
  readonly now?: () => string;
  readonly nextId?: (prefix: string) => string;
  readonly maxAccounts?: number;
}

export class ExternalAccountRegistryError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ExternalAccountRegistryError";
  }
}

const accountStatuses: readonly ExternalAccountStatus[] = ["disconnected", "consent_required", "connected", "expired", "error"];
const consentStates: readonly ExternalAccountConsentState[] = ["required", "granted", "revoked"];
const verificationStates: readonly ExternalAccountVerificationState[] = ["unknown", "metadata_validated", "verified", "failed"];
const maxProviderIdLength = 128;
const maxLabelLength = 256;
const maxOwnerLength = 256;
const maxScopeLength = 256;
const maxResourceScopeLength = 512;
const maxScopes = 16;
const maxAccounts = 64;

const cleanText = (value: string, field: string, maxLength: number): string => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength || /[\0\r\n]/u.test(trimmed)) throw new ExternalAccountRegistryError(`${field} is invalid.`);
  return sanitizeAuditText(trimmed, maxLength);
};

const cleanId = (value: string, field: string): string => cleanText(value, field, 256);

const cleanProviderId = (value: string): string => {
  const providerId = cleanText(value, "providerId", maxProviderIdLength).toLowerCase();
  if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u.test(providerId)) throw new ExternalAccountRegistryError("providerId is invalid.");
  return providerId;
};

const cleanScopes = (scopes: readonly string[] | undefined): readonly string[] => {
  if (scopes === undefined) return [];
  if (scopes.length > maxScopes) throw new ExternalAccountRegistryError("scopes exceed bounded limits.");
  const cleaned = scopes.map((scope) => cleanText(scope, "scope", maxScopeLength));
  if (new Set(cleaned).size !== cleaned.length) throw new ExternalAccountRegistryError("scopes must be unique.");
  return cleaned;
};

const cleanExpiresAt = (expiresAt: string | undefined): string | undefined => {
  if (expiresAt === undefined) return undefined;
  const cleaned = cleanText(expiresAt, "expiresAt", 128);
  if (!Number.isFinite(Date.parse(cleaned))) throw new ExternalAccountRegistryError("expiresAt must be a valid date.");
  return cleaned;
};

const cleanRequest = (request: RegisterExternalAccountRequest): RegisterExternalAccountRequest => ({
  providerId: cleanProviderId(request.providerId),
  label: cleanText(request.label, "label", maxLabelLength),
  owner: cleanText(request.owner, "owner", maxOwnerLength),
  scopes: cleanScopes(request.scopes),
  resourceScope: request.resourceScope === undefined ? "metadata-only" : cleanText(request.resourceScope, "resourceScope", maxResourceScopeLength),
  expiresAt: cleanExpiresAt(request.expiresAt),
});

export class InMemoryExternalAccountRegistry implements ExternalAccountRegistryPort {
  private readonly accounts = new Map<string, ExternalAccountRecord>();
  private readonly now: () => string;
  private readonly nextId: (prefix: string) => string;
  private readonly maxItems: number;

  public constructor(options: ExternalAccountRegistryOptions = {}) {
    this.now = options.now ?? (() => new Date().toISOString());
    let sequence = 0;
    this.nextId = options.nextId ?? ((prefix) => `${prefix}-${++sequence}`);
    this.maxItems = Math.max(1, Math.min(Math.floor(options.maxAccounts ?? maxAccounts), maxAccounts));
  }

  public register(request: RegisterExternalAccountRequest): ExternalAccountRecord {
    const clean = cleanRequest(request);
    const duplicate = [...this.accounts.values()].find((account) => account.providerId === clean.providerId && account.label === clean.label && account.owner === clean.owner);
    if (duplicate) return duplicate;
    if (this.accounts.size >= this.maxItems) throw new ExternalAccountRegistryError("external account registry limit reached.");
    const account: ExternalAccountRecord = {
      accountId: this.nextId("account"),
      providerId: clean.providerId,
      label: clean.label,
      owner: clean.owner,
      status: "disconnected",
      scopes: clean.scopes ?? [],
      resourceScope: clean.resourceScope ?? "metadata-only",
      expiresAt: clean.expiresAt,
      consentState: "required",
      verificationState: "unknown",
      createdAt: this.now(),
    };
    this.accounts.set(account.accountId, account);
    return account;
  }

  public get(accountId: string): ExternalAccountRecord | undefined {
    return this.accounts.get(cleanId(accountId, "accountId"));
  }

  public list(limit = 64): readonly ExternalAccountRecord[] {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > this.maxItems) throw new ExternalAccountRegistryError("external account list limit is invalid.");
    return [...this.accounts.values()].slice(0, limit);
  }
}

export const externalAccountRegistryContract = {
  statusAtRegistration: "disconnected" as const,
  consentAtRegistration: "required" as const,
  verificationAtRegistration: "unknown" as const,
  performsNetworkCalls: false,
  storesSecrets: false,
  invokesProviders: false,
  requiresHumanGate: false,
  supportedStatuses: accountStatuses,
  supportedConsentStates: consentStates,
  supportedVerificationStates: verificationStates,
};
