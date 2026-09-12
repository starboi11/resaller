'use client';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { StatePanel } from '@resaller/ui';
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
type Order = {
  publicId: string;
  displayId: string;
  status: string;
  totalMinor: string;
  currency: string;
  createdAt: string;
  store: { nameUz: string; username: string };
  items: {
    id: string;
    quantity: number;
    unitPriceMinor: string;
    snapshot: Record<string, unknown>;
  }[];
  history: {
    id: string;
    toStatus: string;
    reason?: string;
    createdAt: string;
  }[];
};
type Message = {
  id: string;
  body?: string;
  createdAt: string;
  attachments?: { id: string; fileName: string }[];
};
export default function OrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [id, setId] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    void params.then((value) => setId(value.id));
  }, [params]);
  const load = useCallback(async () => {
    if (!id) return;
    const [a, b] = await Promise.all([
      fetch(`${API}/orders/${id}`, {
        credentials: 'include',
        cache: 'no-store',
      }),
      fetch(`${API}/orders/${id}/messages`, {
        credentials: 'include',
        cache: 'no-store',
      }),
    ]);
    if (a.ok) setOrder((await a.json()) as Order);
    else
      setError(
        a.status === 401
          ? 'Hisobga kirish kerak.'
          : 'Buyurtma topilmadi yoki ruxsat yo‘q.',
      );
    if (b.ok) setMessages((await b.json()) as Message[]);
  }, [id]);
  useEffect(() => {
    void load();
    if (!id) return;
    const stream = new EventSource(`${API}/orders/${id}/messages/stream`, {
      withCredentials: true,
    });
    stream.addEventListener('messages', (event) => {
      try {
        setMessages(JSON.parse((event as MessageEvent).data) as Message[]);
      } catch {}
    });
    const fallback = setInterval(() => {
      if (stream.readyState === EventSource.CLOSED) void load();
    }, 5_000);
    return () => {
      stream.close();
      clearInterval(fallback);
    };
  }, [load]);
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = String(data.get('body') ?? '').trim();
    if (!body) return;
    const response = await fetch(`${API}/orders/${id}/messages`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    if (response.ok) {
      const created = (await response.json()) as { id: string };
      const file = data.get('file');
      if (file instanceof File && file.size > 0) {
        const upload = new FormData();
        upload.set('file', file);
        await fetch(`${API}/media/messages/${created.id}/attachment`, {
          method: 'POST',
          credentials: 'include',
          body: upload,
        });
      }
      form.reset();
      await load();
    }
  }
  async function action(path: string) {
    const reason = window.prompt('Sababni batafsil yozing');
    if (!reason || reason.trim().length < 3) return;
    const response = await fetch(`${API}/orders/${id}/${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: reason.trim() }),
    });
    if (response.ok) await load();
    else setError('Amalni bajarib bo‘lmadi.');
  }
  async function review() {
    const rating = Number(window.prompt('1 dan 5 gacha baho'));
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return;
    const body = window.prompt('Sharh (ixtiyoriy)') ?? undefined;
    const response = await fetch(`${API}/orders/${id}/review`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rating, body }),
    });
    if (response.ok) await load();
    else setError('Sharh faqat yakunlangan buyurtmaga bir marta yoziladi.');
  }
  if (error && !order)
    return (
      <main className="shell max-w-3xl py-10">
        <StatePanel
          tone="warning"
          title={error}
          description="Buyurtma egasi yoki tegishli sotuvchi hisobidan kiring."
          action={
            <Link className="rs-button" href="/login">
              Kirish
            </Link>
          }
        />
      </main>
    );
  if (!order)
    return (
      <main className="shell py-10" aria-busy="true">
        <p className="muted">Buyurtma yuklanmoqda…</p>
      </main>
    );
  return (
    <main className="shell py-10">
      <Link className="muted text-sm" href="/orders">
        ← Buyurtmalar
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{order.store.nameUz}</p>
          <h1 className="mt-2 text-3xl font-black">{order.displayId}</h1>
          <p className="muted mt-2 text-sm">
            @{order.store.username} ·{' '}
            {new Date(order.createdAt).toLocaleString('uz-UZ')}
          </p>
        </div>
        <span className="rounded-full bg-[var(--brand-soft)] px-4 py-2 font-black text-[var(--brand-strong)]">
          {order.status}
        </span>
      </div>
      {error && (
        <p className="mt-4 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
      <div className="mt-8 grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
        <div className="grid content-start gap-6">
          <section className="surface p-5">
            <h2 className="text-lg font-black">Mahsulotlar</h2>
            <div className="mt-4 grid gap-3">
              {order.items.map((item) => (
                <div
                  className="flex justify-between gap-3 border-b border-[var(--line)] pb-3"
                  key={item.id}
                >
                  <span>
                    {String(
                      item.snapshot.nameUz ?? item.snapshot.name ?? 'Mahsulot',
                    )}{' '}
                    × {item.quantity}
                  </span>
                  <b>{Number(item.unitPriceMinor).toLocaleString('uz-UZ')}</b>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between">
              <strong>Jami</strong>
              <strong>
                {Number(order.totalMinor).toLocaleString('uz-UZ')}{' '}
                {order.currency}
              </strong>
            </div>
          </section>
          <section className="surface p-5">
            <h2 className="text-lg font-black">Holat tarixi</h2>
            <ol className="mt-4 grid gap-4">
              {order.history.map((item) => (
                <li className="border-l-2 border-violet-400 pl-4" key={item.id}>
                  <b>{item.toStatus}</b>
                  <p className="muted text-xs">
                    {new Date(item.createdAt).toLocaleString('uz-UZ')}
                  </p>
                  {item.reason && <p className="mt-1 text-sm">{item.reason}</p>}
                </li>
              ))}
            </ol>
          </section>
          <div className="flex flex-wrap gap-2">
            {[
              ['cancellation-request', 'Bekor qilish'],
              ['return-request', 'Qaytarish'],
              ['dispute', 'Nizo ochish'],
            ].map(([path, label]) => (
              <button
                key={path}
                className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-bold"
                onClick={() => void action(path!)}
              >
                {label}
              </button>
            ))}
            <button
              className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-bold"
              onClick={() => void review()}
            >
              Sharh yozish
            </button>
          </div>
        </div>
        <section className="surface flex min-h-[32rem] flex-col p-5">
          <h2 className="text-lg font-black">Xususiy chat</h2>
          <p className="muted text-sm">
            Faqat buyurtma ishtirokchilari ko‘radi.
          </p>
          <div
            className="mt-5 flex-1 space-y-3 overflow-y-auto"
            aria-live="polite"
          >
            {messages.length === 0 && (
              <p className="muted text-sm">Hali xabar yo‘q.</p>
            )}
            {messages.map((message) => (
              <article
                className="max-w-[85%] rounded-2xl bg-[var(--surface-2)] p-3"
                key={message.id}
              >
                <p className="text-sm">{message.body}</p>
                <time className="muted mt-1 block text-[11px]">
                  {new Date(message.createdAt).toLocaleTimeString('uz-UZ')}
                </time>
                {message.attachments?.map((file) => (
                  <a
                    className="mt-2 block text-xs font-bold text-[var(--brand-strong)]"
                    key={file.id}
                    href={`${API}/media/private/attachments/${file.id}`}
                  >
                    📎 {file.fileName}
                  </a>
                ))}
              </article>
            ))}
          </div>
          <form
            className="mt-4 grid grid-cols-[1fr_auto] gap-2"
            onSubmit={send}
          >
            <label className="sr-only" htmlFor="message">
              Xabar
            </label>
            <input
              id="message"
              name="body"
              className="field flex-1"
              maxLength={4000}
              placeholder="Xabar yozing…"
            />
            <label className="col-span-2 cursor-pointer text-xs font-bold text-[var(--brand-strong)]">
              📎 Fayl biriktirish
              <input
                className="sr-only"
                type="file"
                name="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
              />
            </label>
            <button className="rs-button">Yuborish</button>
          </form>
        </section>
      </div>
    </main>
  );
}
