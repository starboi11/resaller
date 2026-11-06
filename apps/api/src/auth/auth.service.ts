import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, randomUUID } from 'node:crypto';
import { PrismaService } from '../infrastructure/prisma.service.js';
import { RedisService } from '../infrastructure/redis.service.js';
import { PasswordService } from './password.service.js';
import { SessionTokenService } from './session-token.service.js';
import { TotpService } from './totp.service.js';
import type { AppRole } from './roles.js';
import { PasswordResetDeliveryService } from './password-reset-delivery.service.js';
import { EndpointCryptoService } from '../notifications/endpoint-crypto.service.js';

const SESSION_DAYS = 30;
// Admin accounts (owner decision 2026-11-04): a 16+ character random password,
// with TOTP optional via ADMIN_TWO_FACTOR_REQUIRED=false. In exchange admin
// logins get their own tight limit, an audit event, and 12-hour sessions.
const ADMIN_SESSION_HOURS = 12;
const ADMIN_LOGIN_PER_ACCOUNT = 5;
const ADMIN_LOGIN_WINDOW = 900;
export const adminTwoFactorRequired = (): boolean => process.env.ADMIN_TWO_FACTOR_REQUIRED !== 'false';
/** Admin passwords: at least 16 characters with upper case, lower case and digits. */
export const isStrongAdminPassword = (value: string): boolean =>
  value.length >= 16 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value);
// Abuse limits shared with the Go API (same Redis keys and windows).
const LOGIN_PER_ACCOUNT = 30;
const LOGIN_ACCOUNT_WINDOW = 900;
const REGISTER_PER_IP = 10;
const REGISTER_WINDOW = 3600;
const RESET_PER_ACCOUNT = 3;
const RESET_PER_IP = 10;
const RESET_WINDOW = 900;
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
  // A real scrypt hash of a random password: missing and inactive accounts are
  // verified against it so they cost the same time as a wrong password.
  private dummyHash: Promise<string> | null = null;

  private keyed(value: string): string {
    return createHmac('sha256', process.env.SESSION_SECRET ?? 'development-only').update(value).digest('base64url');
  }

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(SessionTokenService) private readonly tokens: SessionTokenService,
    @Inject(TotpService) private readonly totp: TotpService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(PasswordResetDeliveryService)
    private readonly passwordResetDelivery: PasswordResetDeliveryService,
    @Inject(EndpointCryptoService) private readonly crypto: EndpointCryptoService,
  ) {}

  private phoneHash(phone: string): string {
    return this.keyed(`phone\0${phone}`);
  }

  async register(
    username: string,
    password: string,
    context: ClientContext = {},
    profile: { fullName: string; phone: string },
  ) {
    if (!(await this.redis.fixedWindowLimit(`register:${this.keyed(context.ip ?? 'unknown')}`, REGISTER_PER_IP, REGISTER_WINDOW)))
      throw new HttpException('Too many accounts created from this network; try again later', HttpStatus.TOO_MANY_REQUESTS);
    const passwordHash = await this.passwords.hash(password);
    try {
      const phoneHash = this.phoneHash(profile.phone);
      if (await this.prisma.user.findUnique({ where: { phoneHash }, select: { id: true } }))
        throw new ConflictException('Bu telefon raqami bilan hisob allaqachon bor');
      const user = await this.prisma.user.create({
        data: { username, passwordHash, fullName: profile.fullName, phoneEncrypted: this.crypto.encrypt(profile.phone), phoneHash },
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
      ) {
        const target = 'meta' in error ? JSON.stringify((error as { meta?: unknown }).meta ?? '') : '';
        throw new ConflictException(target.includes('phoneHash') ? 'Bu telefon raqami bilan hisob allaqachon bor' : 'Username is unavailable');
      }
      throw error;
    }
  }

  async login(username: string, password: string, context: ClientContext = {}) {
    const attemptKey = createHmac('sha256', process.env.SESSION_SECRET ?? 'development-only')
      .update(`${username}\0${context.ip ?? 'unknown'}`)
      .digest('base64url');
    const allowed = await this.redis.fixedWindowLimit(`login:${attemptKey}`, 10, 300);
    // The per-account window does not depend on the network address, so
    // rotating addresses cannot buy more guesses against one account.
    const accountAllowed = await this.redis.fixedWindowLimit(`login-account:${this.keyed(username)}`, LOGIN_PER_ACCOUNT, LOGIN_ACCOUNT_WINDOW);
    if (!allowed || !accountAllowed) {
      await this.prisma.securityEvent.create({
        data: { userId: null, type: 'LOGIN_RATE_LIMITED', severity: 'WARNING', ipHash: this.ipHash(context.ip), metadata: { attemptedUsername: username } },
      });
      throw new UnauthorizedException('Invalid username or password');
    }
    const user = await this.prisma.user.findUnique({ where: { username } });
    const usable = Boolean(user && !user.deletedAt && user.accountStatus === 'ACTIVE');
    this.dummyHash ??= this.passwords.hash(randomUUID());
    // Always run exactly one scrypt verification, so response time does not
    // reveal whether the username exists.
    const privileged = usable && user!.roles.some((role) => PRIVILEGED_ROLES.has(role));
    // Admin accounts get their own, tighter window on top of the account one.
    if (privileged && !(await this.redis.fixedWindowLimit(`admin-login:${this.keyed(username)}`, ADMIN_LOGIN_PER_ACCOUNT, ADMIN_LOGIN_WINDOW))) {
      await this.prisma.securityEvent.create({
        data: { userId: user!.id, type: 'ADMIN_LOGIN_RATE_LIMITED', severity: 'CRITICAL', ipHash: this.ipHash(context.ip) },
      });
      throw new UnauthorizedException('Invalid username or password');
    }
    const passwordOk = await this.passwords.verify(password, usable ? user!.passwordHash : await this.dummyHash);
    if (!user || !usable || !passwordOk) {
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
    if (privileged && adminTwoFactorRequired())
      return this.issueTwoFactorChallenge(user, context);
    if (privileged)
      await this.prisma.securityEvent.create({
        data: { userId: user.id, type: 'ADMIN_LOGIN', severity: 'WARNING', ipHash, metadata: { userAgent: this.safeUserAgent(context.userAgent), twoFactor: false } },
      });
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
      challenge.user.deletedAt ||
      challenge.user.accountStatus !== 'ACTIVE'
    )
      throw new UnauthorizedException(
        'Two-factor challenge is invalid or expired',
      );
    const encryptedSecret =
      challenge.purpose === 'ENROLL'
        ? challenge.secretEncrypted
        : challenge.user.totpSecretEncrypted;
    const allowed = await this.redis.fixedWindowLimit(
      `two-factor:${challenge.userId}`,
      5,
      TWO_FACTOR_MINUTES * 60,
    );
    if (!allowed) {
      await this.prisma.securityEvent.create({
        data: {
          userId: challenge.userId,
          type: 'TWO_FACTOR_RATE_LIMITED',
          severity: 'WARNING',
          ipHash: this.ipHash(context.ip),
        },
      });
      throw new UnauthorizedException('Invalid authentication code');
    }
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
    if (challenge.purpose === 'ENROLL' && encryptedSecret) {
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
      session: await this.createSession(challenge.userId, context, now),
    };
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    await this.prisma.session.updateMany({
      where: { tokenHash: this.tokens.hash(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async requestPasswordReset(username: string, context: ClientContext = {}) {
    const byIp = await this.redis.fixedWindowLimit(`reset-ip:${this.keyed(context.ip ?? 'unknown')}`, RESET_PER_IP, RESET_WINDOW);
    const byAccount = await this.redis.fixedWindowLimit(`reset-account:${this.keyed(username)}`, RESET_PER_ACCOUNT, RESET_WINDOW);
    // Over the limit the caller still gets the same answer, so the limit neither
    // floods the victim's inbox nor reveals that the account exists.
    if (!byIp || !byAccount) return { accepted: true };
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
    const delivered = await this.passwordResetDelivery.send(user.id, issued.token);
    await this.prisma.securityEvent.create({
      data: {
        userId: user.id,
        type: delivered ? 'PASSWORD_RESET_DELIVERED' : 'PASSWORD_RESET_DELIVERY_UNAVAILABLE',
        severity: delivered ? 'INFO' : 'WARNING',
      },
    });
    // Keep the identical response for unknown users and unavailable recovery
    // channels. Tokens are never disclosed by this API, including development.
    return { accepted: true };
  }

  /** Admin accounts keep a 16+ character mixed password whatever path changes it. */
  private async assertPasswordPolicy(userId: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { roles: true } });
    if (user?.roles.some((role) => PRIVILEGED_ROLES.has(role)) && !isStrongAdminPassword(newPassword))
      throw new BadRequestException('Admin paroli kamida 16 belgi bo‘lsin: katta va kichik harf hamda raqam aralash');
  }

  /** The signed-in user's own profile (decrypted phone), e.g. to prefill checkout. */
  async profile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId },
      select: { publicId: true, username: true, fullName: true, phoneEncrypted: true, createdAt: true } });
    let phone: string | null = null;
    if (user.phoneEncrypted) {
      try { phone = this.crypto.decrypt(user.phoneEncrypted); } catch { phone = null; }
    }
    return { publicId: user.publicId, username: user.username, fullName: user.fullName, phone, createdAt: user.createdAt };
  }

  async changePassword(userId: string, currentToken: string | undefined, currentPassword: string, newPassword: string) {
    if (!(await this.redis.fixedWindowLimit(`password-change:${userId}`, 5, 900)))
      throw new HttpException('Juda ko‘p urinish. Birozdan keyin qayta urinib ko‘ring', HttpStatus.TOO_MANY_REQUESTS);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
    if (!(await this.passwords.verify(currentPassword, user.passwordHash)))
      throw new BadRequestException('Joriy parol noto‘g‘ri');
    await this.assertPasswordPolicy(userId, newPassword);
    const passwordHash = await this.passwords.hash(newPassword);
    const keep = currentToken ? this.tokens.hash(currentToken) : '';
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      // Every other device is signed out; this one stays signed in.
      this.prisma.session.updateMany({ where: { userId, revokedAt: null, tokenHash: { not: keep } }, data: { revokedAt: new Date() } }),
      this.prisma.securityEvent.create({ data: { userId, type: 'PASSWORD_CHANGED', severity: 'WARNING' } }),
    ]);
    return { changed: true };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = this.tokens.hash(token);
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    if (!record || record.usedAt || record.expiresAt <= new Date())
      throw new UnauthorizedException('Reset token is invalid or expired');
    await this.assertPasswordPolicy(record.userId, newPassword);
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
      !session.user ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.deletedAt ||
      session.user.accountStatus !== 'ACTIVE'
    )
      return null;
    if (
      session.user.roles.some((role) => PRIVILEGED_ROLES.has(role)) &&
      adminTwoFactorRequired() &&
      (!session.twoFactorVerifiedAt || !session.user.totpEnabledAt)
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
    const expiresAt = await this.sessionExpiry(current.userId);
    const changed = await this.prisma.session.updateMany({
      where: { id: current.id, tokenHash: oldHash, revokedAt: null },
      data: { tokenHash: issued.tokenHash, expiresAt },
    });
    if (changed.count !== 1)
      throw new UnauthorizedException('Authentication required');
    return { token: issued.token, expiresAt };
  }

  /** Admin sessions last 12 hours, everyone else's 30 days. */
  private async sessionExpiry(userId: string): Promise<Date> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { roles: true } });
    const privileged = Boolean(user?.roles.some((role) => PRIVILEGED_ROLES.has(role)));
    return new Date(Date.now() + (privileged ? ADMIN_SESSION_HOURS * 3_600_000 : SESSION_DAYS * 86_400_000));
  }

  private async createSession(userId: string, context: ClientContext, twoFactorVerifiedAt?: Date) {
    const issued = this.tokens.issue();
    const expiresAt = await this.sessionExpiry(userId);
    const seller = await this.prisma.sellerProfile.findUnique({ where: { userId }, select: { id: true } });
    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: issued.tokenHash,
        expiresAt,
        ipHash: this.ipHash(context.ip),
        ipEncrypted: seller && context.ip ? this.crypto.encrypt(context.ip) : null,
        userAgent: this.safeUserAgent(context.userAgent),
        twoFactorVerifiedAt: twoFactorVerifiedAt ?? null,
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
