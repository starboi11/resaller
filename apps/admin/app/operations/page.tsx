'use client';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  adminModules,
  canAccessModule,
  type AdminModule,
} from '../components/admin-modules';
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
  nameUz?: string;
  store?: { username: string; nameUz: string; status: string };
};
export default function AdminOperations() {
  const [data, setData] = useState<Record<string, Row[]>>({});
  const [active, setActive] = useState<AdminModule>('users');
  const [message, setMessage] = useState('Modullar yuklanmoqda…');
  const [selected, setSelected] = useState<Row | null>(null);
  const [decision, setDecision] = useState<Row | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [listingTotal, setListingTotal] = useState(0);
  const [listingPage, setListingPage] = useState(1);
  const [roleTarget, setRoleTarget] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const mutationPending = useRef(false);
  const pagePending = useRef(false);
  const [loadingPage, setLoadingPage] = useState(false);
  const load = useCallback(async () => {
    try {
      const identity = await fetch(`${API}/auth/me`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (identity.status === 401 || identity.status === 403) {
        setRoles([]);
        setData({});
        setSelected(null);
        setMessage('Sessiya tugagan yoki admin vakolati yo‘q. Qayta kiring.');
        return false;
      }
      if (!identity.ok) throw new Error('Identity unavailable');
      const currentRoles = identity.ok
        ? ((await identity.json()) as { user: { roles: string[] } }).user.roles
        : [];
      setRoles(currentRoles);
      const available = adminModules.filter(([key]) =>
        canAccessModule(key, currentRoles),
      );
      const requested = window.location.hash.slice(1) as AdminModule;
      if (available.length) {
        if (available.some(([key]) => key === requested)) setActive(requested);
        else setActive(available[0]![0]);
      }
      const entries = await Promise.all(
        available.map(async ([key]) => {
          const response = await fetch(`${API}/admin/${key}`, {
            credentials: 'include',
            cache: 'no-store',
          });
          if (!response.ok) throw new Error('Module unavailable');
          if (key === 'listings' && response.ok) {
            const result = (await response.json()) as {
              items: Row[];
              total: number;
            };
            setListingTotal(result.total);
            setListingPage(1);
            return [key, result.items] as const;
          }
          return [
            key,
            response.ok ? ((await response.json()) as Row[]) : [],
          ] as const;
        }),
      );
      setData(Object.fromEntries(entries));
      setMessage(
        available.length
          ? 'Vakolatingiz bor modullar yangilandi.'
          : 'Bu hisobda admin vakolati yo‘q.',
      );
      return true;
    } catch {
      setMessage(
        'Modullarni yuklab bo‘lmadi. Aloqani tekshiring va yangilash tugmasini bosing.',
      );
      return false;
    }
  }, []);
  async function loadMoreListings() {
    if (pagePending.current) return;
    pagePending.current = true;
    setLoadingPage(true);
    try {
      const next = listingPage + 1;
      const response = await fetch(`${API}/admin/listings?page=${next}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Page unavailable');
      const result = (await response.json()) as { items: Row[]; total: number };
      setData((current) => ({
        ...current,
        listings: [...(current.listings ?? []), ...result.items],
      }));
      setListingTotal(result.total);
      setListingPage(next);
    } catch {
      setMessage(
        'Keyingi mahsulotlarni yuklab bo‘lmadi. Hozirgi ro‘yxat saqlanib turibdi.',
      );
    } finally {
      pagePending.current = false;
      setLoadingPage(false);
    }
  }
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const syncModule = () => {
      const requested = window.location.hash.slice(1) as AdminModule;
      if (
        adminModules.some(([key]) => key === requested) &&
        canAccessModule(requested, roles)
      )
        setActive(requested);
    };
    window.addEventListener('hashchange', syncModule);
    return () => window.removeEventListener('hashchange', syncModule);
  }, [roles]);
  async function patch(path: string, body: unknown) {
    if (mutationPending.current) return false;
    mutationPending.current = true;
    setBusy(true);
    try {
      const response = await fetch(`${API}/admin/${path}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setMessage(
          'Qaror saqlanmadi yoki ruxsat yetarli emas. Kiritilgan asosni tekshiring.',
        );
        return false;
      }
      await load();
      setMessage('Qaror saqlandi va auditga yozildi.');
      return true;
    } catch {
      setMessage(
        'Javob olinmadi. Qayta tasdiqlashdan oldin yangilab, amal natijasini tekshiring.',
      );
      return false;
    } finally {
      mutationPending.current = false;
      setBusy(false);
    }
  }
  async function act(row: Row, reason: string) {
    if (!reason || reason.trim().length < 10) return;
    const id = String(row.id ?? row.publicId);
    if (active === 'users')
      return patch(`users/${id}/status`, {
        status: row.accountStatus === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED',
        reason,
      });
    if (
      active === 'listings' &&
      ['ACTIVE', 'RESTRICTED'].includes(row.status ?? '')
    )
      return patch(`listings/${id}/status`, {
        status: row.status === 'ACTIVE' ? 'RESTRICTED' : 'ACTIVE',
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
  const visibleModules = adminModules.filter(([key]) =>
    canAccessModule(key, roles),
  );
  return (
    <main className="admin-shell mx-auto max-w-7xl p-5 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Control Center</p>
          <h1 className="mt-2 text-3xl font-black">Operatsion modullar</h1>
        </div>
        <button className="rs-button" type="button" onClick={() => void load()}>
          Yangilash
        </button>
        <Link className="rs-button" href="/owner">
          Superadmin boshqaruvi
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
            onClick={() => {
              window.location.hash = key;
              setActive(key);
            }}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${active === key ? 'bg-rose-600 text-white' : 'border border-white/10 bg-white/5'}`}
          >
            {label} ({data[key]?.length ?? 0})
          </button>
        ))}
      </nav>
      <div className="mt-8 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-black sm:text-2xl">
            {adminModules.find(([key]) => key === active)?.[1]} (
            {active === 'listings' ? listingTotal : rows.length})
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Har bir yozuvning tafsilotini ko‘rib, keyingi amalni tanlang.
          </p>
        </div>
      </div>
      <section className="operator-cards mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.length === 0 && (
          <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-slate-400">
            Bu modulda ochiq yozuv yo‘q yoki rolingizda ko‘rish ruxsati mavjud
            emas.
          </p>
        )}
        {rows.map((row, index) => (
          <article
            className="operator-card rounded-2xl border border-white/10 bg-white/5 p-5"
            key={String(row.id ?? row.publicId ?? index)}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <strong className="operator-card__title">
                  {String(
                    row.nameUz ??
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
                    (active === 'listings'
                      ? `@${row.store?.username ?? 'unknown'} · ${row.status ?? ''}`
                      : undefined) ??
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
                (active !== 'listings' ||
                  ['ACTIVE', 'RESTRICTED'].includes(row.status ?? '')) &&
                !(
                  (active === 'security-events' || active === 'risk-events') &&
                  row.reviewedAt
                ) && (
                  <button
                    className="rs-button"
                    onClick={() => setDecision(row)}
                  >
                    {active === 'listings'
                      ? row.status === 'ACTIVE'
                        ? 'Cheklash'
                        : 'Qayta faollashtirish'
                      : active === 'users'
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
              className="mt-3 text-sm font-bold text-rose-300"
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
      {active === 'listings' && rows.length < listingTotal && (
        <button
          className="rs-button mt-5"
          disabled={loadingPage}
          onClick={() => void loadMoreListings()}
        >
          {loadingPage ? 'Yuklanmoqda…' : 'Yana mahsulotlarni yuklash'}
        </button>
      )}
      {selected && (
        <AdminModal
          label="Yozuv tafsilotlari"
          onClose={() => setSelected(null)}
        >
          <section
            className="admin-dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-between">
              <div>
                <p className="eyebrow">
                  {adminModules.find(([key]) => key === active)?.[1]}
                </p>
                <h2 className="text-xl font-black">Operator tekshiruvi</h2>
              </div>
              <button aria-label="Yopish" onClick={() => setSelected(null)}>
                ✕
              </button>
            </div>
            <OperatorDetail row={selected} module={active} />
          </section>
        </AdminModal>
      )}
      {decision && (
        <AdminModal
          label="Qarorni tasdiqlash"
          locked={busy}
          onClose={() => setDecision(null)}
        >
          <form
            className="admin-dialog"
            onSubmit={async (event) => {
              event.preventDefault();
              const reason = String(
                new FormData(event.currentTarget).get('reason') ?? '',
              ).trim();
              if (reason.length >= 10) {
                if (await act(decision, reason)) setDecision(null);
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
              aria-label="Qaror sababi"
              minLength={10}
              required
              rows={4}
              placeholder="Kamida 10 belgili asos"
            />
            <div className="mt-4 flex gap-2">
              <button className="rs-button" disabled={busy}>
                {busy ? 'Saqlanmoqda…' : 'Tasdiqlash'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setDecision(null)}
              >
                Bekor
              </button>
            </div>
          </form>
        </AdminModal>
      )}
      {roleTarget && (
        <AdminModal
          label="Admin rollarini boshqarish"
          locked={busy}
          onClose={() => setRoleTarget(null)}
        >
          <form
            className="admin-dialog"
            onSubmit={async (event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const selectedRoles = data.getAll('roles').map(String);
              const reason = String(data.get('reason') ?? '').trim();
              if (selectedRoles.length && reason.length >= 5) {
                const saved = await patch(
                  `users/${String(roleTarget.publicId)}/roles`,
                  {
                    roles: selectedRoles,
                    reason,
                  },
                );
                if (saved) setRoleTarget(null);
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
              aria-label="Rol o‘zgarishi sababi"
              minLength={5}
              required
              rows={3}
              placeholder="Rol o‘zgarishi sababi"
            />
            <div className="mt-4 flex gap-2">
              <button className="rs-button" disabled={busy}>
                {busy ? 'Saqlanmoqda…' : 'Saqlash'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setRoleTarget(null)}
              >
                Bekor
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </main>
  );
}

function AdminModal({
  label,
  locked = false,
  onClose,
  children,
}: {
  label: string;
  locked?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = previous;
      if (opener?.isConnected) queueMicrotask(() => opener.focus());
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="admin-native-dialog"
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const elements = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
          ),
        ].filter((element) => element.getClientRects().length > 0);
        const first = elements[0];
        const last = elements.at(-1);
        if (!first || !last) {
          event.preventDefault();
          return;
        }
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (!locked) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !locked) onClose();
      }}
    >
      {children}
    </dialog>
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
