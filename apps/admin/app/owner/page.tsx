'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
type Verification = {
  id: string;
  legalName: string;
  documentType: string;
  documentNumberMasked: string;
  documentAvailable: boolean;
  sellerProfile: { user: { username: string } };
};
type Queue = {
  verifications: Verification[];
  openDisputes: number;
  securityEvents24h: number;
};
type Overview = {
  metrics: { visitorsToday: number; visitorDays30: number; pageViews30: number; ordersPlaced: number; ordersCompleted: number; storesActive: number; listingsPublished: number; listingsTotal: number };
  recentAudit: Array<{ id: string; action: string; targetType: string; createdAt: string; actor: { username: string } | null }>;
  recentOrders: Array<{ publicId: string; displayId: string; status: string; store: { username: string } }>;
  recentListings: Array<{ publicId: string; nameUz: string; status: string; store: { username: string } }>;
};
type SellerLogin = {
  id: string;
  createdAt: string;
  ip: string | null;
  userAgent: string | null;
  user: { publicId: string; username: string; sellerProfile: { verification: { legalName: string; phoneMasked: string | null; documentNumberMasked: string } | null } | null };
};
type SellerPrivateDetails = { username: string; legalName: string; documentType: string; documentNumber: string | null; phone: string | null; residenceAddress: string | null };
type TwoFactor = {
  mode: 'ENROLL' | 'VERIFY';
  challengeToken: string;
  secret?: string;
  provisioningUri?: string;
};
type Decision = {
  kind: 'listings' | 'verifications';
  id: string;
  status: string;
  title: string;
};

export default function AdminHome() {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [sellerLogins, setSellerLogins] = useState<SellerLogin[]>([]);
  const [selectedSeller, setSelectedSeller] = useState<string | null>(null);
  const [privateDetails, setPrivateDetails] = useState<SellerPrivateDetails | null>(null);
  const [privateReason, setPrivateReason] = useState('');
  const [message, setMessage] = useState('Tekshirilmoqda…');
  const [busy, setBusy] = useState(false);
  const [twoFactor, setTwoFactor] = useState<TwoFactor | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const load = useCallback(async () => {
    const identity = await fetch(`${API}/auth/me`, { credentials: 'include', cache: 'no-store' });
    const roles = identity.ok ? ((await identity.json()) as { user: { roles: string[] } }).user.roles : [];
    if (!roles.includes('SUPER_ADMIN')) {
      setQueue(null);
      setOverview(null);
      setSellerLogins([]);
      setMessage(identity.ok ? 'Bu sahifa faqat superadmin uchun.' : 'Superadmin akkauntiga kiring.');
      return;
    }
    const response = await fetch(`${API}/admin/queue`, {
      credentials: 'include',
      cache: 'no-store',
    });
    if (response.status === 401) {
      setMessage('Admin akkauntiga kiring.');
      setQueue(null);
      return;
    }
    if (response.status === 403) {
      setMessage('Bu akkauntda moderator ruxsati yo‘q.');
      setQueue(null);
      return;
    }
    if (!response.ok) {
      setMessage('Admin API hozir javob bermadi.');
      setQueue(null);
      return;
    }
    setQueue((await response.json()) as Queue);
    const overviewResponse = await fetch(`${API}/admin/overview`, { credentials: 'include', cache: 'no-store' });
    setOverview(overviewResponse.ok ? ((await overviewResponse.json()) as Overview) : null);
    const loginResponse = await fetch(`${API}/admin/seller-login-history`, { credentials: 'include', cache: 'no-store' });
    setSellerLogins(loginResponse.ok ? ((await loginResponse.json()) as SellerLogin[]) : []);
    setMessage(overviewResponse.ok ? 'Kuzatuv ma’lumotlari yangilandi.' : 'Statistika hozir yuklanmadi.');
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function revealSeller(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSeller || privateReason.trim().length < 10) return;
    setPrivateDetails(null);
    const response = await fetch(`${API}/admin/sellers/${encodeURIComponent(selectedSeller)}/private-details`, {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: privateReason.trim() }),
    });
    setPrivateDetails(response.ok ? ((await response.json()) as SellerPrivateDetails) : null);
    if (!response.ok) setMessage('Shaxsiy ma’lumotlar ochilmadi. Ruxsat va sababni tekshiring.');
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const values = new FormData(event.currentTarget);
    const response = await fetch(`${API}/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: values.get('username'),
        password: values.get('password'),
      }),
    });
    const payload = response.ok
      ? ((await response.json()) as { twoFactor?: TwoFactor })
      : null;
    if (payload?.twoFactor) {
      setTwoFactor(payload.twoFactor);
      setMessage(
        payload.twoFactor.mode === 'ENROLL'
          ? 'Authenticator ilovasini ulang va 6 xonali kodni kiriting.'
          : 'Authenticator kodini kiriting.',
      );
    } else {
      setMessage(
        response.ok ? 'Kirish muvaffaqiyatli.' : 'Login yoki parol noto‘g‘ri.',
      );
      if (response.ok) await load();
      if (response.ok) window.dispatchEvent(new Event('admin-auth-changed'));
    }
    setBusy(false);
  }

  async function verifyTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!twoFactor) return;
    setBusy(true);
    const values = new FormData(event.currentTarget);
    const response = await fetch(`${API}/auth/2fa/verify`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        challengeToken: twoFactor.challengeToken,
        code: values.get('code'),
      }),
    });
    if (response.ok) {
      setTwoFactor(null);
      setMessage('Ikki bosqichli himoya tasdiqlandi.');
      await load();
      window.dispatchEvent(new Event('admin-auth-changed'));
    } else setMessage('Kod noto‘g‘ri yoki muddati tugagan. Qayta kiring.');
    setBusy(false);
  }

  async function moderate(
    kind: 'listings',
    publicId: string,
    status: string,
    reason: string,
  ) {
    setBusy(true);
    const response = await fetch(`${API}/admin/${kind}/${publicId}/status`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status, reason: reason.trim() }),
    });
    setMessage(
      response.ok
        ? 'Qaror saqlandi va auditga yozildi.'
        : 'Qarorni saqlab bo‘lmadi.',
    );
    if (response.ok) await load();
    setBusy(false);
  }

  async function verify(
    id: string,
    status: 'APPROVED' | 'REJECTED',
    reason: string,
  ) {
    setBusy(true);
    const response = await fetch(`${API}/admin/verifications/${id}/status`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status, reason: reason.trim() }),
    });
    setMessage(
      response.ok
        ? 'Verification qarori audit bilan saqlandi.'
        : 'Verification qarorini saqlab bo‘lmadi.',
    );
    if (response.ok) await load();
    setBusy(false);
  }
  async function submitDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!decision) return;
    const reason = String(
      new FormData(event.currentTarget).get('reason') ?? '',
    ).trim();
    if (reason.length < 3) return;
    if (decision.kind === 'verifications')
      await verify(
        decision.id,
        decision.status as 'APPROVED' | 'REJECTED',
        reason,
      );
    else await moderate(decision.kind, decision.id, decision.status, reason);
    setDecision(null);
  }

  return (
    <main className="admin-shell mx-auto max-w-6xl p-5 sm:p-8">
      <header className="flex flex-col gap-5 border-b border-white/10 pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Resaller Owner Control Center</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">
            Superadmin boshqaruvi
          </h1>
          <p className="mt-2 text-sm text-slate-400">
              Mahsulotlar, buyurtmalar va do‘kon xavfsizligini kuzating.
          </p>
        </div>
        <div className="flex gap-2">
          <Link className="rs-button" href="/operations">
            Barcha modullar
          </Link>
          <button
            className="rs-button"
            disabled={busy}
            onClick={() => void load()}
          >
            Yangilash
          </button>
        </div>
      </header>
      <p
        className="mt-5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300"
        aria-live="polite"
      >
        {message}
      </p>
      {!queue && !twoFactor && (
        <form
          onSubmit={login}
          className="mt-7 grid max-w-md gap-4 rounded-2xl border border-white/10 bg-white/5 p-5"
        >
          <h2 className="text-xl font-bold">Xavfsiz kirish</h2>
          <label className="grid gap-2 text-sm">
            Username
            <input
              name="username"
              autoComplete="username"
              required
              className="field"
            />
          </label>
          <label className="grid gap-2 text-sm">
            Parol
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="field"
            />
          </label>
          <button className="rs-button" disabled={busy}>
            {busy ? 'Tekshirilmoqda…' : 'Kirish'}
          </button>
        </form>
      )}
      {!queue && twoFactor && (
        <form
          onSubmit={verifyTwoFactor}
          className="mt-7 grid max-w-md gap-4 rounded-2xl border border-white/10 bg-white/5 p-5"
        >
          <h2 className="text-xl font-bold">Ikki bosqichli tasdiqlash</h2>
          {twoFactor.mode === 'ENROLL' && (
            <>
              <p className="text-sm text-slate-300">
                Google Authenticator, Microsoft Authenticator yoki boshqa TOTP
                ilovasiga quyidagi kalitni kiriting:
              </p>
              <code className="break-all rounded-lg bg-black/30 p-3 text-sm">
                {twoFactor.secret}
              </code>
            </>
          )}
          <label className="grid gap-2 text-sm">
            6 xonali kod
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              className="field"
            />
          </label>
          <button className="rs-button" disabled={busy}>
            {busy ? 'Tekshirilmoqda…' : 'Tasdiqlash'}
          </button>
          <button
            type="button"
            className="text-sm text-slate-300"
            onClick={() => setTwoFactor(null)}
          >
            Qayta kirish
          </button>
        </form>
      )}
      {queue && (
        <>
          {overview && <section className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Bugungi noyob brauzerlar" value={overview.metrics.visitorsToday} />
            <Metric label="30 kunlik tashrif-kunlar" value={overview.metrics.visitorDays30} />
            <Metric label="30 kunlik sahifa ko‘rishlar" value={overview.metrics.pageViews30} />
            <Metric label="Berilgan buyurtmalar" value={overview.metrics.ordersPlaced} />
            <Metric label="Yakunlangan xaridlar" value={overview.metrics.ordersCompleted} />
            <Metric label="E’lon qilingan postlar" value={overview.metrics.listingsPublished} />
            <Metric label="Barcha postlar" value={overview.metrics.listingsTotal} />
          </section>}
          <p className="mt-2 text-xs text-slate-400">Tashriflar odamlar soni emas, cookie asosidagi brauzer taxminidir; 30 kunlik ko‘rsatkich kunlar bo‘yicha yig‘indi.</p>
          <section className="mt-8 rounded-2xl border border-slate-700 p-5">
            <h2 className="text-xl font-bold">Do‘kon boshqaruviga kirishlar</h2>
            <p className="mt-1 text-sm text-slate-400">Oxirgi 30 kun, so‘nggi 100 kirish. IP va qurilma brauzer/server signali; aniq yashash joyi yoki GPS emas. VPN ishlatilsa IP boshqa hududniki bo‘lishi mumkin.</p>
            <div className="mt-4 grid gap-2">
              {sellerLogins.length === 0 && <p className="text-slate-400">Kirish yozuvi hozircha yo‘q.</p>}
              {sellerLogins.map((entry) => (
                <article className="rounded-xl border border-slate-700 p-3 text-sm" key={entry.id}>
                  <strong>@{entry.user.username}</strong>{entry.user.sellerProfile?.verification?.legalName ? ` · ${entry.user.sellerProfile.verification.legalName}` : ''}
                  <p className="mt-1 text-slate-300">{new Date(entry.createdAt).toLocaleString('uz-UZ')} · IP: {entry.ip ?? 'Avvalgi sessiya yoki aniqlanmadi'}</p>
                  <p className="break-all text-slate-400">Qurilma/brauzer: {entry.userAgent ?? 'Noma’lum'}</p>
                  <button type="button" className="mt-2 text-rose-300 underline" onClick={() => { setSelectedSeller(entry.user.publicId); setPrivateDetails(null); setPrivateReason(''); }}>
                    Shaxsiy ma’lumotlarni sabab bilan ko‘rish
                  </button>
                </article>
              ))}
            </div>
            {selectedSeller && <form className="mt-4 grid gap-2" onSubmit={revealSeller}>
              <label htmlFor="private-reason" className="text-sm font-bold">Tekshiruv sababi (auditga yoziladi)</label>
              <input id="private-reason" className="field" value={privateReason} onChange={(event) => setPrivateReason(event.target.value)} minLength={10} maxLength={500} required placeholder="Masalan: dispute #... bo‘yicha seller tekshiruvi" />
              <button type="submit" className="w-fit rounded-lg bg-rose-700 px-4 py-2 font-bold">Ma’lumotni ochish</button>
            </form>}
            {privateDetails && <div className="mt-4 rounded-xl border border-rose-700 p-4 text-sm">
              <strong>{privateDetails.legalName} (@{privateDetails.username})</strong>
              <p>Telefon: {privateDetails.phone ?? 'Oldingi arizada yo‘q'}</p>
              <p>Yashash manzili: {privateDetails.residenceAddress ?? 'Oldingi arizada yo‘q'}</p>
              <p>Hujjat: {privateDetails.documentType} · {privateDetails.documentNumber ?? 'Oldingi arizada yo‘q'}</p>
              <p className="mt-2 text-slate-400">Bu ma’lumotlar faqat xavfsizlik/huquqiy tekshiruv uchun. Sahifani yopganda ma’lumot ko‘rinmaydi.</p>
              <button type="button" className="mt-2 underline" onClick={() => setPrivateDetails(null)}>Yashirish</button>
            </div>}
          </section>
          <section className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Metric label="Ochiq nizolar" value={queue.openDisputes} />
            <Metric label="Xavfsizlik / 24s" value={queue.securityEvents24h} />
          </section>
          <section className="mt-8 grid gap-6 lg:grid-cols-2">
            <div id="listings">
              <QueueCard
                title="Yangi mahsulotlar"
                empty="Hozircha post yo‘q."
              >
                {overview?.recentListings.map((listing) => (
                  <article className="queue-row" key={listing.publicId}>
                    <div>
                      <strong>{listing.nameUz}</strong>
                      <p>@{listing.store.username} · {listing.status}</p>
                    </div>
                    <div className="actions">
                      {listing.status === 'ACTIVE' && <button
                        className="danger"
                        disabled={busy}
                        onClick={() =>
                          setDecision({
                            kind: 'listings',
                            id: listing.publicId,
                            status: 'RESTRICTED',
                            title: `${listing.nameUz} mahsulotini cheklash`,
                          })
                        }
                      >
                        Cheklash
                      </button>}
                    </div>
                  </article>
                ))}
                <Link className="text-sm font-bold text-rose-300" href="/operations#listings">Barcha postlarni ko‘rish →</Link>
              </QueueCard>
            </div>
          </section>
          {overview && <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <QueueCard title="So‘nggi buyurtmalar" empty="Buyurtma yo‘q.">
              {overview.recentOrders.map((order) => <article className="queue-row" key={order.publicId}><div><strong>{order.displayId}</strong><p>@{order.store.username} · {order.status}</p></div></article>)}
            </QueueCard>
            <QueueCard title="So‘nggi muhim harakatlar" empty="Audit yozuvi yo‘q.">
              {overview.recentAudit.map((event) => <article className="queue-row" key={event.id}><div><strong>{event.action}</strong><p>{event.targetType} · @{event.actor?.username ?? 'system'} · {new Date(event.createdAt).toLocaleString('uz-UZ')}</p></div></article>)}
            </QueueCard>
          </section>}
        </>
      )}
      {decision && (
        <div className="admin-dialog-backdrop" role="presentation">
          <form
            className="admin-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Moderatsiya qarori"
            onSubmit={submitDecision}
          >
            <h2 className="text-xl font-black">{decision.title}</h2>
            <p className="mt-2 text-sm text-slate-300">
              Sabab operator va audit tarixida saqlanadi.
            </p>
            <textarea
              className="mt-4 w-full rounded-xl border border-white/10 bg-slate-950 p-3"
              name="reason"
              minLength={3}
              required
              rows={4}
              autoFocus
            />
            <div className="mt-4 flex gap-2">
              <button className="rs-button" disabled={busy}>
                Qarorni tasdiqlash
              </button>
              <button type="button" onClick={() => setDecision(null)}>
                Bekor
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
function QueueCard({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const hasItems = Array.isArray(children)
    ? children.length > 0
    : Boolean(children);
  return (
    <div className="panel">
      <h2>{title}</h2>
      <div className="mt-4 grid gap-3">
        {hasItems ? children : <p className="empty">{empty}</p>}
      </div>
    </div>
  );
}
