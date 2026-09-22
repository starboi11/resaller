'use client';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
export default function Recovery() {
  const [mode, setMode] = useState<'request' | 'reset'>('request');
  const [resetToken, setResetToken] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token') ?? '';
    if (token) {
      setResetToken(token);
      setMode('reset');
    }
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body =
      mode === 'request'
        ? { username: data.get('username') }
        : { token: data.get('token'), password: data.get('password') };
    const response = await fetch(
      `${API}/auth/password/${mode === 'request' ? 'request-reset' : 'reset'}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    setMessage(
      response.ok
        ? mode === 'request'
          ? 'Agar hisob mavjud bo‘lsa, tiklash ko‘rsatmasi yuborildi.'
          : 'Parol yangilandi. Endi hisobga kiring.'
        : 'Ma’lumotni tekshiring va qayta urinib ko‘ring.',
    );
  }
  return (
    <main className="shell grid min-h-[70vh] place-items-center py-12">
      <div className="w-full max-w-md">
        <p className="eyebrow">Hisob xavfsizligi</p>
        <h1 className="mt-2 text-3xl font-black">Parolni tiklash</h1>
        <form className="surface mt-7 grid gap-4 p-6" onSubmit={submit}>
          {mode === 'request' ? (
            <label className="grid gap-2 font-bold">
              Username
              <input
                className="field font-normal"
                name="username"
                required
                minLength={3}
              />
            </label>
          ) : (
            <>
              <label className="grid gap-2 font-bold">
                Bir martalik token
              <input className="field font-normal" name="token" required value={resetToken} onChange={(event) => setResetToken(event.target.value)} />
              </label>
              <label className="grid gap-2 font-bold">
                Yangi parol
                <input
                  className="field font-normal"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                />
              </label>
            </>
          )}
          <p className="muted text-sm" aria-live="polite">
            {message}
          </p>
          <button className="rs-button">
            {mode === 'request' ? 'Tiklashni boshlash' : 'Parolni yangilash'}
          </button>
          <button
            className="min-h-11 text-sm font-bold text-[var(--brand-strong)]"
            type="button"
            onClick={() => setMode(mode === 'request' ? 'reset' : 'request')}
          >
            {mode === 'request' ? 'Emaildan havolani ochdim' : 'Yangi tiklash havolasini so‘rash'}
          </button>
          <Link className="text-center text-sm" href="/login">
            Kirishga qaytish
          </Link>
        </form>
      </div>
    </main>
  );
}
