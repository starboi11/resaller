'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
type Store = { publicId: string; username: string; nameUz: string; createdAt: string };
type Listing = { publicId: string; nameUz: string; store: { username: string }; createdAt: string };
type Verification = { id: string; legalName: string; documentType: string; documentNumberMasked: string; sellerProfile: { user: { username: string } } };
type Queue = { stores: Store[]; listings: Listing[]; verifications: Verification[]; openDisputes: number; securityEvents24h: number };
type TwoFactor = { mode: 'ENROLL' | 'VERIFY'; challengeToken: string; secret?: string; provisioningUri?: string };

export default function AdminHome() {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [message, setMessage] = useState('Tekshirilmoqda…');
  const [busy, setBusy] = useState(false);
  const [twoFactor, setTwoFactor] = useState<TwoFactor | null>(null);
  const load = useCallback(async () => {
    const response = await fetch(`${API}/admin/queue`, { credentials: 'include', cache: 'no-store' });
    if (response.status === 401) { setMessage('Admin akkauntiga kiring.'); setQueue(null); return; }
    if (response.status === 403) { setMessage('Bu akkauntda moderator ruxsati yo‘q.'); setQueue(null); return; }
    if (!response.ok) { setMessage('Admin API hozir javob bermadi.'); setQueue(null); return; }
    setQueue(await response.json() as Queue); setMessage('Moderatsiya navbati yangilandi.');
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const values = new FormData(event.currentTarget);
    const response = await fetch(`${API}/auth/login`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: values.get('username'), password: values.get('password') }) });
    const payload = response.ok ? await response.json() as { twoFactor?: TwoFactor } : null;
    if (payload?.twoFactor) {
      setTwoFactor(payload.twoFactor);
      setMessage(payload.twoFactor.mode === 'ENROLL' ? 'Authenticator ilovasini ulang va 6 xonali kodni kiriting.' : 'Authenticator kodini kiriting.');
    } else {
      setMessage(response.ok ? 'Kirish muvaffaqiyatli.' : 'Login yoki parol noto‘g‘ri.');
      if (response.ok) await load();
    }
    setBusy(false);
  }

  async function verifyTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!twoFactor) return;
    setBusy(true);
    const values = new FormData(event.currentTarget);
    const response = await fetch(`${API}/auth/2fa/verify`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ challengeToken: twoFactor.challengeToken, code: values.get('code') }) });
    if (response.ok) { setTwoFactor(null); setMessage('Ikki bosqichli himoya tasdiqlandi.'); await load(); }
    else setMessage('Kod noto‘g‘ri yoki muddati tugagan. Qayta kiring.');
    setBusy(false);
  }

  async function moderate(kind: 'stores' | 'listings', publicId: string, status: string) {
    const reason = window.prompt('Audit uchun sababni yozing (kamida 3 belgi):');
    if (!reason || reason.trim().length < 3) return;
    setBusy(true);
    const response = await fetch(`${API}/admin/${kind}/${publicId}/status`, { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status, reason: reason.trim() }) });
    setMessage(response.ok ? 'Qaror saqlandi va auditga yozildi.' : 'Qarorni saqlab bo‘lmadi.');
    if (response.ok) await load(); setBusy(false);
  }

  async function verify(id: string, status: 'APPROVED' | 'REJECTED') {
    const reason = window.prompt('Verification qarori sababini yozing:');
    if (!reason || reason.trim().length < 3) return;
    setBusy(true);
    const response = await fetch(`${API}/admin/verifications/${id}/status`, { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status, reason: reason.trim() }) });
    setMessage(response.ok ? 'Verification qarori audit bilan saqlandi.' : 'Verification qarorini saqlab bo‘lmadi.');
    if (response.ok) await load(); setBusy(false);
  }

  return <main className="mx-auto max-w-6xl p-5 sm:p-8">
    <header className="flex flex-col gap-5 border-b border-white/10 pb-7 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow">Resaller Control Center</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Admin boshqaruvi</h1><p className="mt-2 text-sm text-slate-400">Har bir qaror sabab bilan audit tarixiga yoziladi.</p></div><button className="rs-button" disabled={busy} onClick={() => void load()}>Yangilash</button></header>
    <p className="mt-5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300" aria-live="polite">{message}</p>
    {!queue && !twoFactor && <form onSubmit={login} className="mt-7 grid max-w-md gap-4 rounded-2xl border border-white/10 bg-white/5 p-5"><h2 className="text-xl font-bold">Xavfsiz kirish</h2><label className="grid gap-2 text-sm">Username<input name="username" autoComplete="username" required className="field" /></label><label className="grid gap-2 text-sm">Parol<input name="password" type="password" autoComplete="current-password" required className="field" /></label><button className="rs-button" disabled={busy}>{busy ? 'Tekshirilmoqda…' : 'Kirish'}</button></form>}
    {!queue && twoFactor && <form onSubmit={verifyTwoFactor} className="mt-7 grid max-w-md gap-4 rounded-2xl border border-white/10 bg-white/5 p-5"><h2 className="text-xl font-bold">Ikki bosqichli tasdiqlash</h2>{twoFactor.mode === 'ENROLL' && <><p className="text-sm text-slate-300">Google Authenticator, Microsoft Authenticator yoki boshqa TOTP ilovasiga quyidagi kalitni kiriting:</p><code className="break-all rounded-lg bg-black/30 p-3 text-sm">{twoFactor.secret}</code></>}<label className="grid gap-2 text-sm">6 xonali kod<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required className="field" /></label><button className="rs-button" disabled={busy}>{busy ? 'Tekshirilmoqda…' : 'Tasdiqlash'}</button><button type="button" className="text-sm text-slate-300" onClick={() => setTwoFactor(null)}>Qayta kirish</button></form>}
    {queue && <><section className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-5"><Metric label="Verification" value={queue.verifications.length} /><Metric label="Do‘konlar" value={queue.stores.length} /><Metric label="Mahsulotlar" value={queue.listings.length} /><Metric label="Ochiq nizolar" value={queue.openDisputes} /><Metric label="Xavfsizlik / 24s" value={queue.securityEvents24h} /></section><section className="mt-8 grid gap-6 lg:grid-cols-2"><QueueCard title="Seller verification" empty="Tekshiriladigan seller yo‘q.">{queue.verifications.map(item => <article className="queue-row" key={item.id}><div><strong>{item.legalName}</strong><p>@{item.sellerProfile.user.username} · {item.documentType} · {item.documentNumberMasked}</p></div><div className="actions"><button disabled={busy} onClick={() => void verify(item.id, 'APPROVED')}>Tasdiqlash</button><button className="danger" disabled={busy} onClick={() => void verify(item.id, 'REJECTED')}>Rad etish</button></div></article>)}</QueueCard><QueueCard title="Do‘kon tekshiruvi" empty="Tekshiriladigan do‘kon yo‘q.">{queue.stores.map(store => <article className="queue-row" key={store.publicId}><div><strong>{store.nameUz}</strong><p>@{store.username}</p></div><div className="actions"><button disabled={busy} onClick={() => void moderate('stores', store.publicId, 'ACTIVE')}>Tasdiqlash</button><button className="danger" disabled={busy} onClick={() => void moderate('stores', store.publicId, 'RESTRICTED')}>Cheklash</button></div></article>)}</QueueCard><QueueCard title="Mahsulot tekshiruvi" empty="Tekshiriladigan mahsulot yo‘q.">{queue.listings.map(listing => <article className="queue-row" key={listing.publicId}><div><strong>{listing.nameUz}</strong><p>@{listing.store.username}</p></div><div className="actions"><button disabled={busy} onClick={() => void moderate('listings', listing.publicId, 'ACTIVE')}>Tasdiqlash</button><button className="danger" disabled={busy} onClick={() => void moderate('listings', listing.publicId, 'REJECTED')}>Rad etish</button></div></article>)}</QueueCard></section></>}
  </main>;
}

function Metric({ label, value }: { label: string; value: number }) { return <article className="metric"><span>{label}</span><strong>{value}</strong></article>; }
function QueueCard({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) { const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children); return <div className="panel"><h2>{title}</h2><div className="mt-4 grid gap-3">{hasItems ? children : <p className="empty">{empty}</p>}</div></div>; }
