import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AppRole } from './roles.js';
import { ROLES_KEY } from './roles.js';

type AuthenticatedRequest = { user?: { roles: AppRole[] } };

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!required?.length) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user?.roles.some((role) => role === 'SUPER_ADMIN' || required.includes(role)) ?? false;
  }
}
