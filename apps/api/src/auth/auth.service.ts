import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../infrastructure/prisma.service.js';
import { PasswordService } from './password.service.js';
import { SessionTokenService } from './session-token.service.js';
import { TotpService } from './totp.service.js';
import type { AppRole } from './roles.js';

const SESSION_DAYS = 30;
const TWO_FACTOR_MINUTES = 5;
const PRIVILEGED_ROLES = new Set([
  'MODERATOR',
  'VERIFICATION_ADMIN',
  'DISPUTE_ADMIN',
  'SUPPORT_ADMIN',
  'SECURITY_ADMIN',
  'SUPER_ADMIN',
]);
type ClientContext = {
  ip?: string | undefined;
  userAgent?: string | undefined;
};
const publicUser = (user: {
  publicId: string;
  username: string;
  roles: string[];
  createdAt: Date;
}) => ({
  publicId: user.publicId,
  username: user.username,
  roles: user.roles as AppRole[],
  createdAt: user.createdAt,
});

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(SessionTokenService) private readonly tokens: SessionTokenService,
    @Inject(TotpService) private readonly totp: TotpService,
  ) {}

  async register(
    username: string,
    password: string,
    context: ClientContext = {},
  ) {
    const passwordHash = await this.passwords.hash(password);
    try {
      const user = await this.prisma.user.create({
        data: { username, passwordHash },
      });
      return {
        user: publicUser(user),
        session: await this.createSession(user.id, context),
      };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error &&
        'code' in error &&
        error.code === 'P2002'
      )
        throw new ConflictException('Username is unavailable');
      throw error;
    }
  }

  async login(username: string, password: string, context: ClientContext = {}) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (
      !user ||
      user.deletedAt ||
      user.accountStatus !== 'ACTIVE' ||
      !(await this.passwords.verify(password, user.passwordHash))
    ) {
      await this.prisma.securityEvent.create({
        data: {
          userId: user?.id ?? null,
          type: 'LOGIN_FAILED',
          severity: 'WARNING',
          ipHash: this.ipHash(context.ip),
          metadata: { attemptedUsername: username },
        },
      });
      throw new UnauthorizedException('Invalid username or password');
    }
    const ipHash = this.ipHash(context.ip);
    const knownContext = ipHash
      ? await this.prisma.session.findFirst({
          where: { userId: user.id, ipHash, revokedAt: null },
        })
      : null;
    if (ipHash && !knownContext) {
      await this.prisma.$transaction([
        this.prisma.securityEvent.create({
          data: {
            userId: user.id,
            type: 'NEW_LOGIN_CONTEXT',
            severity: 'INFO',
            ipHash,
            metadata: { userAgent: this.safeUserAgent(context.userAgent) },
          },
        }),
        this.prisma.notification.create({
          data: {
            userId: user.id,
            severity: 'WARNING',
            type: 'SECURITY_ALERT',
            payload: {
              event: 'NEW_LOGIN_CONTEXT',
              userAgent: this.safeUserAgent(context.userAgent),
              occurredAt: new Date().toISOString(),
            },
          },
        }),
      ]);
    }
    if (user.roles.some((role) => PRIVILEGED_ROLES.has(role)))
      return this.issueTwoFactorChallenge(user, context);
    return {
      user: publicUser(user),
      session: await this.createSession(user.id, context),
    };
  }

  async verifyTwoFactor(
    challengeToken: string,
    code: string,
    context: ClientContext = {},
  ) {
    const tokenHash = this.tokens.hash(challengeToken);
    const challenge = await this.prisma.twoFactorChallenge.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    const now = new Date();
    if (
      !challenge ||
      challenge.usedAt ||
      challenge.expiresAt <= now ||
      challenge.user.deletedAt
    )
      throw new UnauthorizedException(
        'Two-factor challenge is invalid or expired',
      );
    const encryptedSecret =
      challenge.purpose === 'ENROLL'
        ? challenge.secretEncrypted
        : challenge.user.totpSecretEncrypted;
    if (
      !encryptedSecret ||
      !this.totp.verify(this.totp.decrypt(encryptedSecret), code)
    ) {
      await this.prisma.securityEvent.create({
        data: {
          userId: challenge.userId,
          type: 'TWO_FACTOR_FAILED',
          severity: 'WARNING',
          ipHash: this.ipHash(context.ip),
        },
      });
      throw new UnauthorizedException('Invalid authentication code');
    }
    const consumed = await this.prisma.twoFactorChallenge.updateMany({
      where: { id: challenge.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (consumed.count !== 1)
      throw new UnauthorizedException(
        'Two-factor challenge is invalid or expired',
      );
    if (challenge.purpose === 'ENROLL') {
      await this.prisma.user.update({
        where: { id: challenge.userId },
        data: { totpSecretEncrypted: encryptedSecret, totpEnabledAt: now },
      });
      await this.prisma.session.updateMany({
        where: { userId: challenge.userId, revokedAt: null },
        data: { revokedAt: now },
      });
    }
    await this.prisma.securityEvent.create({
      data: {
        userId: challenge.userId,
        type:
          challenge.purpose === 'ENROLL'
            ? 'TWO_FACTOR_ENABLED'
            : 'TWO_FACTOR_VERIFIED',
        severity: 'INFO',
        ipHash: this.ipHash(context.ip),
      },
    });
    return {
      user: publicUser(challenge.user),
      session: await this.createSession(challenge.userId, context),
    };
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    await this.prisma.session.updateMany({
      where: { tokenHash: this.tokens.hash(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async requestPasswordReset(username: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || user.deletedAt) return { accepted: true };
    const issued = this.tokens.issue();
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: now },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: issued.tokenHash,
          expiresAt: new Date(now.getTime() + 15 * 60_000),
        },
      }),
      this.prisma.securityEvent.create({
        data: {
          userId: user.id,
          type: 'PASSWORD_RESET_REQUESTED',
          severity: 'INFO',
        },
      }),
    ]);
    return {
      accepted: true,
      ...(process.env.NODE_ENV === 'production'
        ? {}
        : { developmentToken: issued.token }),
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = this.tokens.hash(token);
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    if (!record || record.usedAt || record.expiresAt <= new Date())
      throw new UnauthorizedException('Reset token is invalid or expired');
    const passwordHash = await this.passwords.hash(newPassword);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (consumed.count !== 1)
        throw new UnauthorizedException('Reset token is invalid or expired');
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      });
      await tx.session.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.securityEvent.create({
        data: {
          userId: record.userId,
          type: 'PASSWORD_RESET_COMPLETED',
          severity: 'WARNING',
        },
      });
    });
    return { reset: true };
  }

  async resolveSession(token: string | undefined) {
    if (!token) return null;
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: this.tokens.hash(token) },
      include: { user: true },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.deletedAt ||
      session.user.accountStatus !== 'ACTIVE'
    )
      return null;
    return { id: session.user.id, ...publicUser(session.user) };
  }

  async sessions(userId: string, currentToken: string | undefined) {
    const currentHash = currentToken ? this.tokens.hash(currentToken) : null;
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        tokenHash: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
      },
    });
    return sessions.map(({ tokenHash, ...session }) => ({
      ...session,
      current: tokenHash === currentHash,
    }));
  }

  async revokeSession(userId: string, id: string) {
    const result = await this.prisma.session.updateMany({
      where: { id, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!result.count) throw new UnauthorizedException('Session not found');
    return { revoked: true };
  }

  async revokeOtherSessions(userId: string, currentToken: string | undefined) {
    const currentHash = currentToken ? this.tokens.hash(currentToken) : '';
    const result = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null, tokenHash: { not: currentHash } },
      data: { revokedAt: new Date() },
    });
    return { revoked: result.count };
  }

  async rotateSession(token: string | undefined) {
    if (!token) throw new UnauthorizedException('Authentication required');
    const oldHash = this.tokens.hash(token);
    const current = await this.prisma.session.findUnique({
      where: { tokenHash: oldHash },
    });
    if (!current || current.revokedAt || current.expiresAt <= new Date())
      throw new UnauthorizedException('Authentication required');
    const issued = this.tokens.issue();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
    const changed = await this.prisma.session.updateMany({
      where: { id: current.id, tokenHash: oldHash, revokedAt: null },
      data: { tokenHash: issued.tokenHash, expiresAt },
    });
    if (changed.count !== 1)
      throw new UnauthorizedException('Authentication required');
    return { token: issued.token, expiresAt };
  }

  private async createSession(userId: string, context: ClientContext) {
    const issued = this.tokens.issue();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: issued.tokenHash,
        expiresAt,
        ipHash: this.ipHash(context.ip),
        userAgent: this.safeUserAgent(context.userAgent),
      },
    });
    return { token: issued.token, expiresAt };
  }

  private async issueTwoFactorChallenge(
    user: {
      id: string;
      publicId: string;
      username: string;
      roles: string[];
      createdAt: Date;
      totpSecretEncrypted: string | null;
    },
    context: ClientContext,
  ) {
    const issued = this.tokens.issue();
    const expiresAt = new Date(Date.now() + TWO_FACTOR_MINUTES * 60_000);
    const enrolling = !user.totpSecretEncrypted;
    const secret = enrolling ? this.totp.generateSecret() : null;
    await this.prisma.$transaction([
      this.prisma.twoFactorChallenge.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.twoFactorChallenge.create({
        data: {
          userId: user.id,
          tokenHash: issued.tokenHash,
          purpose: enrolling ? 'ENROLL' : 'LOGIN',
          secretEncrypted: secret ? this.totp.encrypt(secret) : null,
          expiresAt,
          ipHash: this.ipHash(context.ip),
          userAgent: this.safeUserAgent(context.userAgent),
        },
      }),
    ]);
    return {
      user: publicUser(user),
      twoFactor: {
        required: true as const,
        mode: enrolling ? ('ENROLL' as const) : ('VERIFY' as const),
        challengeToken: issued.token,
        expiresAt,
        ...(secret
          ? {
              secret,
              provisioningUri: this.totp.provisioningUri(user.username, secret),
            }
          : {}),
      },
    };
  }

  private ipHash(ip: string | undefined): string | null {
    if (!ip) return null;
    return createHmac(
      'sha256',
      process.env.SESSION_SECRET ?? 'development-only',
    )
      .update(ip)
      .digest('base64url');
  }

  private safeUserAgent(value: string | undefined): string | null {
    return value?.slice(0, 300) ?? null;
  }
}
