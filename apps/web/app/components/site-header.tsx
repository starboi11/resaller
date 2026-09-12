'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from './theme-toggle';
import { BrandLogo } from './brand-logo';

const links = [
  { href: '/', label: 'Bosh sahifa', icon: '⌂' },
  { href: '/marketplace', label: 'Qidiruv', icon: '⌕' },
  { href: '/cart', label: 'Savat', icon: '🛒' },
  { href: '/orders', label: 'Buyurtmalar', icon: '▣' },
  { href: '/login', label: 'Profil', icon: '○' },
];

export function SiteHeader() {
  const pathname = usePathname();
  const active = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  return (
    <>
      <header className="site-header">
        <div className="shell header-inner">
          <BrandLogo />
          <Link className="header-category" href="/categories">Kategoriyalar⌄</Link>
          <form className="header-search" action="/marketplace">
            <span aria-hidden="true">⌕</span>
            <input name="q" aria-label="Mahsulot qidirish" placeholder="Mahsulot, do‘kon yoki xizmat qidiring..." />
            <kbd>Ctrl K</kbd>
          </form>
          <nav className="desktop-nav" aria-label="Asosiy navigatsiya">
            {[{ href: '/favorites', label: 'Sevimlilar' }, { href: '/orders', label: 'Buyurtmalar' }, { href: '/cart', label: 'Savat' }].map((link) => (
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
            <Link href="/seller/manage" className="sell-link">Sotishni boshlash</Link>
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
