import Link from 'next/link';
import { StatePanel } from '@resaller/ui';

export const dynamic = 'force-dynamic';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000/api/v1';
const categoryIcons: Record<string, string> = {
  Elektronika: '▣', Moda: '♧', "Go‘zallik": '♨', 'Uy jihozlari': '⌂',
  Bolalar: '♙', Avto: '▱', Sport: '✣', Xizmatlar: '♙',
};

type Category = { slug: string; nameUz: string };
type Listing = {
  publicId: string;
  nameUz: string;
  priceMinor: string;
  currency: string;
  category: Category;
  store: { username: string; nameUz: string; sellerProfile: { trustBadge: string } };
  variants: { inventory: { available: number; reserved: number } | null }[];
  media: { storageKey: string; thumbnailStorageKey?: string | null }[];
};

const money = (value: string) => new Intl.NumberFormat('uz-UZ').format(Number(value));
const badgeName = (value: string) => value.replaceAll('_', ' ');

async function getHomeData() {
  try {
    const [listingResponse, categoryResponse] = await Promise.all([
      fetch(`${API}/marketplace/listings?sort=new`, { cache: 'no-store' }),
      fetch(`${API}/categories`, { cache: 'no-store' }),
    ]);
    if (!listingResponse.ok || !categoryResponse.ok) throw new Error('Marketplace unavailable');
    return {
      listings: (await listingResponse.json()) as Listing[],
      categories: (await categoryResponse.json()) as Category[],
      unavailable: false,
    };
  } catch {
    return { listings: [] as Listing[], categories: [] as Category[], unavailable: true };
  }
}

export default async function Home() {
  const { listings, categories, unavailable } = await getHomeData();
  const products = listings.slice(0, 5);
  const stores = [...new Map(listings.map((item) => [item.store.username, item.store])).values()].slice(0, 5);

  return (
    <main className="market-home">
      <section className="shell market-hero">
        <div className="market-hero__copy">
          <p className="market-hero__kicker">Oddiy marketplace’dan ko‘proq.</p>
          <h1>Sotib ol. <span>Sot. O‘s.</span></h1>
          <h2>Mahsulot topish va savdo qilish uchun sodda marketplace.</h2>
          <p>Mahsulotni toping, do‘konni tekshiring va buyurtma holatini bir joyda kuzating.</p>
          <div className="market-hero__actions">
            <Link className="rs-button" href="/marketplace">Mahsulotlarni ko‘rish <b>→</b></Link>
            <Link className="rs-button rs-button--ghost" href="/seller/manage">Sotishni boshlash</Link>
          </div>
          <div className="market-hero__stats" aria-label="Platforma qoidalari">
            <span><b>0%</b> Marketplace komissiyasi</span>
            <span><b>60 daqiqa</b> Seller javob muddati</span>
            <span><b>Shaffof</b> Buyurtma tarixi</span>
          </div>
        </div>
        <div className="hero-emblem" aria-hidden="true"><span>R</span></div>
      </section>

      <nav className="shell category-rail" aria-label="Mahsulot kategoriyalari">
        {categories.slice(0, 8).map((category) => <Link key={category.slug} href={`/marketplace?category=${encodeURIComponent(category.slug)}`}><span>{categoryIcons[category.nameUz] ?? '◇'}</span><b>{category.nameUz}</b></Link>)}
        <Link href="/categories"><span>•••</span><b>Barchasi</b></Link>
      </nav>

      <section className="shell home-section">
        <div className="section-heading"><h2>Yangi mahsulotlar</h2><Link href="/marketplace?sort=new">Barchasini ko‘rish →</Link></div>
        {unavailable ? <StatePanel tone="danger" title="Marketplace bilan aloqa yo‘q" description="Ma’lumotlar xizmati tiklangach mahsulotlar shu yerda ko‘rinadi." action={<Link className="rs-button" href="/">Qayta urinish</Link>} /> : products.length === 0 ? <StatePanel title="Hozircha faol mahsulot yo‘q" description="Seller mahsulot joylab, moderatsiyadan o‘tkazgach katalog shu yerda paydo bo‘ladi." action={<Link className="rs-button" href="/seller/manage">Birinchi mahsulotni joylash</Link>} /> : <div className="product-grid">
          {products.map((product) => {
            const stock = product.variants.reduce((sum, variant) => sum + (variant.inventory?.available ?? 0), 0);
            const productImage = product.media[0];
            return <Link href={`/product/${product.publicId}`} className="product-card" key={product.publicId}>
              <div className="product-card__visual">{productImage ? <img src={`${API}/media/${productImage.thumbnailStorageKey ?? productImage.storageKey}`} alt={product.nameUz} loading="lazy" /> : <div className="product-art product-art--phone"><span aria-hidden="true" /></div>}</div>
              <div className="product-card__body"><h3>{product.nameUz}</h3><p>{product.category.nameUz}</p><strong>{money(product.priceMinor)} {product.currency}</strong><div className="store-line"><i>{product.store.nameUz.slice(0, 2)}</i><span>{product.store.nameUz}</span><b>✓ {badgeName(product.store.sellerProfile.trustBadge)}</b></div><small className={stock > 0 ? 'in-stock' : 'out-stock'}>{stock > 0 ? `${stock} dona mavjud` : 'Tugagan'}</small></div>
            </Link>;
          })}
        </div>}
      </section>

      {stores.length > 0 && <section className="shell home-section">
        <div className="section-heading"><h2>Faol do‘konlar</h2><Link href="/marketplace">Mahsulotlarni ko‘rish →</Link></div>
        <div className="trusted-stores">{stores.map((store) => <Link href={`/store/${store.username}`} key={store.username}><i>{store.nameUz.slice(0, 2)}</i><span><b>{store.nameUz}</b><small>@{store.username}</small><em>✓ {badgeName(store.sellerProfile.trustBadge)}</em></span></Link>)}</div>
      </section>}

      <section className="shell home-banners"><div><h2>Telefonda ham qulay</h2><p>Mahsulot qidirish, savat va buyurtma kuzatuvi kichik ekranga moslashtirilgan.</p><Link href="/marketplace">Marketplace’ni ochish →</Link></div><div><h2>Sotishni boshlang</h2><p>Do‘kon yarating, tasdiqdan o‘ting va mahsulotingizni boshqaring.</p><Link href="/seller/manage">Seller kabineti →</Link></div></section>
      <section className="shell trust-strip"><span>◷ <b>60 daqiqalik javob</b></span><span>♜ <b>Seller tekshiruvi</b></span><span>▣ <b>O‘zgarmas order tarixi</b></span><span>◉ <b>Private order chat</b></span></section>
      <footer className="market-footer shell"><div><strong>RESALLER</strong><p>Sotib ol · Sot · O‘s</p></div><div><b>Marketplace</b><Link href="/marketplace">Mahsulotlar</Link><Link href="/categories">Kategoriyalar</Link><Link href="/favorites">Sevimlilar</Link></div><div><b>Hisob</b><Link href="/orders">Buyurtmalar</Link><Link href="/account">Xavfsizlik</Link><Link href="/recovery">Hisobni tiklash</Link></div><div><b>Sotuvchi uchun</b><Link href="/seller/manage">Sotishni boshlash</Link><Link href="/seller">Action Center</Link><small>Legal hujjatlar launchdan oldin e’lon qilinadi.</small></div></footer>
    </main>
  );
}
