import type { AuthUser } from "./auth.js";
import type {
  SaaSPlan,
  SaaSSyncPage,
  SyncApplyResult,
  Workspace,
  WorkspaceQrRecord
} from "./saas.js";

export type PurchaseRecord = {
  purchaseToken: string;
  productId: string;
  userId: string | null;
  verifiedAt: number;
};

export type PurchaseRepository = {
  hasPurchaseToken(token: string): boolean;
  save(record: PurchaseRecord): void;
};

export type AuthSessionInfo = {
  sessionId: string;
  createdAt: number;
  expiresAt: number;
  current: boolean;
};

export type AuthTokenRequest = {
  userId: string;
  email: string;
  name: string | null;
  token: string;
  expiresAt: number;
};

export type AuthenticatedSession = {
  sessionId: string;
  user: AuthUser;
  createdAt: number;
  expiresAt: number;
};

export type AuthRepository = {
  createUser(email: string, password: string, name: string | null): AuthUser;
  findUserByEmail(email: string): AuthUser | null;
  verifyCredentials(email: string, password: string): AuthUser | null;
  createSession(userId: string, now?: number): {
    sessionId: string;
    token: string;
    expiresAt: number;
  };
  getUserBySessionToken(token: string, now?: number): AuthUser | null;
  getSessionByToken(token: string, now?: number): AuthenticatedSession | null;
  listSessions(userId: string, currentSessionId: string | null, now?: number): AuthSessionInfo[];
  revokeSession(token: string, now?: number): void;
  revokeSessionById(userId: string, sessionId: string, now?: number): void;
  revokeOtherSessions(userId: string, currentSessionId: string, now?: number): void;
  createEmailVerificationToken(userId: string, now?: number): AuthTokenRequest;
  consumeEmailVerificationToken(token: string, now?: number): AuthUser | null;
  createPasswordResetToken(email: string, now?: number): AuthTokenRequest | null;
  resetPassword(token: string, newPassword: string, now?: number): AuthUser | null;
  changePassword(userId: string, currentPassword: string, newPassword: string, now?: number): boolean;
};

export type SaaSRepository = {
  createWorkspace(workspace: Workspace): void;
  getWorkspace(workspaceId: string): Workspace | null;
  getWorkspaceForUser(workspaceId: string, userId: string): Workspace | null;
  listWorkspacesForUser(userId: string): Workspace[];
  countQrRecords(workspaceId: string): number;
  hasQrRecord(workspaceId: string, recordId: string): boolean;
  getQrRecord(workspaceId: string, recordId: string): WorkspaceQrRecord | null;
  upsertQrRecord(record: WorkspaceQrRecord): SyncApplyResult;
  listQrRecords(workspaceId: string, includeDeleted?: boolean): WorkspaceQrRecord[];
  listQrDelta(workspaceId: string, cursor: number, limit: number): SaaSSyncPage;
};
