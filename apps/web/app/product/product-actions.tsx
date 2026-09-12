'use client';
import { useEffect, useState } from 'react';
type Recent = {
  publicId: string;
  nameUz: string;
  priceMinor: string;
  currency: string;
};
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
export function ProductActions({
  product,
  storePublicId,
}: {
  product: Recent;
  storePublicId: string;
}) {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try {
      const old = JSON.parse(
        localStorage.getItem('resaller-recent') ?? '[]',
      ) as Recent[];
      localStorage.setItem(
        'resaller-recent',
        JSON.stringify(
          [
            product,
            ...old.filter((item) => item.publicId !== product.publicId),
          ].slice(0, 20),
        ),
      );
    } catch {}
  }, [product]);
  async function favorite() {
    const response = await fetch(`${API}/favorites/${product.publicId}`, {
      method: saved ? 'DELETE' : 'POST',
      credentials: 'include',
    });
    if (response.ok) setSaved(!saved);
    else if (response.status === 401) window.location.href = '/login';
  }
  async function ask() {
    const body = window.prompt('Sotuvchiga savolingiz');
    if (!body || body.trim().length < 3) return;
    const response = await fetch(`${API}/questions`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        storePublicId,
        listingPublicId: product.publicId,
        body: body.trim(),
      }),
    });
    if (response.status === 401) window.location.href = '/login';
    else if (response.ok) window.alert('Savol yuborildi.');
  }
  return (
    <div className="flex flex-wrap gap-2">
      <button
        className="min-h-11 rounded-full border border-[var(--line)] px-4 text-sm font-black"
        onClick={() => void favorite()}
        aria-pressed={saved}
      >
        {saved ? '♥ Saqlangan' : '♡ Sevimliga'}
      </button>
      <button
        className="min-h-11 rounded-full border border-[var(--line)] px-4 text-sm font-black"
        onClick={() => void ask()}
      >
        Savol berish
      </button>
    </div>
  );
}
