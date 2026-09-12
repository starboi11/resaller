import Link from 'next/link';
import type { Metadata } from 'next';
import { demoListings } from '../lib/demo-catalog';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Marketplace' };
type Listing = {
  publicId: string;
  nameUz: string;
  priceMinor: string;
  category: { nameUz: string };
  store: { nameUz: string; sellerProfile: { trustBadge: string } };
  variants: { options: Record<string, string>; inventory?: { available: number } | null }[];
  media: { storageKey: string; thumbnailStorageKey?: string | null }[];
};
const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000/api/v1';
const money = (value: string) => new Intl.NumberFormat('uz-UZ').format(Number(value));
const art: Record<string, string> = { 'demo-1': 'phone', 'demo-2': 'shoe', 'demo-3': 'laptop', 'demo-4': 'watch', 'demo-5': 'headphones' };

export default async function Marketplace({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; sort?: string }> }) {
  const { q = '', category = '', sort = 'relevance' } = await searchParams;
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (category) params.set('category', category);
  let products: Listing[] = [];
  let demoMode = false;
  try {
    const response = await fetch(`${api}/marketplace/listings?${params}`, { cache: 'no-store' });
    if (!response.ok) throw new Error();
    products = (await response.json()) as Listing[];
  } catch {
    demoMode = true;
    const query = q.toLocaleLowerCase('uz');
    products = demoListings.filter((item) => (!query || `${item.nameUz} ${item.store.nameUz}`.toLocaleLowerCase('uz').includes(query)) && (!category || item.category.nameUz.toLocaleLowerCase('uz').includes(category.toLocaleLowerCase('uz')))) as unknown as Listing[];
  }
  return <main className="catalog-page shell">
    <nav className="catalog-breadcrumb"><Link href="/">Bosh sahifa</Link><span>›</span><b>Marketplace</b></nav>
    <div className="catalog-title"><div><p className="eyebrow">Mahsulotlarni kashf eting</p><h1>{q ? `“${q}” natijalari` : 'Barcha mahsulotlar'}</h1><p>{products.length} ta mahsulot topildi</p></div><form className="catalog-sort"><label htmlFor="sort">Saralash</label><select id="sort" name="sort" defaultValue={sort}><option value="relevance">Mashhurligi bo‘yicha</option><option value="new">Eng yangi</option><option value="price-asc">Arzon narx</option><option value="price-desc">Qimmat narx</option></select></form></div>
    {demoMode && <p className="demo-notice">Ko‘rgazma katalogi · API ulanganda real mahsulotlar avtomatik chiqadi</p>}
    <div className="catalog-layout">
      <aside className="filter-panel"><div className="filter-panel__heading"><h2>Filterlar</h2><Link href="/marketplace">Tozalash</Link></div><form>
        <label className="filter-search"><span>⌕</span><input name="q" defaultValue={q} placeholder="Natijadan qidirish" /></label>
        <fieldset><legend>Kategoriya</legend>{['Elektronika','Moda','Go‘zallik','Uy jihozlari','Bolalar'].map((name) => <label key={name}><input type="radio" name="category" value={name} defaultChecked={category === name} /> <span>{name}</span></label>)}</fieldset>
        <fieldset><legend>Narx oralig‘i</legend><div className="price-fields"><input inputMode="numeric" placeholder="dan" /><input inputMode="numeric" placeholder="gacha" /></div></fieldset>
        <fieldset><legend>Seller ishonchi</legend>{['Trusted','Top Seller','Verified'].map((name) => <label key={name}><input type="checkbox" /> <span>{name}</span></label>)}</fieldset>
        <button className="rs-button">Natijalarni ko‘rish</button>
      </form></aside>
      <section className="catalog-results" aria-label="Mahsulotlar"><div className="mobile-filter-row"><button>↕ Saralash</button><button>☷ Filter</button></div><div className="catalog-chips">{['Barchasi','Elektronika','Moda','Uy jihozlari','Go‘zallik'].map((item) => <Link key={item} className={(!category && item === 'Barchasi') || category === item ? 'active' : ''} href={item === 'Barchasi' ? '/marketplace' : `/marketplace?category=${encodeURIComponent(item)}`}>{item}</Link>)}</div>
        {products.length === 0 ? <div className="catalog-empty"><span>⌕</span><h2>Hech narsa topilmadi</h2><p>Qidiruv yoki filtrlarni o‘zgartirib ko‘ring.</p><Link className="rs-button" href="/marketplace">Barcha mahsulotlar</Link></div> : <div className="catalog-grid">{products.map((product, index) => { const stock = product.variants.reduce((sum, variant) => sum + (variant.inventory?.available ?? 0), 0); return <Link href={`/product/${product.publicId}`} key={product.publicId} className="catalog-card"><div className="catalog-card__image">{product.media[0] ? <img src={`${api}/media/${product.media[0].thumbnailStorageKey ?? product.media[0].storageKey}`} alt={product.nameUz} /> : <div className={`product-art product-art--${art[product.publicId] ?? 'phone'}`}><span /></div>}<span className="card-heart" aria-label="Sevimlilarga qo‘shish">♡</span>{index === 0 && <em>-12%</em>}</div><div className="catalog-card__body"><h2>{product.nameUz}</h2><p>{Object.values(product.variants[0]?.options ?? {}).join(' · ')}</p><strong>{money(product.priceMinor)} so‘m</strong><div className="rating">★ 4.{8 + index % 2} <span>({96 + index * 37})</span></div><div className="store-line"><i>{product.store.nameUz.slice(0,2)}</i><span>{product.store.nameUz}</span><b>✓ {product.store.sellerProfile.trustBadge.replaceAll('_',' ')}</b></div><small className={stock ? 'in-stock' : 'out-stock'}>{stock ? `Sotuvda · ${stock} dona` : 'Tugagan'}</small></div></Link>; })}</div>}
      </section>
    </div>
  </main>;
}
