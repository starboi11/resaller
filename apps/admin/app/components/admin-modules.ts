export const adminModules = [
  ['listings', 'Mahsulotlar', ['SUPER_ADMIN', 'MODERATOR']],
  ['orders', 'Buyurtmalar', ['SUPER_ADMIN', 'SUPPORT_ADMIN', 'DISPUTE_ADMIN']],
  ['risk-events', 'Risk signallari', ['SUPER_ADMIN', 'SECURITY_ADMIN']],
  [
    'users',
    'Foydalanuvchilar',
    ['SUPER_ADMIN', 'SUPPORT_ADMIN', 'SECURITY_ADMIN'],
  ],
  ['reviews', 'Sharhlar', ['SUPER_ADMIN', 'MODERATOR']],
  ['security-events', 'Xavfsizlik', ['SUPER_ADMIN', 'SECURITY_ADMIN']],
  ['disputes', 'Nizolar', ['SUPER_ADMIN', 'DISPUTE_ADMIN']],
  [
    'question-reports',
    'Savollar bo‘yicha shikoyatlar',
    ['SUPER_ADMIN', 'MODERATOR'],
  ],
  ['audit', 'Audit tarixi', ['SUPER_ADMIN', 'SECURITY_ADMIN']],
] as const;

export type AdminModule = (typeof adminModules)[number][0];

export function canAccessModule(module: AdminModule, roles: string[]) {
  return adminModules
    .find(([key]) => key === module)![2]
    .some((role) => roles.includes(role));
}
