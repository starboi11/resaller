'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
type Mode = 'DISCOVER' | 'COMPARE' | 'ORDER_HELP' | 'SELLER_FORM';
type Source = {
  type: string;
  id: string;
  title: string;
  href: string;
  detail: string;
};
type Reply = { status: 'OK' | 'REFUSED'; answer: string; sources: Source[] };

const choices: { value: Mode; label: string; hint: string }[] = [
  {
    value: 'DISCOVER',
    label: 'Mahsulot topish',
    hint: 'Masalan: 3 mln so‘mgacha ishonchli telefon',
  },
  {
    value: 'COMPARE',
    label: 'Taqqoslash',
    hint: '2–4 ta product ID, vergul bilan',
  },
  { value: 'ORDER_HELP', label: 'Order yordami', hint: 'Order public ID' },
  {
    value: 'SELLER_FORM',
    label: 'Seller yordam',
    hint: 'Store public ID (ixtiyoriy)',
  },
];

export function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('DISCOVER');
  const [reply, setReply] = useState<Reply | null>(null);
  const [message, setMessage] = useState('');
  const [entityIds, setEntityIds] = useState('');
  const [status, setStatus] = useState('');

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('Javob tayyorlanmoqda…');
    setReply(null);
    const response = await fetch(`${API}/assistant/message`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mode,
        message,
        entityIds: entityIds
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
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
      setStatus('So‘rov bajarilmadi. ID va ruxsatni tekshiring.');
      return;
    }
    setReply((await response.json()) as Reply);
    setStatus('');
  }

  return (
    <aside className={`ai-assistant ${open ? 'is-open' : ''}`}>
      <button
        className="ai-assistant__toggle"
        type="button"
        aria-label={open ? 'AI yordamchini yopish' : 'AI yordamchini ochish'}
        aria-expanded={open}
        aria-controls="resaller-ai-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">✦</span>
        <span className="ai-assistant__toggle-label">AI yordamchi</span>
      </button>
      {open && (
        <section
          id="resaller-ai-panel"
          className="ai-assistant__panel"
          aria-label="Resaller AI yordamchi"
        >
          <header>
            <div>
              <p className="eyebrow">Resaller AI</p>
              <h2>Qanday yordam beray?</h2>
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
            Hozir xavfsiz lokal yordamchi ishlaydi. Javoblar faqat katalog va
            sizga ruxsat berilgan ma’lumotlarga asoslanadi. Yordamchi order,
            stock yoki rolni o‘zgartirmaydi.
          </p>
          <form onSubmit={ask}>
            <label>
              Yordam turi
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value as Mode)}
              >
                {choices.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </label>
            {mode !== 'DISCOVER' && (
              <label>
                {choices.find((choice) => choice.value === mode)?.hint}
                <input
                  value={entityIds}
                  onChange={(event) => setEntityIds(event.target.value)}
                  required={mode !== 'SELLER_FORM'}
                />
              </label>
            )}
            <label>
              Savolingiz
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={600}
                minLength={2}
                required
                placeholder={
                  choices.find((choice) => choice.value === mode)?.hint
                }
              />
            </label>
            <button className="rs-button" disabled={message.trim().length < 2}>
              Yordam so‘rash
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
        </section>
      )}
    </aside>
  );
}
