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
    store: { publicId: string; nameUz: string };
  };
};
type Cart = { items: Item[] };
type Address = {
  publicId: string;
  label: string;
  fullName: string;
  phone: string;
  region: string;
  address: string;
  isDefault: boolean;
};

export default function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  // Name and phone from registration prefill the delivery form.
  const [profile, setProfile] = useState<{ fullName: string | null; phone: string | null } | null>(null);
  useEffect(() => {
    fetch(`${API}/auth/profile`, { credentials: 'include', cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { fullName: string | null; phone: string | null } | null) => setProfile(body))
      .catch(() => setProfile(null));
  }, []);
  const load = useCallback(async () => {
    try {
      const response = await fetch(`${API}/cart`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (response.status === 401) {
        setUnauthorized(true);
        return;
      }
      if (!response.ok) throw new Error('Cart unavailable');
      setCart((await response.json()) as Cart);
      setLoadError(false);
      const saved = await fetch(`${API}/addresses`, {
        credentials: 'include',
        cache: 'no-store',
      }).catch(() => null);
      if (saved?.ok) setAddresses((await saved.json()) as Address[]);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
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
        // One seller, one coupon field. The API still keys coupons by store.
        couponCodes: Object.fromEntries(
          Array.from(
            new Set(
              cart?.items.map((item) => item.listing.store.publicId) ?? [],
            ),
          )
            .map((storeId) => [storeId, String(data.get('coupon') ?? '').trim()])
            .filter(([, code]) => code),
        ),
        saveAddress: data.get('saveAddress') === 'on',
        addressLabel: data.get('addressLabel'),
      }),
    });
    if (response.ok) {
      const result = (await response.json()) as {
        orders: { publicId: string }[];
      };
      const orderIds = result.orders.map((order) => order.publicId).join(',');
      window.location.href = `/checkout/success?checkout=${encodeURIComponent((result as { checkoutPublicId?: string }).checkoutPublicId ?? '')}&orders=${encodeURIComponent(orderIds)}`;
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
    <main className="shell py-10 buyer-workspace cart-workspace">
      <p className="eyebrow">Xaridni yakunlash</p>
      <h1 className="mt-2 text-3xl font-black">Savat va yetkazib berish</h1>
      <ol className="checkout-steps mt-6" aria-label="Checkout bosqichlari">
        <li className="is-active">
          <b>1</b>
          <span>Savat</span>
        </li>
        <li>
          <b>2</b>
          <span>Kontakt</span>
        </li>
        <li>
          <b>3</b>
          <span>Yetkazish</span>
        </li>
        <li>
          <b>4</b>
          <span>Tasdiqlash</span>
        </li>
      </ol>
      {loading && (
        <div className="mt-8">
          <StatePanel
            title="Savat yuklanmoqda"
            description="Mahsulotlaringiz tekshirilmoqda."
          />
        </div>
      )}
      {loadError && !loading && (
        <div className="mt-8">
          <StatePanel
            tone="danger"
            title="Savatni ochib bo‘lmadi"
            description="Aloqani tekshirib, qayta urinib ko‘ring. Savatingiz o‘chirilgani yo‘q."
            action={
              <button
                className="rs-button"
                type="button"
                onClick={() => {
                  setLoading(true);
                  void load();
                }}
              >
                Qayta urinish
              </button>
            }
          />
        </div>
      )}
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
            icon={
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
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
            }
            action={
              <Link className="rs-button" href="/marketplace">
                Mahsulot ko‘rish
              </Link>
            }
          />
        </div>
      )}
      {Boolean(cart?.items.length) && (
        <div className="buyer-layout mt-8 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
          <section className="cart-items grid gap-3">
            {cart?.items.map((item) => (
              <article
                className="surface cart-line flex items-center justify-between gap-4 p-5"
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
            <form
              className="surface checkout-card h-fit p-5"
              onSubmit={checkout}
            >
              <h2 className="text-xl font-black">Yetkazib berish</h2>
              <p className="muted mt-2 text-sm">
                To‘lovni sotuvchi bilan platformadan tashqarida kelishasiz.
              </p>
              <div className="mt-5 grid gap-3">
                {addresses.length > 0 && (
                  <label className="checkout-field">
                    <span>Saqlangan manzil</span>
                    <select
                      className="field"
                      defaultValue=""
                      onChange={(event) => {
                        const selected = addresses.find(
                          (item) => item.publicId === event.target.value,
                        );
                        const form = event.currentTarget.form;
                        if (!selected || !form) return;
                        for (const key of [
                          'fullName',
                          'phone',
                          'region',
                          'address',
                        ] as const) {
                          const field = form.elements.namedItem(key) as
                            HTMLInputElement | HTMLTextAreaElement | null;
                          if (field) field.value = selected[key];
                        }
                      }}
                    >
                      <option value="">Yangi manzil</option>
                      {addresses.map((item) => (
                        <option key={item.publicId} value={item.publicId}>
                          {item.label} · {item.region}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="checkout-field">
                  <span>Ism va familiya</span>
                  <input
                    className="field"
                    name="fullName"
                    key={`name-${profile?.fullName ?? ''}`}
                    defaultValue={profile?.fullName ?? ''}
                    autoComplete="name"
                    required
                    minLength={3}
                    placeholder="Ism va familiya"
                  />
                </label>
                <label className="checkout-save">
                  <input type="checkbox" name="saveAddress" />{' '}
                  <span>Bu manzilni keyingi xarid uchun saqlash</span>
                </label>
                <label className="checkout-field">
                  <span>Manzil nomi</span>
                  <input
                    className="field"
                    name="addressLabel"
                    maxLength={40}
                    placeholder="Masalan: Uy"
                  />
                </label>
                <label className="checkout-field">
                  <span>Telefon raqam</span>
                  <input
                    className="field"
                    name="phone"
                    key={`phone-${profile?.phone ?? ''}`}
                    defaultValue={profile?.phone ?? ''}
                    type="tel"
                    autoComplete="tel"
                    required
                    minLength={7}
                    placeholder="Telefon"
                  />
                </label>
                <label className="checkout-field">
                  <span>Viloyat yoki shahar</span>
                  <input
                    className="field"
                    name="region"
                    autoComplete="address-level1"
                    required
                    minLength={2}
                    placeholder="Viloyat / shahar"
                  />
                </label>
                <label className="checkout-field">
                  <span>To‘liq manzil</span>
                  <textarea
                    className="field min-h-24"
                    name="address"
                    autoComplete="street-address"
                    required
                    minLength={5}
                    placeholder="To‘liq manzil"
                  />
                </label>
                <label className="checkout-field">
                  <span>Kupon kodi</span>
                  <input className="field" name="coupon" autoComplete="off" placeholder="Agar bo‘lsa, kupon kodini kiriting" />
                </label>
              </div>
              <div className="my-5 flex justify-between border-t border-[var(--line)] pt-4">
                <span>Jami</span>
                <strong>{total.toLocaleString('uz-UZ')} UZS</strong>
              </div>
              <button className="rs-button w-full" disabled={busy}>
                {busy ? 'Yaratilmoqda…' : 'Buyurtma berish'}
              </button>
              <p className="checkout-assurance">
                Buyurtmangiz Resaller’ga yuboriladi. Tasdiqlash holatini
                buyurtma sahifasida kuzating.
              </p>
            </form>
          )}
        </div>
      )}
    </main>
  );
}
