'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from './theme-toggle';

const links = [
  { href: '/marketplace', label: 'Bozor', icon: '⌕' },
  { href: '/cart', label: 'Savat', icon: '🛒' },
  { href: '/orders', label: 'Buyurtmalar', icon: '▣' },
  { href: '/seller', label: 'Sotuvchi', icon: '◇' },
  { href: '/login', label: 'Hisob', icon: '○' },
];

export function SiteHeader() {
  const pathname = usePathname();
  const active = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  return (
    <>
      <header className="site-header">
        <div className="shell header-inner">
          <Link href="/" className="brand" aria-label="Resaller bosh sahifa">
            <span className="brand-mark" aria-hidden="true">
              R
            </span>
            <span>Resaller</span>
          </Link>
          <nav className="desktop-nav" aria-label="Asosiy navigatsiya">
            {links.slice(0, 4).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active(link.href) ? 'page' : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <ThemeToggle />
            <Link href="/login" className="account-link">
              Kirish
            </Link>
          </div>
        </div>
      </header>
      <nav className="mobile-nav" aria-label="Mobil navigatsiya">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active(link.href) ? 'page' : undefined}
          >
            <span aria-hidden="true">{link.icon}</span>
            <small>{link.label}</small>
          </Link>
        ))}
      </nav>
    </>
  );
}
