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
  displayId?: string;
  signal?: string;
  score?: number;
  roles?: string[];
};
const modules = [
  ['orders', 'Buyurtmalar'],
  ['risk-events', 'Risk signallari'],
  ['users', 'Foydalanuvchilar'],
  ['reviews', 'Sharhlar'],
  ['security-events', 'Xavfsizlik'],
  ['disputes', 'Nizolar'],
  ['question-reports', 'Q&A reportlar'],
  ['audit', 'Audit tarixi'],
] as const;
const moduleRoles: Record<(typeof modules)[number][0], string[]> = {
  orders: ['SUPER_ADMIN', 'SUPPORT_ADMIN', 'DISPUTE_ADMIN'],
  'risk-events': ['SUPER_ADMIN', 'SECURITY_ADMIN'],
  users: ['SUPER_ADMIN', 'SUPPORT_ADMIN', 'SECURITY_ADMIN'],
  reviews: ['SUPER_ADMIN', 'MODERATOR'],
  'security-events': ['SUPER_ADMIN', 'SECURITY_ADMIN'],
  disputes: ['SUPER_ADMIN', 'DISPUTE_ADMIN'],
  'question-reports': ['SUPER_ADMIN', 'MODERATOR'],
  audit: ['SUPER_ADMIN', 'SECURITY_ADMIN'],
};
export default function AdminOperations() {
  const [data, setData] = useState<Record<string, Row[]>>({});
  const [active, setActive] = useState<(typeof modules)[number][0]>('users');
  const [message, setMessage] = useState('Modullar yuklanmoqda…');
  const [selected, setSelected] = useState<Row | null>(null);
  const [decision, setDecision] = useState<Row | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [roleTarget, setRoleTarget] = useState<Row | null>(null);
  const load = useCallback(async () => {
    const identity = await fetch(`${API}/auth/me`, {
      credentials: 'include',
      cache: 'no-store',
    });
    const currentRoles = identity.ok
      ? ((await identity.json()) as { user: { roles: string[] } }).user.roles
      : [];
    setRoles(currentRoles);
    const available = modules.filter(([key]) =>
      moduleRoles[key].some((role) => currentRoles.includes(role)),
    );
    if (available.length && !available.some(([key]) => key === active))
      setActive(available[0]![0]);
    const entries = await Promise.all(
      available.map(async ([key]) => {
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
  }, [active]);
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
  async function act(row: Row, reason: string) {
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
    if (active === 'risk-events')
      return patch(`risk-events/${id}/review`, { resolution: reason });
    if (active === 'disputes')
      return patch(`disputes/${id}/decision`, { outcome: 'NO_ACTION', reason });
    if (active === 'question-reports')
      return patch(`question-reports/${id}`, {
        status: 'ACTIONED',
        resolution: reason,
      });
  }
  const rows = data[active] ?? [];
  const visibleModules = modules.filter(([key]) =>
    moduleRoles[key].some((role) => roles.includes(role)),
  );
  return (
    <main className="admin-shell mx-auto max-w-7xl p-5 sm:p-8">
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
        {visibleModules.map(([key, label]) => (
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
                    row.displayId ??
                      row.username ??
                      row.signal ??
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
                active !== 'orders' &&
                !(
                  (active === 'security-events' || active === 'risk-events') &&
                  row.reviewedAt
                ) && (
                  <button
                    className="rs-button"
                    onClick={() => setDecision(row)}
                  >
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
            <button
              className="mt-3 text-sm font-bold text-emerald-300"
              onClick={() => setSelected(row)}
            >
              Tafsilotlarni ko‘rish
            </button>
            {active === 'users' && roles.includes('SUPER_ADMIN') && (
              <button
                className="ml-4 mt-3 text-sm font-bold text-amber-300"
                onClick={() => setRoleTarget(row)}
              >
                Rollarni boshqarish
              </button>
            )}
          </article>
        ))}
      </section>
      {selected && (
        <div
          className="admin-dialog-backdrop"
          role="presentation"
          onClick={() => setSelected(null)}
        >
          <section
            className="admin-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Yozuv tafsilotlari"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-between">
              <div>
                <p className="eyebrow">
                  {modules.find(([key]) => key === active)?.[1]}
                </p>
                <h2 className="text-xl font-black">Operator tekshiruvi</h2>
              </div>
              <button aria-label="Yopish" onClick={() => setSelected(null)}>
                ✕
              </button>
            </div>
            <OperatorDetail row={selected} module={active} />
          </section>
        </div>
      )}
      {decision && (
        <div className="admin-dialog-backdrop" role="presentation">
          <form
            className="admin-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Qarorni tasdiqlash"
            onSubmit={async (event) => {
              event.preventDefault();
              const reason = String(
                new FormData(event.currentTarget).get('reason') ?? '',
              ).trim();
              if (reason.length >= 10) {
                await act(decision, reason);
                setDecision(null);
              }
            }}
          >
            <h2 className="text-xl font-black">Yuqori riskli amal</h2>
            <p className="mt-2 text-sm text-slate-300">
              Qaror audit jurnaliga o‘zgarmas yozuv sifatida tushadi.
            </p>
            <textarea
              className="mt-4 w-full rounded-xl border border-white/10 bg-slate-950 p-3"
              name="reason"
              minLength={10}
              required
              rows={4}
              placeholder="Kamida 10 belgili asos"
            />
            <div className="mt-4 flex gap-2">
              <button className="rs-button">Tasdiqlash</button>
              <button type="button" onClick={() => setDecision(null)}>
                Bekor
              </button>
            </div>
          </form>
        </div>
      )}
      {roleTarget && (
        <div className="admin-dialog-backdrop" role="presentation">
          <form
            className="admin-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Admin rollarini boshqarish"
            onSubmit={async (event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const selectedRoles = data.getAll('roles').map(String);
              const reason = String(data.get('reason') ?? '').trim();
              if (selectedRoles.length && reason.length >= 5) {
                await patch(`users/${String(roleTarget.publicId)}/roles`, {
                  roles: selectedRoles,
                  reason,
                });
                setRoleTarget(null);
              }
            }}
          >
            <h2 className="text-xl font-black">
              @{String(roleTarget.username)} rollari
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                'BUYER',
                'SELLER',
                'STORE_MANAGER',
                'ORDER_OPERATOR',
                'MODERATOR',
                'VERIFICATION_ADMIN',
                'DISPUTE_ADMIN',
                'SUPPORT_ADMIN',
                'SECURITY_ADMIN',
                'SUPER_ADMIN',
              ].map((role) => (
                <label className="flex gap-2 text-sm" key={role}>
                  <input
                    type="checkbox"
                    name="roles"
                    value={role}
                    defaultChecked={roleTarget.roles?.includes(role)}
                  />
                  {role}
                </label>
              ))}
            </div>
            <textarea
              className="mt-4 w-full rounded-xl border border-white/10 bg-slate-950 p-3"
              name="reason"
              minLength={5}
              required
              rows={3}
              placeholder="Rol o‘zgarishi sababi"
            />
            <div className="mt-4 flex gap-2">
              <button className="rs-button">Saqlash</button>
              <button type="button" onClick={() => setRoleTarget(null)}>
                Bekor
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

function OperatorDetail({ row, module }: { row: Row; module: string }) {
  const hidden = new Set(['id', 'publicId']);
  const entries = Object.entries(row).filter(([key]) => !hidden.has(key));
  return (
    <div className="operator-detail mt-5 max-h-[65vh] overflow-auto">
      {module === 'disputes' && Array.isArray(row.evidence) && (
        <section>
          <h3>Dalillar</h3>
          <div className="grid gap-2">
            {(
              row.evidence as Array<{
                id: string;
                fileName: string;
                mimeType: string;
              }>
            ).map((file) => (
              <a
                className="evidence-link"
                href={`${API}/media/private/dispute-evidence/${file.id}`}
                target="_blank"
                rel="noreferrer"
                key={file.id}
              >
                📎 {file.fileName}
                <small>{file.mimeType}</small>
              </a>
            ))}
          </div>
        </section>
      )}
      <dl>
        {entries.map(([key, value]) => (
          <div key={key}>
            <dt>{key.replaceAll('_', ' ')}</dt>
            <dd>
              {value === null || value === undefined ? (
                '—'
              ) : typeof value === 'object' ? (
                <NestedValue value={value} />
              ) : (
                String(value)
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
function NestedValue({ value }: { value: unknown }) {
  if (Array.isArray(value))
    return (
      <div className="nested-list">
        {value.map((item, index) => (
          <article key={index}>
            <NestedValue value={item} />
          </article>
        ))}
      </div>
    );
  if (value && typeof value === 'object')
    return (
      <dl className="nested-object">
        {Object.entries(value as Record<string, unknown>).map(([key, item]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>
              {item && typeof item === 'object' ? (
                <NestedValue value={item} />
              ) : (
                String(item ?? '—')
              )}
            </dd>
          </div>
        ))}
      </dl>
    );
  return <>{String(value ?? '—')}</>;
}
