import Link from 'next/link';
import type { Metadata } from 'next';
import { StatePanel } from '@resaller/ui';
import { demoListings } from '../lib/demo-catalog';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Marketplace' };
type Query = { q?: string; category?: string; minPrice?: string; maxPrice?: string; trust?: string; sort?: string };
type Listing = { publicId: string; nameUz: string; priceMinor: string; category: { nameUz: string }; store: { nameUz: string; sellerProfile: { trustBadge: string } }; variants: { options: Record<string, string>; inventory?: { available: number } | null }[]; media: { storageKey: string; thumbnailStorageKey?: string | null }[] };
const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000/api/v1';
const money = (value: string) => new Intl.NumberFormat('uz-UZ').format(Number(value));
const categories = ['Elektronika', 'Moda', 'Go‘zallik', 'Uy jihozlari', 'Bolalar'];
const trusts = [['TRUSTED', 'Trusted'], ['TOP_SELLER', 'Top Seller'], ['IDENTITY_VERIFIED', 'Verified']] as const;
const art: Record<string, string> = { 'demo-1': 'phone', 'demo-2': 'shoe', 'demo-3': 'laptop', 'demo-4': 'watch', 'demo-5': 'headphones' };

function FilterFields({ query }: { query: Query }) {
  return <>
    <label className="filter-search"><span aria-hidden="true">⌕</span><input name="q" defaultValue={query.q} aria-label="Natijadan qidirish" placeholder="Natijadan qidirish" /></label>
    <fieldset><legend>Kategoriya</legend>{categories.map((name) => <label key={name}><input type="radio" name="category" value={name} defaultChecked={query.category === name} /> <span>{name}</span></label>)}</fieldset>
    <fieldset><legend>Narx oralig‘i</legend><div className="price-fields"><input name="minPrice" defaultValue={query.minPrice} inputMode="numeric" pattern="[0-9]*" aria-label="Minimal narx" placeholder="dan" /><input name="maxPrice" defaultValue={query.maxPrice} inputMode="numeric" pattern="[0-9]*" aria-label="Maksimal narx" placeholder="gacha" /></div></fieldset>
    <fieldset><legend>Seller ishonchi</legend>{trusts.map(([value, name]) => <label key={value}><input type="radio" name="trust" value={value} defaultChecked={query.trust === value} /> <span>{name}</span></label>)}</fieldset>
    <button className="rs-button">Natijalarni ko‘rish</button>
  </>;
}

export default async function Marketplace({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const sort = query.sort ?? 'relevance';
  const params = new URLSearchParams();
  for (const key of ['q', 'category', 'minPrice', 'maxPrice', 'trust', 'sort'] as const) if (query[key]) params.set(key, query[key]!);
  let products: Listing[] = [];
  let unavailable = false;
  let demoMode = false;
  try {
    const response = await fetch(`${api}/marketplace/listings?${params}`, { cache: 'no-store' });
    if (!response.ok) throw new Error();
    products = (await response.json()) as Listing[];
  } catch {
    if (process.env.NODE_ENV !== 'development') unavailable = true;
    else {
      demoMode = true;
      const text = (query.q ?? '').toLocaleLowerCase('uz');
      products = demoListings.filter((item) => { const price = Number(item.priceMinor); return (!text || `${item.nameUz} ${item.store.nameUz}`.toLocaleLowerCase('uz').includes(text)) && (!query.category || item.category.nameUz === query.category) && (!query.trust || item.store.sellerProfile.trustBadge === query.trust) && (!query.minPrice || price >= Number(query.minPrice)) && (!query.maxPrice || price <= Number(query.maxPrice)); }) as unknown as Listing[];
      if (sort === 'price-asc') products.sort((a, b) => Number(a.priceMinor) - Number(b.priceMinor));
      if (sort === 'price-desc') products.sort((a, b) => Number(b.priceMinor) - Number(a.priceMinor));
    }
  }
  return <main className="catalog-page shell">
    <nav className="catalog-breadcrumb"><Link href="/">Bosh sahifa</Link><span>›</span><b>Marketplace</b></nav>
    <div className="catalog-title"><div><p className="eyebrow">Mahsulotlarni kashf eting</p><h1>{query.q ? `“${query.q}” natijalari` : 'Marketplace'}</h1><p>{products.length} ta mahsulot topildi</p></div><form className="catalog-sort"><input type="hidden" name="q" value={query.q ?? ''} /><input type="hidden" name="category" value={query.category ?? ''} /><input type="hidden" name="minPrice" value={query.minPrice ?? ''} /><input type="hidden" name="maxPrice" value={query.maxPrice ?? ''} /><input type="hidden" name="trust" value={query.trust ?? ''} /><label htmlFor="sort">Saralash</label><select id="sort" name="sort" defaultValue={sort}><option value="relevance">Tavsiya etilgan</option><option value="new">Eng yangi</option><option value="price-asc">Arzon narx</option><option value="price-desc">Qimmat narx</option></select><button>Qo‘llash</button></form></div>
    {demoMode && <p className="demo-notice" role="status">Development demo katalogi · productionda API xatosi real error holati sifatida ko‘rsatiladi</p>}
    <details className="mobile-filter-panel"><summary>☷ Filter va saralash</summary><form action="/marketplace"><FilterFields query={query} /><label className="mobile-sort-label">Saralash<select name="sort" defaultValue={sort}><option value="relevance">Tavsiya etilgan</option><option value="new">Eng yangi</option><option value="price-asc">Arzon narx</option><option value="price-desc">Qimmat narx</option></select></label></form></details>
    <div className="catalog-layout">
      <aside className="filter-panel"><div className="filter-panel__heading"><h2>Filterlar</h2><Link href="/marketplace">Tozalash</Link></div><form action="/marketplace"><FilterFields query={query} /><input type="hidden" name="sort" value={sort} /></form></aside>
      <section className="catalog-results" aria-label="Mahsulotlar"><div className="catalog-chips">{['Barchasi', ...categories].map((item) => <Link key={item} className={(!query.category && item === 'Barchasi') || query.category === item ? 'active' : ''} href={item === 'Barchasi' ? '/marketplace' : `/marketplace?category=${encodeURIComponent(item)}`}>{item}</Link>)}</div>
        {unavailable ? <StatePanel tone="danger" title="Marketplace vaqtincha ishlamayapti" description="Ma’lumotlar xizmati bilan aloqa tiklangach qayta urinib ko‘ring." action={<Link className="rs-button" href="/marketplace">Qayta urinish</Link>} /> : products.length === 0 ? <div className="catalog-empty"><span>⌕</span><h2>Hech narsa topilmadi</h2><p>Qidiruv yoki filtrlarni o‘zgartirib ko‘ring.</p><Link className="rs-button" href="/marketplace">Barcha mahsulotlar</Link></div> : <div className="catalog-grid">{products.map((product) => { const stock = product.variants.reduce((sum, variant) => sum + (variant.inventory?.available ?? 0), 0); return <Link href={`/product/${product.publicId}`} key={product.publicId} className="catalog-card"><div className="catalog-card__image">{product.media[0] ? <img src={`${api}/media/${product.media[0].thumbnailStorageKey ?? product.media[0].storageKey}`} alt={product.nameUz} loading="lazy" /> : <div className={`product-art product-art--${art[product.publicId] ?? 'phone'}`}><span /></div>}</div><div className="catalog-card__body"><h2>{product.nameUz}</h2><p>{Object.values(product.variants[0]?.options ?? {}).join(' · ')}</p><strong>{money(product.priceMinor)} so‘m</strong><div className="store-line"><i>{product.store.nameUz.slice(0, 2)}</i><span>{product.store.nameUz}</span><b>✓ {product.store.sellerProfile.trustBadge.replaceAll('_', ' ')}</b></div><small className={stock ? 'in-stock' : 'out-stock'}>{stock ? `Sotuvda · ${stock} dona` : 'Tugagan'}</small></div></Link>; })}</div>}
      </section>
    </div>
  </main>;
}
