'use client';

import Link from 'next/link';
import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export function AddToCart({ listingPublicId, variantId, disabled }: { listingPublicId: string; variantId: string; disabled: boolean }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'login' | 'error'>('idle');
  async function add() {
    setState('busy');
    try {
      const response = await fetch(`${API}/cart/items`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ listingPublicId, variantId, quantity: 1 }) });
      if (response.status === 401) return setState('login');
      setState(response.ok ? 'done' : 'error');
    } catch { setState('error'); }
  }
  return <div><button className="rs-button w-full sm:w-auto" disabled={disabled || state === 'busy'} onClick={() => void add()}>{disabled ? 'Hozir mavjud emas' : state === 'busy' ? 'Qo‘shilmoqda…' : state === 'done' ? 'Savatga qo‘shildi ✓' : 'Savatga qo‘shish'}</button>{state === 'login' && <p className="mt-3 text-sm text-[var(--warning)]">Savat uchun <Link className="font-black underline" href="/login">hisobga kiring</Link>.</p>}{state === 'error' && <p className="mt-3 text-sm font-bold text-[var(--danger)]" role="alert">Qo‘shib bo‘lmadi. Qayta urinib ko‘ring.</p>}</div>;
}
