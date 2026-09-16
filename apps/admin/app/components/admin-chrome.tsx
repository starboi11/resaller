'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navigation = [
  { href: '/', label: 'Boshqaruv', icon: '⌂' },
  { href: '/operations', label: 'Operatsion modullar', icon: '▦' },
];

export function AdminChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
        </nav>
        <div className="control-sidebar__foot">
          <span />
          <strong>Resaller.uz</strong>
          <small>Ishonchli bozor. Katta imkoniyatlar.</small>
        </div>
      </aside>
      <div className="control-stage">
        <header className="control-topbar">
          <label>
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Admin panelda qidirish"
              placeholder="Qidirish…"
            />
            <kbd>Ctrl K</kbd>
          </label>
          <div className="control-profile">
            <span>R</span>
            <div>
              <strong>Admin</strong>
              <small>Bosh administrator</small>
            </div>
          </div>
        </header>
        <div className="control-content">{children}</div>
      </div>
    </div>
  );
}
