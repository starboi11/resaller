export type ApiErrorBody = { code: string; message: string; requestId: string; details?: Record<string, string[]> };
export type HealthStatus = { status: 'ok' | 'degraded'; service: 'resaller-api'; timestamp: string; checks?: { database: 'up' | 'down'; redis: 'up' | 'down' } };

export const PLATFORM_BUSINESS_RULES = Object.freeze({
  sellerAcceptanceMinutes: 60,
  commissionBasisPoints: 0,
  paymentCollection: 'DEFERRED',
  escrow: 'DEFERRED',
  settlement: 'DEFERRED',
  verifiedReviewOrderStatus: 'COMPLETED',
} as const);

export const ACCOUNT_ROLES = ['BUYER', 'SELLER', 'STORE_MANAGER', 'ORDER_OPERATOR', 'MODERATOR', 'VERIFICATION_ADMIN', 'DISPUTE_ADMIN', 'SUPPORT_ADMIN', 'SECURITY_ADMIN', 'SUPER_ADMIN'] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];
