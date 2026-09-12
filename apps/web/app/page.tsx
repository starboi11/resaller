import Link from 'next/link';

const categories = [['▣', 'Elektronika'], ['♧', 'Moda'], ['♨', 'Go‘zallik'], ['⌂', 'Uy jihozlari'], ['♙', 'Bolalar'], ['▱', 'Avto'], ['✣', 'Sport'], ['♙', 'Xizmatlar']];
const products = [
  { name: 'iPhone 17 Pro', meta: '256GB · Black', price: '16 900 000 so‘m', old: '19 200 000', art: 'phone', badge: '-12%', store: 'STARBOY', trust: 'Trusted' },
  { name: 'Nike Air Force 1', meta: 'White', price: '1 290 000 so‘m', art: 'shoe', store: 'UZ_Sneakers', trust: 'Top Seller' },
  { name: 'MacBook Air M3', meta: '13-inch · 8GB/256GB', price: '14 500 000 so‘m', art: 'laptop', store: 'TechStore', trust: 'Trusted' },
  { name: 'Galaxy Watch 7', meta: '44mm · Black', price: '3 200 000 so‘m', art: 'watch', store: 'GadgetUz', trust: 'Verified' },
  { name: 'JBL Tune 770NC', meta: 'Black', price: '1 490 000 so‘m', art: 'headphones', store: 'MusicShop', trust: 'Trusted' },
];

function ProductArt({ kind }: { kind: string }) {
  return <div className={`product-art product-art--${kind}`}><span aria-hidden="true" /></div>;
}

export default function Home() {
  return (
    <main className="market-home">
      <section className="shell market-hero">
        <div className="market-hero__copy">
          <h1>Sotib ol. <span>Sot. O‘s.</span></h1>
          <h2>O‘zbekistondagi yangi avlod marketplace.</h2>
          <p>Haqiqiy mahsulotlar. Ishonchli do‘konlar. Yangi imkoniyatlar.</p>
          <div className="market-hero__actions">
            <Link className="rs-button" href="/marketplace">Mahsulotlarni ko‘rish <b>→</b></Link>
            <Link className="rs-button rs-button--ghost" href="/seller/manage">Sotishni boshlash</Link>
          </div>
          <div className="market-hero__stats">
            <span><b>100K+</b> Faol foydalanuvchilar</span>
            <span><b>5K+</b> Ishonchli do‘konlar</span>
            <span><b>250K+</b> Mahsulotlar</span>
            <span><b>99%</b> Xaridorlar qoniqishi</span>
          </div>
        </div>
        <div className="hero-emblem" aria-hidden="true"><span>R</span></div>
      </section>

      <nav className="shell category-rail" aria-label="Mahsulot kategoriyalari">
        {categories.map(([icon, label]) => <Link key={label} href={`/marketplace?category=${encodeURIComponent(label)}`}><span>{icon}</span><b>{label}</b></Link>)}
        <Link href="/categories"><span>•••</span><b>Barchasi</b></Link>
      </nav>

      <section className="shell home-section">
        <div className="section-heading"><h2>Siz uchun tavsiya etilgan</h2><Link href="/marketplace">Barchasini ko‘rish →</Link></div>
        <div className="product-grid">
          {products.map((product, index) => (
            <Link href={`/product/demo-${index + 1}`} className="product-card" key={product.name}>
              <div className="product-card__visual">{product.badge && <em>{product.badge}</em>}<span className="favorite-mark" aria-label="Sevimlilarga qo‘shish">♡</span><ProductArt kind={product.art} /></div>
              <div className="product-card__body"><h3>{product.name}</h3><p>{product.meta}</p><strong>{product.price}</strong>{product.old && <del>{product.old}</del>}<div className="rating">★ 4.{8 + (index % 2)} <span>({96 + index * 23})</span></div><div className="store-line"><i>{product.store.slice(0, 2)}</i><span>{product.store}</span><b>✓ {product.trust}</b></div></div>
            </Link>
          ))}
        </div>
      </section>

      <section className="shell promo-grid">
        <Link href="/marketplace?q=iphone"><b>Yangi iPhone 17 Pro</b><span>Chegarasiz imkoniyatlar.</span><em>Ko‘rish →</em></Link>
        <Link href="/marketplace?category=Moda"><b>O‘z uslubingni top</b><span>Trend moda tovarlari.</span><em>Ko‘rish →</em></Link>
        <Link href="/marketplace?category=Uy"><b>Uy uchun eng yaxshi tanlovlar</b><span>Qulaylik va sifat bir joyda.</span><em>Ko‘rish →</em></Link>
      </section>

      <section className="shell home-section">
        <div className="section-heading"><h2>Ishonchli do‘konlar</h2><Link href="/marketplace">Barchasini ko‘rish →</Link></div>
        <div className="trusted-stores">{[['R','STARBOY','4.9 (1.2K)','Trusted'],['UZ','UZ_Sneakers','4.8 (642)','Top Seller'],['TS','TechStore','4.9 (2.1K)','Trusted'],['GU','GadgetUz','4.7 (690)','Verified']].map(([mark,name,rating,badge]) => <Link href={`/store/${name}`} key={name}><i>{mark}</i><span><b>{name}</b><small>★ {rating}</small><em>✓ {badge}</em></span></Link>)}</div>
      </section>

      <section className="shell home-banners"><div><h2>Resaller ilovasini yuklab oling</h2><p>Har doim, har yerda, siz bilan.</p><span> App Store</span><span>▶ Google Play</span></div><div><h2>Yangi sellerlarga imkoniyat</h2><p>Biz bilan sotishni boshlang va o‘z mijozlaringizni toping.</p><Link href="/seller/manage">Sotishni boshlash →</Link></div></section>
      <section className="shell trust-strip"><span>▱ <b>Tez yetkazib berish</b></span><span>♜ <b>Ishonchli do‘konlar</b></span><span>♢ <b>Xavfsiz savdo</b></span><span>◉ <b>24/7 qo‘llab-quvvatlash</b></span></section>
      <footer className="market-footer shell"><div><strong>RESALLER</strong><p>Sotib ol · Sot · O‘s</p></div><div><b>Kompaniya</b><a>Biz haqimizda</a><a>Karyera</a><a>Blog</a></div><div><b>Yordam</b><a>Savollar</a><a>Qoidalar</a><a>Maxfiylik siyosati</a></div><div><b>Sotuvchi uchun</b><Link href="/seller/manage">Sotishni boshlash</Link><a>Qo‘llanmalar</a></div></footer>
    </main>
  );
}
