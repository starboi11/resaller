import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AuthService } from './auth.service.js';
import { SESSION_COOKIE_NAME } from './session-token.service.js';
import type { AppRole } from './roles.js';

export type AuthenticatedUser = { id: string; publicId: string; username: string; roles: AppRole[]; createdAt: Date };

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest & { user?: AuthenticatedUser }>();
    const user = await this.auth.resolveSession(request.cookies?.[SESSION_COOKIE_NAME]);
    if (!user) throw new UnauthorizedException('Authentication required');
    request.user = user;
    return true;
  }
}
