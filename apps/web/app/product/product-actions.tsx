'use client';
import { useEffect, useState } from 'react';
type Recent = {
  publicId: string;
  nameUz: string;
  priceMinor: string;
  currency: string;
};
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
export function ProductActions({
  product,
  storePublicId,
}: {
  product: Recent;
  storePublicId: string;
}) {
  const [saved, setSaved] = useState(false);
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    try {
      const old = JSON.parse(
        localStorage.getItem('resaller-recent') ?? '[]',
      ) as Recent[];
      localStorage.setItem(
        'resaller-recent',
        JSON.stringify(
          [
            product,
            ...old.filter((item) => item.publicId !== product.publicId),
          ].slice(0, 20),
        ),
      );
    } catch {}
  }, [product]);
  async function favorite() {
    const response = await fetch(`${API}/favorites/${product.publicId}`, {
      method: saved ? 'DELETE' : 'POST',
      credentials: 'include',
    });
    if (response.ok) setSaved(!saved);
    else if (response.status === 401) window.location.href = '/login';
  }
  async function ask() {
    if (question.trim().length < 3) return setNotice('Savol kamida 3 ta belgidan iborat bo‘lsin.');
    const response = await fetch(`${API}/questions`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        storePublicId,
        listingPublicId: product.publicId,
        body: question.trim(),
      }),
    });
    if (response.status === 401) window.location.href = '/login';
    else if (response.ok) { setQuestion(''); setAsking(false); setNotice('Savol sotuvchiga yuborildi.'); }
    else setNotice('Savol yuborilmadi. Qayta urinib ko‘ring.');
  }
  return (
    <div className="flex flex-wrap gap-2">
      <button
        className="min-h-11 rounded-full border border-[var(--line)] px-4 text-sm font-black"
        onClick={() => void favorite()}
        aria-pressed={saved}
      >
        {saved ? '♥ Saqlangan' : '♡ Sevimliga'}
      </button>
      <button
        className="min-h-11 rounded-full border border-[var(--line)] px-4 text-sm font-black"
        onClick={() => setAsking((value) => !value)}
        aria-expanded={asking}
      >
        Savol berish
      </button>
      {asking && <form className="question-composer w-full" onSubmit={(event) => { event.preventDefault(); void ask(); }}><label htmlFor="product-question" className="font-black">Sotuvchiga savol</label><textarea id="product-question" value={question} onChange={(event) => setQuestion(event.target.value)} rows={3} maxLength={1000} placeholder="Mahsulot haqida nimani bilmoqchisiz?" /><div className="flex justify-end"><button className="rs-button" type="submit">Yuborish</button></div></form>}
      {notice && <p className="w-full text-sm font-bold" role="status">{notice}</p>}
    </div>
  );
}
