'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { adminModules, canAccessModule } from './admin-modules';

const navigation = [
  { href: '/owner', label: 'Boshqaruv', icon: 'dashboard' },
  { href: '/operations#listings', label: 'Mahsulotlar', icon: 'listing' },
  { href: '/operations', label: 'Operatsion modullar', icon: 'operations' },
] as const;
const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'MODERATOR', 'VERIFICATION_ADMIN', 'DISPUTE_ADMIN', 'SUPPORT_ADMIN', 'SECURITY_ADMIN']);

function BrandMark() {
  return (
    <svg className="control-brand__mark" viewBox="0 0 56 56" aria-hidden="true">
      <path
        fill="#f5f2eb"
        fillRule="evenodd"
        d="M10 15h6v-3C16 5.5 20.4 2 26.4 2c6.3 0 10.7 4.2 10.7 10.4v2.7c0 4.5-2.8 8.7-7.9 11.8l-6.8 4.1c-6.4 3.9-9.4 8.5-9.4 13.1 0 2.3 1 4.3 2.8 5.9H8.4c-3.6 0-5.4-2.2-5-5.7l3.1-24.8C6.9 16.4 8 15 10 15Zm10.5 0h12.4v-2.5c0-4-2.6-6.4-6.3-6.4-3.6 0-6.1 2.4-6.1 6.4V15Z"
      />
      <path
        fill="#cf2435"
        d="M39.3 15h4.8c2.3 0 3.6 1.3 4.1 3.9l4.5 24.6c.7 4-1 6.5-4.7 6.5H20.1c-3.8-2.5-5.7-5.8-5.7-9.3 0-4.3 3-8.6 9.1-12.3l6.8-4.1c5.8-3.5 8.9-7.7 9-12.3Z"
      />
    </svg>
  );
}

function NavIcon({ name }: { name: (typeof navigation)[number]['icon'] }) {
  const paths = {
    dashboard: (
      <>
        <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
        <path d="M9 21v-7h6v7" />
      </>
    ),
    verification: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    listing: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M7 9h10M7 13h7M7 17h4" />
      </>
    ),
    payouts: (
      <>
        <rect x="2" y="6" width="20" height="13" rx="2" />
        <path d="M2 10h20M6 15h4" />
      </>
    ),
    operations: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

export function AdminChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [roles, setRoles] = useState<string[]>([]);
  const [hash, setHash] = useState('');
  useEffect(() => {
    const syncHash = () => setHash(window.location.hash.slice(1));
    syncHash();
    window.addEventListener('hashchange', syncHash);
    const api =
      process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
    const refreshRoles = () => void fetch(`${api}/auth/me`, { credentials: 'include', cache: 'no-store' })
      .then(async (response) =>
        response.ok
          ? ((await response.json()) as { user: { roles: string[] } }).user
              .roles
          : [],
      )
      .then((nextRoles) => setRoles(nextRoles.some((role) => ADMIN_ROLES.has(role)) ? nextRoles : []))
      .catch(() => setRoles([]));
    refreshRoles();
    window.addEventListener('admin-auth-changed', refreshRoles);
    return () => { window.removeEventListener('hashchange', syncHash); window.removeEventListener('admin-auth-changed', refreshRoles); };
  }, [pathname]);
  return (
    <div className="control-layout">
      {roles.length > 0 && <aside className="control-sidebar" aria-label="Admin navigatsiyasi">
        <Link className="control-brand" href="/owner">
          <BrandMark />
          <strong>Resaller.uz</strong>
        </Link>
        <nav>
          {navigation.map((item) => {
            const [itemPath, itemHash] = item.href.split('#');
            const current = itemHash
              ? pathname === itemPath && hash === itemHash
              : itemPath === '/owner'
                ? pathname === '/owner' && !hash
                : pathname === itemPath || pathname.startsWith(`${itemPath}/`);
            return (
              <Link
                href={item.href}
                key={item.href}
                aria-current={current ? 'page' : undefined}
                onClick={() => setHash(itemHash ?? '')}
              >
                <span className="control-nav-icon">
                  <NavIcon name={item.icon} />
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
          {roles.length > 0 && (
            <span className="control-nav-heading">Ish modullari</span>
          )}
          {adminModules
            .filter(([key]) => canAccessModule(key, roles))
            .map(([key, label]) => (
              <a
                key={key}
                href={`/operations#${key}`}
                onClick={() => setHash(key)}
                aria-current={
                  pathname === '/operations' && hash === key
                    ? 'page'
                    : undefined
                }
              >
                <span
                  className="control-nav-icon control-nav-icon--module"
                  aria-hidden="true"
                >
                  ›
                </span>
                <span>{label}</span>
              </a>
            ))}
        </nav>
        <div className="control-sidebar__foot">
          <span />
          <strong>Resaller.uz</strong>
          <small>Ishonchli bozor. Katta imkoniyatlar.</small>
        </div>
      </aside>}
      <div className="control-stage">
        {roles.length > 0 && <header className="control-topbar">
          <p className="control-topbar__title">Resaller boshqaruv markazi</p>
          <div className="control-profile">
            <BrandMark />
            <div>
              <strong>Operator paneli</strong>
              <small>Vakolatlar hisobga bog‘langan</small>
            </div>
          </div>
        </header>}
        <div className="control-content">{children}</div>
      </div>
    </div>
  );
}
