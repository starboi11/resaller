'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from './theme-toggle';
import { BrandLogo } from './brand-logo';

const links = [
  { href: '/', label: 'Bosh sahifa', icon: 'M3 10 12 3l9 7v11h-6v-7H9v7H3Z' },
  {
    href: '/marketplace',
    label: 'Katalog',
    icon: 'M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z',
  },
  { href: '/cart', label: 'Savat', icon: 'M2 3h3l3 12h11l3-9H6M9 19v2m9-2v2' },
  {
    href: '/account',
    label: 'Hisob',
    icon: 'M4 21v-2a8 8 0 0 1 16 0v2ZM16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  },
];

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export function SiteHeader() {
  const pathname = usePathname();
  const searchRef = useRef<HTMLInputElement>(null);
  // Only the owner sells, so buyers get no seller entry point. The owner's
  // management link is a convenience; the server still checks every request.
  const [isOwner, setIsOwner] = useState(false);
  useEffect(() => {
    fetch(`${API}/seller/owner-status`, {
      credentials: 'include',
      cache: 'no-store',
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { isOwner?: boolean } | null) =>
        setIsOwner(body?.isOwner === true),
      )
      .catch(() => setIsOwner(false));
  }, []);
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
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
            <span>Kategoriyalar</span>
            <span aria-hidden="true">⌄</span>
          </Link>
          <form className="header-search" action="/marketplace">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <circle cx="10.5" cy="10.5" r="7" />
              <path d="m16 16 5 5" />
            </svg>
            <input
              ref={searchRef}
              name="q"
              aria-label="Mahsulot qidirish"
              placeholder="Nimani qidiryapsiz?"
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
                <span>{link.accessible}</span>
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <div className="header-theme-mobile">
              <ThemeToggle />
            </div>
            <details className="header-account">
              <summary>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="7" r="4" />
                  <path d="M4 21v-2a8 8 0 0 1 16 0v2H4Z" />
                </svg>
                <span>Mening hisobim</span>
                <span aria-hidden="true">⌄</span>
              </summary>
              <div className="header-account__menu">
                <Link href="/account">Shaxsiy kabinet</Link>
                <Link href="/orders">Buyurtmalarim</Link>
                <a
                  href="#resaller-support"
                  onClick={(event) =>
                    event.currentTarget
                      .closest('details')
                      ?.removeAttribute('open')
                  }
                >
                  Yordam va bog‘lanish
                </a>
                {isOwner && (
                  <Link href="/seller/manage">Do‘kon boshqaruvi</Link>
                )}
                <ThemeToggle />
              </div>
            </details>
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
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={link.icon} />
            </svg>
            <small>{link.label}</small>
          </Link>
        ))}
      </nav>
    </>
  );
}
