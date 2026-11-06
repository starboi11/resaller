'use client';

import Link from 'next/link';
import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export function HomeCartButton({
  listingPublicId,
  variantId,
  name,
}: {
  listingPublicId: string;
  variantId?: string;
  name: string;
}) {
  const [state, setState] = useState<
    'idle' | 'busy' | 'done' | 'login' | 'error'
  >('idle');

  async function add() {
    if (!variantId) return;
    setState('busy');
    try {
      const response = await fetch(`${API}/cart/items`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ listingPublicId, variantId, quantity: 1 }),
      });
      setState(
        response.status === 401 ? 'login' : response.ok ? 'done' : 'error',
      );
    } catch {
      setState('error');
    }
  }

  return (
    <div className="home-cart">
      <button
        type="button"
        className="home-cart__button"
        onClick={() => void add()}
        disabled={!variantId || state === 'busy'}
        aria-label={
          state === 'done'
            ? `${name} savatga qo‘shildi`
            : `${name}ni savatga qo‘shish`
        }
        title={!variantId ? 'Mahsulot tugagan' : 'Savatga qo‘shish'}
      >
        {state === 'done' ? (
          <span aria-hidden="true">✓</span>
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
      </button>
      {state === 'login' && (
        <p className="home-cart__feedback" role="status">
          Savat uchun <Link href="/login">hisobga kiring</Link>.
        </p>
      )}
      {state === 'error' && (
        <p className="home-cart__feedback" role="alert">
          Qo‘shib bo‘lmadi.
        </p>
      )}
    </div>
  );
}
