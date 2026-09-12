'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
type Listing = { publicId: string; nameUz: string; priceMinor: string; currency: string; media: { storageKey: string; thumbnailStorageKey?: string | null }[]; variants: { inventory: { available: number } | null }[] };
type Question = { id: string; body: string; answer?: { body: string } | null; listing?: { nameUz: string } | null };
type Testimonial = { id: string; sourceLabel: string; authorLabel: string; body: string };

export function StoreCatalog({ listings, questions = [], testimonials = [], description }: { listings: Listing[]; questions?: Question[]; testimonials?: Testimonial[]; description?: string | null }) {
  const [tab, setTab] = useState<'products'|'questions'|'reviews'|'about'>('products');
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => listings.filter((item) => item.nameUz.toLocaleLowerCase('uz').includes(query.toLocaleLowerCase('uz'))), [listings, query]);
  return <>
    <nav className="store-tabs" aria-label="Do‘kon bo‘limlari">{([['products',`Mahsulotlar (${listings.length})`],['questions',`Savol-javob (${questions.length})`],['reviews',`Fikrlar (${testimonials.length})`],['about','Do‘kon haqida']] as const).map(([key,label]) => <button key={key} className={tab === key ? 'is-active' : ''} onClick={() => setTab(key)}>{label}</button>)}</nav>
    {tab === 'products' && <><div className="store-products-head"><h2 className="text-2xl font-black">Mahsulotlar</h2><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Do‘kondan qidirish" placeholder="Do‘kondan mahsulot qidiring..." /></div><div className="store-products mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">{filtered.map((item) => <Link className="surface overflow-hidden" href={`/product/${item.publicId}`} key={item.publicId}>{item.media[0] ? <img className="aspect-[4/3] w-full object-cover" src={`${API}/media/${item.media[0].thumbnailStorageKey ?? item.media[0].storageKey}`} alt={item.nameUz} /> : <div className="aspect-[4/3] product-art product-art--phone"><span /></div>}<div className="p-4"><h3 className="font-black">{item.nameUz}</h3><p className="mt-2 text-sm font-bold">{Number(item.priceMinor).toLocaleString('uz-UZ')} {item.currency}</p><small className="muted">{item.variants.reduce((sum, v) => sum + (v.inventory?.available ?? 0), 0)} dona mavjud</small></div></Link>)}</div>{!filtered.length && <p className="surface mt-5 p-5">Qidiruvga mos mahsulot topilmadi.</p>}</>}
    {tab === 'questions' && <section className="mt-6 grid gap-3">{questions.length ? questions.map((item) => <article className="surface p-5" key={item.id}><b>{item.body}</b>{item.listing && <small className="muted mt-1 block">{item.listing.nameUz}</small>}<p className="mt-3">{item.answer ? `Sotuvchi: ${item.answer.body}` : 'Hali javob berilmagan'}</p></article>) : <p className="surface p-5">Hozircha ochiq savol yo‘q.</p>}</section>}
    {tab === 'reviews' && <section className="store-testimonials mt-6">{testimonials.length ? <div className="grid gap-4 md:grid-cols-3">{testimonials.map((item) => <article className="surface p-5" key={item.id}><span className="testimonial-source">IMPORT · {item.sourceLabel}</span><p className="mt-4">“{item.body}”</p><b className="mt-4 block text-sm">{item.authorLabel}</b></article>)}</div> : <p className="surface p-5">Hozircha fikr yo‘q.</p>}<p className="muted mt-4 text-sm">Import fikrlar Resaller buyurtmasi orqali tasdiqlanmagan.</p></section>}
    {tab === 'about' && <section className="surface mt-6 p-6"><h2 className="text-xl font-black">Do‘kon haqida</h2><p className="muted mt-3">{description || 'Do‘kon tavsifi kiritilmagan.'}</p></section>}
  </>;
}
