'use client';

import Link from 'next/link';
import { FormEvent, useState, useRef, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
type Source = {
  type: string;
  id: string;
  title: string;
  href: string;
  detail: string;
};
type Reply = { status: 'OK' | 'REFUSED'; answer: string; sources: Source[] };

export function AiAssistant() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [open]);
  const [reply, setReply] = useState<Reply | null>(null);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setStatus('Javob tayyorlanmoqda…');
    setReply(null);
    try {
      const response = await fetch(`${API}/assistant/message`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mode: 'DISCOVER',
          message,
          entityIds: [],
        }),
      });
      if (response.status === 401) {
        setStatus('AI yordamchidan foydalanish uchun akkauntga kiring.');
        return;
      }
      if (response.status === 429) {
        setStatus(
          'Bir daqiqalik limit tugadi. Birozdan keyin qayta urinib ko‘ring.',
        );
        return;
      }
      if (!response.ok) {
        setStatus(
          'Javob olinmadi. Qayta urinib ko‘ring yoki Telegram orqali bizga yozing.',
        );
        return;
      }
      setReply((await response.json()) as Reply);
      setStatus('');
    } catch {
      setStatus(
        'Yordamchiga ulanib bo‘lmadi. Savolingiz saqlanib turibdi — qayta urinib ko‘ring.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside
      id="resaller-support"
      className="support-dock"
      aria-label="Xaridorlarga yordam"
    >
      <div className="support-dock__copy">
        <span className="support-dock__icon" aria-hidden="true">
          ↗
        </span>
        <div>
          <strong>Biror savolingiz bormi?</strong>
          <p>Tanlashdan buyurtmagacha — yordam beramiz</p>
        </div>
      </div>
      <div className="support-dock__actions">
        <a
          className="support-telegram"
          href="https://t.me/starboiazp"
          target="_blank"
          rel="noopener noreferrer"
        >
          Telegram’da yozish
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="m21.5 3.5-3.6 17c-.3 1.2-1 1.5-2 .9l-5.5-4-2.7 2.6c-.3.3-.6.6-1.2.6l.4-5.6L17 5.8c.4-.4-.1-.6-.6-.3L4 13.3.5 12.2c-1.1-.4-1.1-1.2.2-1.7L20.2 3c.9-.3 1.6.2 1.3.5Z" />
          </svg>
        </a>
        <button
          className="support-ai-button"
          type="button"
          aria-label={open ? 'AI yordamchini yopish' : 'AI yordamchini ochish'}
          aria-expanded={open}
          aria-controls="resaller-ai-panel"
          onClick={() => setOpen(true)}
        >
          <span aria-hidden="true">✦</span>
          <span className="ai-assistant__toggle-label">AI yordamchi</span>
        </button>
      </div>
      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        id="resaller-ai-panel"
        className="ai-assistant__panel support-dialog"
        aria-labelledby="support-dialog-title"
      >
        <header>
          <div>
            <p className="eyebrow">Resaller AI</p>
            <h2 id="support-dialog-title">Sizga mosini topamiz</h2>
          </div>
          <button
            type="button"
            aria-label="AI yordamchini yopish"
            onClick={() => setOpen(false)}
          >
            ✕
          </button>
        </header>
        <p className="ai-assistant__notice">
          Qanday mahsulot izlayapsiz? Nomi, xususiyati yoki byudjetingizni
          yozing
        </p>
        <form onSubmit={ask}>
          <label>
            Savolingiz
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={600}
              minLength={2}
              required
              placeholder="Masalan: telefonim uchun ixcham zaryadlovchi izlayapman"
            />
          </label>
          <button
            className="rs-button"
            disabled={busy || message.trim().length < 2}
          >
            {busy ? 'Javob kutilmoqda…' : 'Yordam so‘rash'}
          </button>
        </form>
        {status && (
          <p className="ai-assistant__status" role="status">
            {status}
          </p>
        )}
        {reply && (
          <div className="ai-assistant__reply" role="status">
            <p>{reply.answer}</p>
            {reply.sources.map((source) => (
              <Link
                href={source.href}
                key={`${source.type}-${source.id}`}
                onClick={() => setOpen(false)}
              >
                <strong>{source.title}</strong>
                <small>{source.detail}</small>
              </Link>
            ))}
          </div>
        )}
        <div className="support-dialog__human">
          <span>Buyurtma yoki boshqa savol bo‘yicha</span>
          <a
            href="https://t.me/starboiazp"
            target="_blank"
            rel="noopener noreferrer"
          >
            @starboiazp — Telegram’da yozish ↗
          </a>
        </div>
      </dialog>
    </aside>
  );
}
