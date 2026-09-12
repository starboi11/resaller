'use client';

import { useState } from 'react';

export function ProductGallery({ name, media }: { name: string; media: { storageKey: string; thumbnailStorageKey?: string | null }[] }) {
  const [active, setActive] = useState(0);
  const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000/api/v1';
  if (!media.length) return <div className="surface product-gallery__fallback product-art product-art--phone" role="img" aria-label="Mahsulot rasmi mavjud emas"><span /></div>;
  return <div>
    <img src={`${api}/media/${media[active]?.storageKey}`} alt={`${name}, ${active + 1}-rasm`} className="surface aspect-square w-full object-cover" />
    {media.length > 1 && <div className="product-thumbnails" aria-label="Rasm tanlash">{media.map((item, index) => <button key={item.storageKey} className={index === active ? 'is-active' : ''} onClick={() => setActive(index)} aria-label={`${index + 1}-rasmni ko‘rish`} aria-pressed={index === active}><img src={`${api}/media/${item.thumbnailStorageKey ?? item.storageKey}`} alt="" /></button>)}</div>}
  </div>;
}
