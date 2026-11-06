import Link from 'next/link';

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="rs-brand" aria-label="Resaller bosh sahifa">
      <svg className="rs-brand__mark" viewBox="0 0 56 56" aria-hidden="true">
        <path
          className="rs-brand__bag-light"
          fillRule="evenodd"
          d="M10 15h6v-3C16 5.5 20.4 2 26.4 2c6.3 0 10.7 4.2 10.7 10.4v2.7c0 4.5-2.8 8.7-7.9 11.8l-6.8 4.1c-6.4 3.9-9.4 8.5-9.4 13.1 0 2.3 1 4.3 2.8 5.9H8.4c-3.6 0-5.4-2.2-5-5.7l3.1-24.8C6.9 16.4 8 15 10 15Zm10.5 0h12.4v-2.5c0-4-2.6-6.4-6.3-6.4-3.6 0-6.1 2.4-6.1 6.4V15Z"
        />
        <path
          className="rs-brand__bag-red"
          d="M39.3 15h4.8c2.3 0 3.6 1.3 4.1 3.9l4.5 24.6c.7 4-1 6.5-4.7 6.5H20.1c-3.8-2.5-5.7-5.8-5.7-9.3 0-4.3 3-8.6 9.1-12.3l6.8-4.1c5.8-3.5 8.9-7.7 9-12.3Z"
        />
        <path
          className="rs-brand__bag-seam"
          d="M39.3 15c-.1 4.6-3.2 8.8-9 12.3l-6.8 4.1c-6.1 3.7-9.1 8-9.1 12.3 0 3.5 1.9 6.8 5.7 9.3"
        />
      </svg>
      {!compact && (
        <span className="rs-brand__copy">
          <strong>
            RESALLER<span>.uz</span>
          </strong>
          <small>Siz uchun tanlangan</small>
        </span>
      )}
    </Link>
  );
}
