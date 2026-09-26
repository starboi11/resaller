'use client';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { StatePanel } from '@resaller/ui';
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
type Session = {
  id: string;
  createdAt: string;
  userAgent?: string | null;
  current: boolean;
};
type Endpoint = {
  id: string;
  channel: string;
  active: boolean;
  createdAt: string;
};
type Notification = {
  id: string;
  type: string;
  severity: string;
  createdAt: string;
  readAt?: string;
};
export default function Account() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [login, setLogin] = useState(false);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState(false);
  const load = useCallback(async () => {
    try {
      const responses = await Promise.all(
        ['auth/sessions', 'notifications/endpoints', 'notifications'].map(
          (path) =>
            fetch(`${API}/${path}`, {
              credentials: 'include',
              cache: 'no-store',
            }),
        ),
      );
      if (responses[0]?.status === 401) {
        setLogin(true);
        return;
      }
      setLoadError(!responses[0]?.ok);
      if (responses[0]?.ok)
        setSessions((await responses[0].json()) as Session[]);
      if (responses[1]?.ok)
        setEndpoints((await responses[1].json()) as Endpoint[]);
      if (responses[2]?.ok)
        setNotifications((await responses[2].json()) as Notification[]);
    } catch {
      setLoadError(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function addEndpoint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch(`${API}/notifications/endpoints`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        channel: data.get('channel'),
        value: data.get('value'),
      }),
    });
    setMessage(
      response.ok
        ? 'Xabar kanali xavfsiz saqlandi.'
        : 'Kanal ma’lumotini tekshiring.',
    );
    if (response.ok) {
      form.reset();
      await load();
    }
  }
  async function remove(path: string) {
    const response = await fetch(`${API}/${path}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (response.ok) await load();
  }
  if (login)
    return (
      <main className="shell py-10">
        <StatePanel
          tone="warning"
          title="Hisobga kirish kerak"
          description="Bu ma’lumotlar faqat sizga ko‘rinadi."
          action={
            <Link className="rs-button" href="/login">
              Kirish
            </Link>
          }
        />
      </main>
    );
  return (
    <main className="shell py-10 buyer-workspace account-workspace">
      <p className="eyebrow">Shaxsiy kabinet</p>
      <h1 className="mt-2 text-3xl font-black">Hisob va xavfsizlik</h1>
      <p className="muted mt-2" aria-live="polite">
        {message || 'Sessiyalar va xabar kanallarini shu yerdan boshqaring.'}
      </p>
      {loadError && (
        <StatePanel
          tone="danger"
          title="Hisob ma’lumotlari yuklanmadi"
          description="Aloqani tekshirib, qayta urinib ko‘ring."
          action={
            <button className="rs-button" onClick={() => void load()}>
              Qayta urinish
            </button>
          }
        />
      )}
      <div className="account-grid mt-8 grid gap-6 lg:grid-cols-2">
        <section className="surface p-5">
          <h2 className="text-xl font-black">Faol qurilmalar</h2>
          <div className="mt-4 grid gap-3">
            {sessions.map((session) => (
              <article
                className="rounded-xl bg-[var(--surface-2)] p-4"
                key={session.id}
              >
                <p className="text-sm font-bold">
                  {session.current ? 'Joriy qurilma' : 'Boshqa qurilma'} ·
                  Kirgan vaqti:{' '}
                  {Number.isNaN(Date.parse(session.createdAt))
                    ? 'Noma’lum'
                    : new Date(session.createdAt).toLocaleString('uz-UZ')}
                </p>
                {session.userAgent && (
                  <p
                    className="muted mt-1 truncate text-xs"
                    title={session.userAgent}
                  >
                    {session.userAgent}
                  </p>
                )}
                <button
                  className="mt-2 text-sm font-bold text-[var(--danger)]"
                  onClick={() => void remove(`auth/sessions/${session.id}`)}
                >
                  Sessiyani yopish
                </button>
              </article>
            ))}
          </div>
          {!sessions.length && !loadError && (
            <p className="muted mt-4 text-sm">Faol qurilma topilmadi.</p>
          )}
        </section>
        <section className="surface p-5">
          <h2 className="text-xl font-black">Email, Telegram va push</h2>
          <p className="muted mt-2 text-sm">
            Manzil shifrlangan saqlanadi va qayta ko‘rsatilmaydi.
          </p>
          <form className="mt-4 grid gap-3" onSubmit={addEndpoint}>
            <select className="field" name="channel" aria-label="Xabar kanali">
              <option value="EMAIL">Email</option>
              <option value="TELEGRAM">Telegram chat ID</option>
              <option value="PUSH">Push endpoint</option>
            </select>
            <input
              className="field"
              name="value"
              required
              placeholder="Manzil yoki chat ID"
            />
            <button className="rs-button">Kanal qo‘shish</button>
          </form>
          <div className="mt-4 grid gap-2">
            {endpoints.map((endpoint) => (
              <div
                className="flex justify-between rounded-xl bg-[var(--surface-2)] p-3"
                key={endpoint.id}
              >
                <span>{endpoint.channel} · ••••••</span>
                <button
                  className="text-sm font-bold text-[var(--danger)]"
                  onClick={() =>
                    void remove(`notifications/endpoints/${endpoint.id}`)
                  }
                >
                  O‘chirish
                </button>
              </div>
            ))}
          </div>
        </section>
        <section className="surface p-5 lg:col-span-2">
          <div className="flex justify-between">
            <h2 className="text-xl font-black">Bildirishnomalar</h2>
            <button
              className="text-sm font-bold text-[var(--brand-strong)]"
              onClick={() =>
                void fetch(`${API}/notifications/read-all`, {
                  method: 'POST',
                  credentials: 'include',
                }).then(load)
              }
            >
              Barchasini o‘qilgan qilish
            </button>
          </div>
          <div className="mt-4 grid gap-2">
            {notifications.slice(0, 20).map((item) => (
              <article
                className="rounded-xl bg-[var(--surface-2)] p-3"
                key={item.id}
              >
                <b className="text-sm">{item.type}</b>
                <p className="muted text-xs">
                  {new Date(item.createdAt).toLocaleString('uz-UZ')} ·{' '}
                  {item.severity}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
