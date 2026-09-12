'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
type Row = Record<string, unknown> & {
  id?: string;
  publicId?: string;
  username?: string;
  status?: string;
  type?: string;
  severity?: string;
  reason?: string;
  rating?: number;
  body?: string;
  accountStatus?: string;
  reviewedAt?: string;
};
const modules = [
  ['users', 'Foydalanuvchilar'],
  ['reviews', 'Sharhlar'],
  ['security-events', 'Xavfsizlik'],
  ['disputes', 'Nizolar'],
  ['question-reports', 'Q&A reportlar'],
  ['audit', 'Audit tarixi'],
] as const;
export default function AdminOperations() {
  const [data, setData] = useState<Record<string, Row[]>>({});
  const [active, setActive] = useState<(typeof modules)[number][0]>('users');
  const [message, setMessage] = useState('Modullar yuklanmoqda…');
  const load = useCallback(async () => {
    const entries = await Promise.all(
      modules.map(async ([key]) => {
        const response = await fetch(`${API}/admin/${key}`, {
          credentials: 'include',
          cache: 'no-store',
        });
        return [
          key,
          response.ok ? ((await response.json()) as Row[]) : [],
        ] as const;
      }),
    );
    setData(Object.fromEntries(entries));
    setMessage('Vakolatingiz bor modullar yangilandi.');
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function patch(path: string, body: unknown) {
    const response = await fetch(`${API}/admin/${path}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    setMessage(
      response.ok
        ? 'Qaror saqlandi va auditga yozildi.'
        : 'Qaror saqlanmadi yoki ruxsat yetarli emas.',
    );
    if (response.ok) await load();
  }
  async function act(row: Row) {
    const reason = window.prompt('Qaror sababini yozing (kamida 10 belgi)');
    if (!reason || reason.trim().length < 10) return;
    const id = String(row.id ?? row.publicId);
    if (active === 'users')
      return patch(`users/${id}/status`, {
        status: row.accountStatus === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED',
        reason,
      });
    if (active === 'reviews')
      return patch(`reviews/${id}`, {
        status: row.status === 'HIDDEN' ? 'VISIBLE' : 'HIDDEN',
        reason,
      });
    if (active === 'security-events')
      return patch(`security-events/${id}/resolve`, { resolution: reason });
    if (active === 'disputes')
      return patch(`disputes/${id}/decision`, { outcome: 'NO_ACTION', reason });
    if (active === 'question-reports')
      return patch(`question-reports/${id}`, {
        status: 'ACTIONED',
        resolution: reason,
      });
  }
  const rows = data[active] ?? [];
  return (
    <main className="mx-auto max-w-7xl p-5 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Control Center</p>
          <h1 className="mt-2 text-3xl font-black">Operatsion modullar</h1>
        </div>
        <Link className="rs-button" href="/">
          Moderatsiya navbati
        </Link>
      </div>
      <p
        className="mt-5 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300"
        aria-live="polite"
      >
        {message}
      </p>
      <nav
        className="mt-6 flex gap-2 overflow-x-auto pb-2"
        aria-label="Admin modullari"
      >
        {modules.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActive(key)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${active === key ? 'bg-emerald-500 text-slate-950' : 'border border-white/10 bg-white/5'}`}
          >
            {label} ({data[key]?.length ?? 0})
          </button>
        ))}
      </nav>
      <section className="mt-6 grid gap-3">
        {rows.length === 0 && (
          <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-slate-400">
            Bu modulda ochiq yozuv yo‘q yoki rolingizda ko‘rish ruxsati mavjud
            emas.
          </p>
        )}
        {rows.map((row, index) => (
          <article
            className="rounded-2xl border border-white/10 bg-white/5 p-5"
            key={String(row.id ?? row.publicId ?? index)}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <strong>
                  {String(
                    row.username ??
                      row.type ??
                      row.status ??
                      row.reason ??
                      `Yozuv ${index + 1}`,
                  )}
                </strong>
                <p className="mt-1 text-sm text-slate-400">
                  {String(
                    row.accountStatus ??
                      row.severity ??
                      row.body ??
                      row.reason ??
                      'Audit yozuvi',
                  )}
                </p>
                {row.rating !== undefined && (
                  <p className="mt-2 text-sm">Baho: {row.rating}/5</p>
                )}
              </div>
              {active !== 'audit' &&
                !(active === 'security-events' && row.reviewedAt) && (
                  <button className="rs-button" onClick={() => void act(row)}>
                    {active === 'users'
                      ? row.accountStatus === 'SUSPENDED'
                        ? 'Faollashtirish'
                        : 'To‘xtatish'
                      : active === 'reviews'
                        ? 'Ko‘rinishni almashtirish'
                        : active === 'security-events'
                          ? 'Hal qilish'
                          : active === 'disputes'
                            ? 'Qaror chiqarish'
                            : 'Moderatsiya'}
                  </button>
                )}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
