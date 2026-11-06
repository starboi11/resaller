/**
 * Admin accounts are created and reset ONLY from a shell on the server; the
 * website has no way to grant admin rights.
 *
 *   node dist/scripts/admin-account.js create <username>
 *   node dist/scripts/admin-account.js reset  <username>
 *
 * A 16-character random password (upper, lower, digits; no look-alike
 * characters) is generated here, printed ONCE, and only its scrypt hash is
 * stored. Reset also signs the account out everywhere. Keep the password in a
 * password manager, never in chat, e-mail or screenshots.
 */
import { randomInt } from 'node:crypto';
import { config as loadEnvironment } from 'dotenv';
import { PasswordService } from '../auth/password.service.js';
import { isStrongAdminPassword } from '../auth/auth.service.js';
import { PrismaService } from '../infrastructure/prisma.service.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const LENGTH = 16;

export function generateAdminPassword(): string {
  for (;;) {
    let password = '';
    for (let i = 0; i < LENGTH; i += 1) password += ALPHABET[randomInt(ALPHABET.length)];
    if (isStrongAdminPassword(password)) return password;
  }
}

async function main() {
  loadEnvironment({ path: '../../.env', quiet: true });
  loadEnvironment({ quiet: true });
  const [command, rawUsername] = process.argv.slice(2);
  const username = (rawUsername ?? '').trim().toLowerCase();
  if (!['create', 'reset'].includes(command ?? '') || !/^[a-z0-9_]{3,30}$/.test(username)) {
    console.error('Usage: node dist/scripts/admin-account.js create|reset <username: a-z 0-9 _ , 3-30>');
    process.exitCode = 2;
    return;
  }
  const prisma = new PrismaService();
  const passwords = new PasswordService();
  try {
    const password = generateAdminPassword();
    const passwordHash = await passwords.hash(password);
    const existing = await prisma.user.findUnique({ where: { username }, select: { id: true, roles: true } });
    if (command === 'create') {
      if (existing) throw new Error(`User "${username}" already exists. Use "reset" for an existing admin.`);
      const user = await prisma.user.create({ data: { username, passwordHash, roles: ['SUPER_ADMIN'] } });
      await prisma.securityEvent.create({ data: { userId: user.id, type: 'ADMIN_ACCOUNT_CREATED', severity: 'CRITICAL', metadata: { via: 'server-cli' } } });
    } else {
      if (!existing || !existing.roles.includes('SUPER_ADMIN')) throw new Error(`"${username}" is not an existing SUPER_ADMIN account.`);
      await prisma.$transaction([
        prisma.user.update({ where: { id: existing.id }, data: { passwordHash } }),
        prisma.session.updateMany({ where: { userId: existing.id, revokedAt: null }, data: { revokedAt: new Date() } }),
        prisma.securityEvent.create({ data: { userId: existing.id, type: 'ADMIN_PASSWORD_RESET', severity: 'CRITICAL', metadata: { via: 'server-cli' } } }),
      ]);
    }
    console.log(`\nAdmin account: ${username}\nPassword (shown once, save it in a password manager now):\n\n    ${password}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.endsWith('admin-account.js')) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
