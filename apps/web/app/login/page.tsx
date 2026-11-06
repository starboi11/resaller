'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const data = new FormData(event.currentTarget);
    const response = await fetch(`${API}/auth/${mode}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      // Sign-in needs only username and password; registration also takes
      // the name and phone used later for delivery.
      body: JSON.stringify(
        mode === 'login'
          ? { username: data.get('username'), password: data.get('password') }
          : {
              fullName: data.get('fullName'),
              phone: data.get('phone'),
              username: data.get('username'),
              password: data.get('password'),
            },
      ),
    }).catch(() => null);
    if (!response) {
      setMessage('Server bilan ulanib bo‘lmadi. Internetni tekshirib, qayta urinib ko‘ring.');
      setBusy(false);
      return;
    }
    if (response.ok) {
      router.push('/marketplace');
      router.refresh();
      return;
    }
    const error = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const known: Record<string, string> = {
      'Invalid username or password': 'Username yoki parol noto‘g‘ri.',
      'Username is unavailable': 'Bu username band. Boshqasini tanlang.',
    };
    const text = Array.isArray(error?.message) ? error.message.join(' ') : error?.message;
    setMessage((text && (known[text] ?? text)) ?? 'Kirish amalga oshmadi.');
    setBusy(false);
  }
  return (
    <main className="shell grid min-h-[70vh] place-items-center py-12">
      <div className="w-full max-w-md">
        <p className="eyebrow">Resaller hisob</p>
        <h1 className="mt-2 text-3xl font-black">
          {mode === 'login' ? 'Xush kelibsiz' : 'Yangi hisob'}
        </h1>
        <p className="muted mt-2 text-sm">
          {mode === 'login'
            ? 'Buyurtma va savatlaringizni davom ettiring.'
            : 'Xarid qilish uchun bepul hisob yarating.'}
        </p>
        <form onSubmit={submit} className="surface mt-7 grid gap-5 p-6">
          {mode === 'register' && (
            <>
              <label className="grid gap-2 text-sm font-bold">
                Ismingiz
                <input className="field font-normal" name="fullName" minLength={2} maxLength={80} autoComplete="name" required />
              </label>
              <label className="grid gap-2 text-sm font-bold">
                Telefon raqami
                <input className="field font-normal" name="phone" type="tel" inputMode="tel" autoComplete="tel"
                  placeholder="+998 90 123 45 67" pattern="[+0-9 ()-]{9,20}" required />
              </label>
            </>
          )}
          <label className="grid gap-2 text-sm font-bold">
            Username
            <input
              className="field font-normal"
              name="username"
              minLength={3}
              maxLength={32}
              autoComplete="username"
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            Parol
            <input
              className="field font-normal"
              name="password"
              type="password"
              minLength={6}
              autoComplete={
                mode === 'login' ? 'current-password' : 'new-password'
              }
              required
            />
            {mode === 'register' && (
              <small className="muted font-normal">Kamida 6 belgi. Raqamlar ham bo‘ladi.</small>
            )}
          </label>
          {message && (
            <p
              className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700 dark:bg-red-950/30 dark:text-red-200"
              role="alert"
            >
              {message}
            </p>
          )}
          <button disabled={busy} className="rs-button w-full">
            {busy
              ? 'Tekshirilmoqda…'
              : mode === 'login'
                ? 'Kirish'
                : 'Hisob yaratish'}
          </button>
          <button
            type="button"
            className="min-h-11 text-sm font-bold text-[var(--brand-strong)]"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login'
              ? 'Yangi hisob yaratish'
              : 'Mavjud hisobga kirish'}
          </button>
          {mode === 'login' && (
            <Link
              className="text-center text-sm font-bold text-[var(--brand-strong)]"
              href="/recovery"
            >
              Parolni unutdingizmi?
            </Link>
          )}
        </form>
      </div>
    </main>
  );
}
