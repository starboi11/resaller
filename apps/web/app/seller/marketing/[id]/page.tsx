'use client';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
type Coupon = {
  id: string;
  code: string;
  kind: string;
  valueMinor: string;
  active: boolean;
  startsAt: string;
  endsAt: string;
  _count: { redemptions: number };
};
type Marketing = {
  coupons: Coupon[];
  promotions: { id: string; type: string; startsAt: string; endsAt: string }[];
};
type Analytics = {
  orders: number;
  completed: number;
  conversionPercent: number;
  revenueMinor: string;
  reviewAverage: number | null;
  reviewCount: number;
  followers: number;
  questions: number;
  lowStock: number;
};
export default function MarketingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [id, setId] = useState('');
  const [data, setData] = useState<Marketing | null>(null);
  const [stats, setStats] = useState<Analytics | null>(null);
  const [message, setMessage] = useState('');
  useEffect(() => {
    void params.then((value) => setId(value.id));
  }, [params]);
  const load = useCallback(async () => {
    if (!id) return;
    const [a, b] = await Promise.all([
      fetch(`${API}/stores/${id}/marketing`, {
        credentials: 'include',
        cache: 'no-store',
      }),
      fetch(`${API}/stores/${id}/analytics`, {
        credentials: 'include',
        cache: 'no-store',
      }),
    ]);
    if (a.ok) setData((await a.json()) as Marketing);
    if (b.ok) setStats((await b.json()) as Analytics);
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  async function post(path: string, body: unknown, method = 'POST') {
    const response = await fetch(`${API}/stores/${id}/${path}`, {
      method,
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    setMessage(response.ok ? 'Saqlandi.' : 'Ma’lumotni tekshiring.');
    if (response.ok) await load();
  }
  async function coupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const d = new FormData(form);
    await post('coupons', {
      code: d.get('code'),
      kind: d.get('kind'),
      valueMinor: Number(d.get('value')),
      minimumMinor: d.get('minimum') ? Number(d.get('minimum')) : undefined,
      usageLimit: d.get('limit') ? Number(d.get('limit')) : undefined,
      buyerLimit: 1,
      startsAt: new Date(String(d.get('startsAt'))).toISOString(),
      endsAt: new Date(String(d.get('endsAt'))).toISOString(),
    });
    form.reset();
  }
  async function promotion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const d = new FormData(form);
    await post('promotions', {
      type: d.get('type'),
      startsAt: new Date(String(d.get('startsAt'))).toISOString(),
      endsAt: new Date(String(d.get('endsAt'))).toISOString(),
      metadata: { title: d.get('title') },
    });
    form.reset();
  }
  return (
    <main className="shell py-10">
      <Link className="muted text-sm" href="/seller/manage">
        ← Do‘kon boshqaruvi
      </Link>
      <p className="eyebrow mt-5">Marketing va natijalar</p>
      <h1 className="mt-2 text-3xl font-black">Kupon, aksiya va analytics</h1>
      <p className="muted mt-2" aria-live="polite">
        {message || 'Oxirgi 30 kunlik ko‘rsatkichlar.'}
      </p>
      <section className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Buyurtma', stats?.orders],
          ['Yakunlangan', stats?.completed],
          ['Konversiya', stats ? `${stats.conversionPercent}%` : '—'],
          [
            'Aylanma',
            stats ? Number(stats.revenueMinor).toLocaleString('uz-UZ') : '—',
          ],
          ['Obunachi', stats?.followers],
          ['Savollar', stats?.questions],
          ['Sharh bahosi', stats?.reviewAverage ?? '—'],
          ['Kam qoldiq', stats?.lowStock],
        ].map(([label, value]) => (
          <article className="surface p-4" key={String(label)}>
            <p className="muted text-xs">{label}</p>
            <p className="mt-2 text-2xl font-black">{value ?? '—'}</p>
          </article>
        ))}
      </section>
      <div className="mt-7 grid gap-6 lg:grid-cols-2">
        <form className="surface grid gap-3 p-5" onSubmit={coupon}>
          <h2 className="text-xl font-black">Kupon yaratish</h2>
          <input className="field" name="code" required placeholder="KOD2026" />
          <select className="field" name="kind">
            <option value="PERCENT">Foiz (basis point)</option>
            <option value="FIXED">Belgilangan summa</option>
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input
              className="field"
              name="value"
              type="number"
              min="1"
              required
              placeholder="Qiymat"
            />
            <input
              className="field"
              name="minimum"
              type="number"
              min="0"
              placeholder="Minimal savat"
            />
          </div>
          <input
            className="field"
            name="limit"
            type="number"
            min="1"
            placeholder="Umumiy limit"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              className="field"
              name="startsAt"
              type="datetime-local"
              required
            />
            <input
              className="field"
              name="endsAt"
              type="datetime-local"
              required
            />
          </div>
          <button className="rs-button">Kupon yaratish</button>
        </form>
        <form className="surface grid gap-3 p-5" onSubmit={promotion}>
          <h2 className="text-xl font-black">Aksiya yaratish</h2>
          <input
            className="field"
            name="title"
            required
            placeholder="Aksiya sarlavhasi"
          />
          <input
            className="field"
            name="type"
            required
            placeholder="BANNER / COLLECTION"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              className="field"
              name="startsAt"
              type="datetime-local"
              required
            />
            <input
              className="field"
              name="endsAt"
              type="datetime-local"
              required
            />
          </div>
          <button className="rs-button">Aksiyani saqlash</button>
        </form>
      </div>
      <section className="surface mt-7 p-5">
        <h2 className="text-xl font-black">Kuponlar</h2>
        <div className="mt-4 grid gap-3">
          {data?.coupons.map((item) => (
            <article
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--surface-2)] p-4"
              key={item.id}
            >
              <div>
                <b>{item.code}</b>
                <p className="muted text-xs">
                  {item.kind} · {item.valueMinor} · {item._count.redemptions}{' '}
                  ishlatilgan
                </p>
              </div>
              <button
                className="rounded-full border border-[var(--line)] px-3 py-2 text-sm font-bold"
                onClick={() =>
                  void post(`coupons/${item.id}/toggle`, {}, 'PATCH')
                }
              >
                {item.active ? 'To‘xtatish' : 'Faollashtirish'}
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
