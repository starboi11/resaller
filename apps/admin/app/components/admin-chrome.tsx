'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { adminModules, canAccessModule } from './admin-modules';

const navigation = [
  { href: '/', label: 'Boshqaruv', icon: 'dashboard' },
  {
    href: '/#verification',
    label: 'Sotuvchini tekshirish',
    icon: 'verification',
  },
  { href: '/#listings', label: 'Mahsulot moderatsiyasi', icon: 'listing' },
  { href: '/operations', label: 'Operatsion modullar', icon: 'operations' },
] as const;

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
    void fetch(`${api}/auth/me`, { credentials: 'include', cache: 'no-store' })
      .then(async (response) =>
        response.ok
          ? ((await response.json()) as { user: { roles: string[] } }).user
              .roles
          : [],
      )
      .then(setRoles)
      .catch(() => setRoles([]));
    return () => window.removeEventListener('hashchange', syncHash);
  }, [pathname]);
  return (
    <div className="control-layout">
      <aside className="control-sidebar" aria-label="Admin navigatsiyasi">
        <Link className="control-brand" href="/">
          <span>R</span>
          <strong>Resaller.uz</strong>
        </Link>
        <nav>
          {navigation.map((item) => {
            const [itemPath, itemHash] = item.href.split('#');
            const current = itemHash
              ? pathname === itemPath && hash === itemHash
              : itemPath === '/'
                ? pathname === '/' && !hash
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
              <Link
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
              </Link>
            ))}
        </nav>
        <div className="control-sidebar__foot">
          <span />
          <strong>Resaller.uz</strong>
          <small>Ishonchli bozor. Katta imkoniyatlar.</small>
        </div>
      </aside>
      <div className="control-stage">
        <header className="control-topbar">
          <p className="control-topbar__title">Resaller boshqaruv markazi</p>
          <div className="control-profile">
            <span>R</span>
            <div>
              <strong>Operator paneli</strong>
              <small>Vakolatlar hisobga bog‘langan</small>
            </div>
          </div>
        </header>
        <div className="control-content">{children}</div>
      </div>
    </div>
  );
}
