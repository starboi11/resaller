'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    const data = new FormData(event.currentTarget);
    const response = await fetch(`${API}/auth/${mode}`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: data.get('username'), password: data.get('password') }) });
    if (response.ok) { router.push('/marketplace'); router.refresh(); return; }
    const error = await response.json().catch(() => null) as { message?: string } | null;
    setMessage(error?.message ?? 'Kirish amalga oshmadi.'); setBusy(false);
  }
  return <main className="shell grid min-h-[70vh] place-items-center py-12"><div className="w-full max-w-md"><p className="eyebrow">Resaller hisob</p><h1 className="mt-2 text-3xl font-black">{mode === 'login' ? 'Xush kelibsiz' : 'Yangi hisob'}</h1><p className="muted mt-2 text-sm">{mode === 'login' ? 'Buyurtma va savatlaringizni davom ettiring.' : 'Xarid qilish uchun bepul hisob yarating.'}</p><form onSubmit={submit} className="surface mt-7 grid gap-5 p-6"><label className="grid gap-2 text-sm font-bold">Username<input className="field font-normal" name="username" minLength={3} maxLength={32} autoComplete="username" required /></label><label className="grid gap-2 text-sm font-bold">Parol<input className="field font-normal" name="password" type="password" minLength={12} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required /><small className="muted font-normal">Kamida 12 belgi, katta-kichik harf va raqam.</small></label>{message && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700 dark:bg-red-950/30 dark:text-red-200" role="alert">{message}</p>}<button disabled={busy} className="rs-button w-full">{busy ? 'Tekshirilmoqda…' : mode === 'login' ? 'Kirish' : 'Hisob yaratish'}</button><button type="button" className="min-h-11 text-sm font-bold text-[var(--brand-strong)]" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Yangi hisob yaratish' : 'Mavjud hisobga kirish'}</button></form></div></main>;
}
