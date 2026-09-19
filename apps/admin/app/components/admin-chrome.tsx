'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { adminModules, canAccessModule } from './admin-modules';

const navigation = [
  { href: '/', label: 'Boshqaruv', icon: '⌂' },
  { href: '/#verification', label: 'Verification', icon: '✓' },
  { href: '/#listings', label: 'Listing moderatsiyasi', icon: '□' },
  { href: '/operations', label: 'Operatsion modullar', icon: '▦' },
];

export function AdminChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [roles, setRoles] = useState<string[]>([]);
  const [hash, setHash] = useState('');
  useEffect(() => {
    const syncHash = () => setHash(window.location.hash.slice(1));
    syncHash();
    window.addEventListener('hashchange', syncHash);
    const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
    void fetch(`${api}/auth/me`, { credentials: 'include', cache: 'no-store' })
      .then(async (response) => response.ok ? (await response.json() as { user: { roles: string[] } }).user.roles : [])
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
            const current =
              pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                href={item.href}
                key={item.href}
                aria-current={current ? 'page' : undefined}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
          {roles.length > 0 && <span className="control-nav-heading">Ish modullari</span>}
          {adminModules.filter(([key]) => canAccessModule(key, roles)).map(([key, label]) => (
            <Link
              key={key}
              href={`/operations#${key}`}
              aria-current={pathname === '/operations' && hash === key ? 'page' : undefined}
            >
              <span aria-hidden="true">›</span>
              {label}
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
