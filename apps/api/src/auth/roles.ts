import { SetMetadata } from '@nestjs/common';

export const ALL_ROLES = ['BUYER', 'SELLER', 'STORE_MANAGER', 'ORDER_OPERATOR', 'MODERATOR', 'VERIFICATION_ADMIN', 'DISPUTE_ADMIN', 'SUPPORT_ADMIN', 'SECURITY_ADMIN', 'SUPER_ADMIN'] as const;
export type AppRole = (typeof ALL_ROLES)[number];
export const ROLES_KEY = 'required_roles';
export const RequireRoles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
