'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { StatePanel } from '@resaller/ui';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type Profile = { publicId: string; username: string; fullName: string | null; phone: string | null; createdAt: string };
type Session = { id: string; createdAt: string; userAgent?: string | null; current: boolean };

const formatPhone = (phone: string) =>
  phone.replace(/^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/, '+998 $1 $2 $3 $4');

const device = (agent?: string | null) => {
  if (!agent) return 'Noma’lum qurilma';
  const os = /Android/i.test(agent) ? 'Android' : /iPhone|iPad/i.test(agent) ? 'iPhone' : /Windows/i.test(agent) ? 'Windows' : /Mac OS/i.test(agent) ? 'Mac' : /Linux/i.test(agent) ? 'Linux' : 'Qurilma';
  const browser = /Edg\//.test(agent) ? 'Edge' : /Chrome\//.test(agent) ? 'Chrome' : /Firefox\//.test(agent) ? 'Firefox' : /Safari\//.test(agent) ? 'Safari' : 'brauzer';
  return `${os} · ${browser}`;
};

// One simple page: who you are, change password, your orders, sign out.
// Device sessions stay available but folded away.
export default function Account() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'login' | 'offline'>('loading');
  const [notice, setNotice] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const [profileResponse, sessionsResponse] = await Promise.all(
        ['auth/profile', 'auth/sessions'].map((path) => fetch(`${API}/${path}`, { credentials: 'include', cache: 'no-store' })),
      );
      if (profileResponse!.status === 401) {
        setState('login');
        return;
      }
      if (!profileResponse!.ok) throw new Error('profile');
      setProfile((await profileResponse!.json()) as Profile);
      setSessions(sessionsResponse!.ok ? ((await sessionsResponse!.json()) as Session[]) : []);
      setState('ready');
    } catch {
      setState('offline');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (data.get('newPassword') !== data.get('repeat')) {
      setPasswordMessage({ ok: false, text: 'Yangi parollar bir xil emas.' });
      return;
    }
    setBusy(true);
    setPasswordMessage(null);
    const response = await fetch(`${API}/auth/password/change`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword: data.get('currentPassword'), newPassword: data.get('newPassword') }),
    }).catch(() => null);
    setBusy(false);
    if (response?.ok) {
      form.reset();
      setPasswordMessage({ ok: true, text: 'Parol o‘zgartirildi. Boshqa qurilmalardan chiqildi.' });
      void load();
      return;
    }
    const body = (await response?.json().catch(() => null)) as { message?: string | string[] } | null;
    const text = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
    setPasswordMessage({ ok: false, text: text ?? 'Server bilan aloqa yo‘q. Qayta urinib ko‘ring.' });
  }

  async function signOut() {
    await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => null);
    router.push('/');
    router.refresh();
  }

  async function signOutOthers() {
    const response = await fetch(`${API}/auth/sessions/revoke-others`, { method: 'POST', credentials: 'include' }).catch(() => null);
    setNotice(response?.ok ? 'Boshqa qurilmalardan chiqildi.' : 'Amal bajarilmadi. Qayta urinib ko‘ring.');
    void load();
  }

  return (
    <main className="shell max-w-3xl py-10">
      <p className="eyebrow">Shaxsiy kabinet</p>
      <h1 className="mt-2 text-3xl font-black">Mening hisobim</h1>

      {state === 'loading' && <p className="muted mt-6">Yuklanmoqda…</p>}
      {state === 'login' && (
        <div className="mt-6">
          <StatePanel title="Hisobingizga kiring" description="Buyurtmalar va hisob ma’lumotlarini ko‘rish uchun kiring."
            action={<Link className="rs-button" href="/login">Kirish</Link>} />
        </div>
      )}
      {state === 'offline' && (
        <div className="mt-6">
          <StatePanel tone="danger" title="Server bilan aloqa yo‘q" description="Internet aloqasini tekshirib, qayta urinib ko‘ring."
            action={<button className="rs-button" type="button" onClick={() => void load()}>Qayta urinish</button>} />
        </div>
      )}

      {state === 'ready' && profile && (
        <div className="mt-6 grid gap-5">
          <section className="surface p-6" aria-labelledby="profile-title">
            <h2 id="profile-title" className="text-xl font-black">Ma’lumotlarim</h2>
            <dl className="mt-4 grid gap-3">
              <div><dt className="muted text-sm">Ism</dt><dd className="font-bold">{profile.fullName ?? 'Kiritilmagan'}</dd></div>
              <div><dt className="muted text-sm">Telefon</dt><dd className="font-bold">{profile.phone ? formatPhone(profile.phone) : 'Kiritilmagan'}</dd></div>
              <div><dt className="muted text-sm">Username</dt><dd className="font-bold">@{profile.username}</dd></div>
            </dl>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link className="rs-button" href="/orders">Buyurtmalarim</Link>
              <Link className="rs-button rs-button--ghost" href="/favorites">Sevimlilar</Link>
            </div>
          </section>

          <section className="surface p-6" aria-labelledby="password-title">
            <h2 id="password-title" className="text-xl font-black">Parolni o‘zgartirish</h2>
            <form className="mt-4 grid gap-4" onSubmit={changePassword}>
              <label className="grid gap-2 text-sm font-bold">Joriy parol
                <input className="field font-normal" name="currentPassword" type="password" autoComplete="current-password" required />
              </label>
              <label className="grid gap-2 text-sm font-bold">Yangi parol
                <input className="field font-normal" name="newPassword" type="password" minLength={6} autoComplete="new-password" required />
                <small className="muted font-normal">Kamida 6 belgi. Raqamlar ham bo‘ladi.</small>
              </label>
              <label className="grid gap-2 text-sm font-bold">Yangi parolni takrorlang
                <input className="field font-normal" name="repeat" type="password" minLength={6} autoComplete="new-password" required />
              </label>
              {passwordMessage && (
                <p role={passwordMessage.ok ? 'status' : 'alert'} className={passwordMessage.ok ? 'font-bold text-[var(--success)]' : 'font-bold text-[var(--danger)]'}>
                  {passwordMessage.text}
                </p>
              )}
              <button className="rs-button" type="submit" disabled={busy}>{busy ? 'Saqlanmoqda…' : 'Parolni saqlash'}</button>
            </form>
          </section>

          <details className="surface p-6">
            <summary className="cursor-pointer text-lg font-black">Faol qurilmalar ({sessions.length})</summary>
            <ul className="mt-4 grid gap-3">
              {sessions.map((session) => (
                <li key={session.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
                  <span>{device(session.userAgent)}{session.current && <b className="ml-2 text-sm text-[var(--success)]">· shu qurilma</b>}</span>
                  <span className="muted text-sm">{new Date(session.createdAt).toLocaleDateString('uz-UZ')}</span>
                </li>
              ))}
            </ul>
            {sessions.length > 1 && (
              <button className="rs-button rs-button--ghost mt-4" type="button" onClick={() => void signOutOthers()}>Boshqa qurilmalardan chiqish</button>
            )}
            {notice && <p role="status" className="muted mt-3 text-sm">{notice}</p>}
          </details>

          <button className="min-h-11 justify-self-start font-bold text-[var(--danger)] underline" type="button" onClick={() => void signOut()}>
            Hisobdan chiqish
          </button>
        </div>
      )}
    </main>
  );
}
