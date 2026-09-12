import Link from 'next/link';

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="rs-brand" aria-label="Resaller bosh sahifa">
      <svg className="rs-brand__mark" viewBox="0 0 56 56" aria-hidden="true">
        <defs>
          <linearGradient id="silver" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset=".45" stopColor="#8f9ca3" />
            <stop offset="1" stopColor="#f2f5f5" />
          </linearGradient>
          <linearGradient id="emerald" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#00a979" />
            <stop offset="1" stopColor="#24f2c0" />
          </linearGradient>
        </defs>
        <path d="M12 9h25c8 0 13 4 13 11 0 5-3 9-8 11l9 16H39L29 29h7c3 0 5-2 5-5s-2-5-6-5H18z" fill="url(#silver)" />
        <path d="M5 47 30 19l7 9L19 47z" fill="url(#emerald)" />
        <path d="m21 36 17-19-3 16z" fill="#00c897" />
      </svg>
      {!compact && (
        <span className="rs-brand__copy">
          <strong>RESALLER<span>.uz</span></strong>
          <small>BUY · SELL · <b>GROW</b></small>
        </span>
      )}
    </Link>
  );
}
