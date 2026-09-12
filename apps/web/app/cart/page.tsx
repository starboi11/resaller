'use client';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { StatePanel } from '@resaller/ui';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
type Item = {
  id: string;
  quantity: number;
  listing: {
    publicId: string;
    nameUz: string;
    priceMinor: string;
    currency: string;
    storeId: string;
  };
};
type Cart = { items: Item[] };

export default function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [message, setMessage] = useState('');
  const [unauthorized, setUnauthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch(`${API}/cart`, {
      credentials: 'include',
      cache: 'no-store',
    });
    if (response.status === 401) {
      setUnauthorized(true);
      return;
    }
    if (response.ok) setCart((await response.json()) as Cart);
    else setMessage('Savatni ochib bo‘lmadi.');
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const total = useMemo(
    () =>
      cart?.items.reduce(
        (sum, item) => sum + Number(item.listing.priceMinor) * item.quantity,
        0,
      ) ?? 0,
    [cart],
  );
  async function quantity(item: Item, next: number) {
    if (next < 1) return remove(item.id);
    setBusy(true);
    await fetch(`${API}/cart/items/${item.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ quantity: next }),
    });
    await load();
    setBusy(false);
  }
  async function remove(id: string) {
    setBusy(true);
    await fetch(`${API}/cart/items/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    await load();
    setBusy(false);
  }
  async function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const response = await fetch(`${API}/checkout`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        delivery: {
          fullName: data.get('fullName'),
          phone: data.get('phone'),
          region: data.get('region'),
          address: data.get('address'),
        },
      }),
    });
    if (response.ok) {
      const result = (await response.json()) as {
        orders: { publicId: string }[];
      };
      window.location.href = result.orders[0]
        ? `/orders/${result.orders[0].publicId}`
        : '/orders';
    } else {
      const error = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setMessage(error?.message ?? 'Buyurtma yaratilmadi.');
    }
    setBusy(false);
  }
  if (unauthorized)
    return (
      <main className="shell max-w-3xl py-10">
        <StatePanel
          tone="warning"
          title="Savat uchun hisobga kiring"
          description="Tanlangan mahsulotlar hisobingizga xavfsiz bog‘lanadi."
          action={
            <Link className="rs-button" href="/login">
              Kirish
            </Link>
          }
        />
      </main>
    );
  return (
    <main className="shell py-10">
      <p className="eyebrow">Xaridni yakunlash</p>
      <h1 className="mt-2 text-3xl font-black">Savat va yetkazib berish</h1>
      {message && (
        <p
          className="mt-4 rounded-xl bg-red-100 p-3 text-sm text-red-800"
          role="alert"
        >
          {message}
        </p>
      )}
      {cart?.items.length === 0 && (
        <div className="mt-8">
          <StatePanel
            title="Savat bo‘sh"
            description="Marketplace’dan kerakli mahsulotlarni tanlang."
            action={
              <Link className="rs-button" href="/marketplace">
                Mahsulot ko‘rish
              </Link>
            }
          />
        </div>
      )}
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
        <section className="grid gap-3">
          {cart?.items.map((item) => (
            <article
              className="surface flex items-center justify-between gap-4 p-5"
              key={item.id}
            >
              <div>
                <Link
                  className="font-black"
                  href={`/product/${item.listing.publicId}`}
                >
                  {item.listing.nameUz}
                </Link>
                <p className="muted mt-1 text-sm">
                  {Number(item.listing.priceMinor).toLocaleString('uz-UZ')}{' '}
                  {item.listing.currency}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="icon-button"
                  disabled={busy}
                  onClick={() => void quantity(item, item.quantity - 1)}
                  aria-label="Kamaytirish"
                >
                  −
                </button>
                <strong>{item.quantity}</strong>
                <button
                  className="icon-button"
                  disabled={busy}
                  onClick={() => void quantity(item, item.quantity + 1)}
                  aria-label="Ko‘paytirish"
                >
                  +
                </button>
                <button
                  className="ml-2 text-sm font-bold text-[var(--danger)]"
                  disabled={busy}
                  onClick={() => void remove(item.id)}
                >
                  O‘chirish
                </button>
              </div>
            </article>
          ))}
        </section>
        {Boolean(cart?.items.length) && (
          <form className="surface h-fit p-5" onSubmit={checkout}>
            <h2 className="text-xl font-black">Yetkazib berish</h2>
            <p className="muted mt-2 text-sm">
              To‘lovni sotuvchi bilan platformadan tashqarida kelishasiz.
            </p>
            <div className="mt-5 grid gap-3">
              <input
                className="field"
                name="fullName"
                required
                minLength={3}
                placeholder="Ism va familiya"
              />
              <input
                className="field"
                name="phone"
                required
                minLength={7}
                placeholder="Telefon"
              />
              <input
                className="field"
                name="region"
                required
                minLength={2}
                placeholder="Viloyat / shahar"
              />
              <textarea
                className="field min-h-24"
                name="address"
                required
                minLength={5}
                placeholder="To‘liq manzil"
              />
            </div>
            <div className="my-5 flex justify-between border-t border-[var(--line)] pt-4">
              <span>Jami</span>
              <strong>{total.toLocaleString('uz-UZ')} UZS</strong>
            </div>
            <button className="rs-button w-full" disabled={busy}>
              {busy ? 'Yaratilmoqda…' : 'Buyurtma berish'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
