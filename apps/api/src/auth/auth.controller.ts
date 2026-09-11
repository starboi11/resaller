import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service.js';
import { LoginDto, RegisterDto, RequestPasswordResetDto, ResetPasswordDto, VerifyTwoFactorDto } from './auth.dto.js';
import { type AuthenticatedUser, SessionGuard } from './session.guard.js';
import { SESSION_COOKIE, SESSION_COOKIE_NAME } from './session-token.service.js';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post('register')
  async register(@Body() input: RegisterDto, @Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const result = await this.auth.register(input.username, input.password, { ip: request.ip, userAgent: request.headers['user-agent'] });
    reply.setCookie(SESSION_COOKIE_NAME, result.session.token, { ...SESSION_COOKIE, expires: result.session.expiresAt });
    return { user: result.user };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() input: LoginDto, @Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const result = await this.auth.login(input.username, input.password, { ip: request.ip, userAgent: request.headers['user-agent'] });
    if (!('session' in result)) return result;
    reply.setCookie(SESSION_COOKIE_NAME, result.session.token, { ...SESSION_COOKIE, expires: result.session.expiresAt });
    return { user: result.user };
  }

  @Post('2fa/verify')
  @HttpCode(200)
  async verifyTwoFactor(@Body() input: VerifyTwoFactorDto, @Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const result = await this.auth.verifyTwoFactor(input.challengeToken, input.code, { ip: request.ip, userAgent: request.headers['user-agent'] });
    reply.setCookie(SESSION_COOKIE_NAME, result.session.token, { ...SESSION_COOKIE, expires: result.session.expiresAt });
    return { user: result.user };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<void> {
    await this.auth.logout(request.cookies?.[SESSION_COOKIE_NAME]);
    reply.clearCookie(SESSION_COOKIE_NAME, SESSION_COOKIE);
  }

  @Post('password/request-reset')
  @HttpCode(202)
  requestPasswordReset(@Body() input: RequestPasswordResetDto) { return this.auth.requestPasswordReset(input.username); }

  @Post('password/reset')
  resetPassword(@Body() input: ResetPasswordDto) { return this.auth.resetPassword(input.token, input.newPassword); }

  @Post('session/rotate')
  @UseGuards(SessionGuard)
  async rotate(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const session = await this.auth.rotateSession(request.cookies?.[SESSION_COOKIE_NAME]);
    reply.setCookie(SESSION_COOKIE_NAME, session.token, { ...SESSION_COOKIE, expires: session.expiresAt });
    return { rotated: true, expiresAt: session.expiresAt };
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@Req() request: FastifyRequest & { user: AuthenticatedUser }) { return { user: request.user }; }

  @Get('sessions')
  @UseGuards(SessionGuard)
  sessions(@Req() request: FastifyRequest & { user: AuthenticatedUser }) { return this.auth.sessions(request.user.id, request.cookies?.[SESSION_COOKIE_NAME]); }

  @Delete('sessions/:id')
  @UseGuards(SessionGuard)
  revokeSession(@Req() request: FastifyRequest & { user: AuthenticatedUser }, @Param('id') id: string) { return this.auth.revokeSession(request.user.id, id); }

  @Post('sessions/revoke-others')
  @UseGuards(SessionGuard)
  revokeOthers(@Req() request: FastifyRequest & { user: AuthenticatedUser }) { return this.auth.revokeOtherSessions(request.user.id, request.cookies?.[SESSION_COOKIE_NAME]); }
}
