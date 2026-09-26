'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from './theme-toggle';
import { BrandLogo } from './brand-logo';

const links = [
  { href: '/', label: 'Bosh sahifa', icon: '⌂' },
  { href: '/marketplace', label: 'Qidiruv', icon: '⌕' },
  { href: '/cart', label: 'Savat', icon: '🛒' },
  { href: '/orders', label: 'Buyurtmalar', icon: '▣' },
  { href: '/account', label: 'Profil', icon: '○' },
];

export function SiteHeader() {
  const pathname = usePathname();
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    document.addEventListener('keydown', focusSearch);
    return () => document.removeEventListener('keydown', focusSearch);
  }, []);
  const active = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  return (
    <>
      <header className="site-header">
        <div className="shell header-inner">
          <BrandLogo />
          <Link className="header-category" href="/categories">
            Kategoriyalar⌄
          </Link>
          <form className="header-search" action="/marketplace">
            <span aria-hidden="true">⌕</span>
            <input
              ref={searchRef}
              name="q"
              aria-label="Mahsulot qidirish"
              placeholder="Mahsulot, do‘kon yoki xizmat qidiring..."
            />
            <kbd>Ctrl K</kbd>
          </form>
          <nav className="desktop-nav" aria-label="Asosiy navigatsiya">
            {[
              { href: '/favorites', accessible: 'Sevimlilar', icon: 'heart' },
              { href: '/cart', accessible: 'Savat', icon: 'cart' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-label={link.accessible}
                aria-current={active(link.href) ? 'page' : undefined}
              >
                {link.icon === 'heart' ? (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
                  </svg>
                ) : (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="9" cy="21" r="1" />
                    <circle cx="19" cy="21" r="1" />
                    <path d="M2 2h2l2.5 13h13.2l2-9H5" />
                  </svg>
                )}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <ThemeToggle />
            <Link href="/account" className="account-link">
              Hisob
            </Link>
            <Link href="/seller/manage" className="sell-link">
              Sotishni boshlash
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
