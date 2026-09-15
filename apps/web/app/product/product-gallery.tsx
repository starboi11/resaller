'use client';

import { useState } from 'react';

export function ProductGallery({ name, media, selectedVariant }: { name: string; media: { storageKey: string; thumbnailStorageKey?: string | null; variantId?: string | null }[]; selectedVariant?: string }) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);
  const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000/api/v1';
  const visible = media.filter((item) => !item.variantId || !selectedVariant || item.variantId === selectedVariant);
  const gallery = visible.length ? visible : media;
  const current = gallery[Math.min(active, gallery.length - 1)];
  if (!current) return <div className="surface product-gallery__fallback product-art product-art--phone" role="img" aria-label="Mahsulot rasmi mavjud emas"><span /></div>;
  return <div>
    <button className="product-zoom-trigger" onClick={() => setZoom(true)} aria-label="Mahsulot rasmini kattalashtirish"><img src={`${api}/media/${current.storageKey}`} alt={`${name}, ${active + 1}-rasm`} className="surface aspect-square w-full object-cover" /><span>⌕ Kattalashtirish</span></button>
    {gallery.length > 1 && <div className="product-thumbnails" aria-label="Rasm tanlash">{gallery.map((item, index) => <button type="button" key={item.storageKey} className={index === active ? 'is-active' : ''} onClick={() => setActive(index)} aria-label={`${index + 1}-rasmni ko‘rish`} aria-pressed={index === active}><img src={`${api}/media/${item.thumbnailStorageKey ?? item.storageKey}`} alt="" /></button>)}</div>}
    {zoom && <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="Kattalashtirilgan mahsulot rasmi" onClick={() => setZoom(false)}><button aria-label="Yopish" onClick={() => setZoom(false)}>×</button><img src={`${api}/media/${current.storageKey}`} alt={name} onClick={(event) => event.stopPropagation()} /></div>}
  </div>;
}
