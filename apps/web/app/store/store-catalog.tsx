'use client';

import Link from 'next/link';
import { useState } from 'react';
type Listing = { publicId: string };
type Question = { id: string; body: string; answer?: { body: string } | null; listing?: { nameUz: string } | null };
type Testimonial = { id: string; sourceLabel: string; authorLabel: string; body: string };

// One seller: products live in the shared catalogue, so this page carries
// "about", questions and imported testimonials, with a link to the catalogue.
export function StoreCatalog({ listings, questions = [], testimonials = [], description }: { listings: Listing[]; questions?: Question[]; testimonials?: Testimonial[]; description?: string | null }) {
  const [tab, setTab] = useState<'about'|'questions'|'reviews'>('about');
  return <>
    <nav className="store-tabs" aria-label="Sahifa bo‘limlari">{([['about','Resaller haqida'],['questions',`Savol-javob (${questions.length})`],['reviews',`Fikrlar (${testimonials.length})`]] as const).map(([key,label]) => <button key={key} className={tab === key ? 'is-active' : ''} onClick={() => setTab(key)}>{label}</button>)}</nav>
    {tab === 'about' && <section className="surface mt-6 p-6"><h2 className="text-xl font-black">Resaller haqida</h2><p className="muted mt-3">{description || 'Tavsif hali kiritilmagan.'}</p><Link className="rs-button mt-5 inline-flex" href="/marketplace">Mahsulotlarni ko‘rish ({listings.length})</Link></section>}
    {tab === 'questions' && <section className="mt-6 grid gap-3">{questions.length ? questions.map((item) => <article className="surface p-5" key={item.id}><b>{item.body}</b>{item.listing && <small className="muted mt-1 block">{item.listing.nameUz}</small>}<p className="mt-3">{item.answer ? `Resaller: ${item.answer.body}` : 'Hali javob berilmagan'}</p></article>) : <p className="surface p-5">Hozircha ochiq savol yo‘q.</p>}</section>}
    {tab === 'reviews' && <section className="store-testimonials mt-6">{testimonials.length ? <div className="grid gap-4 md:grid-cols-3">{testimonials.map((item) => <article className="surface p-5" key={item.id}><span className="testimonial-source">IMPORT · {item.sourceLabel}</span><p className="mt-4">“{item.body}”</p><b className="mt-4 block text-sm">{item.authorLabel}</b></article>)}</div> : <p className="surface p-5">Hozircha fikr yo‘q.</p>}<p className="muted mt-4 text-sm">Import fikrlar Resaller buyurtmasi orqali tasdiqlanmagan.</p></section>}
  </>;
}
