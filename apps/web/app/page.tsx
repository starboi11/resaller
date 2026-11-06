import Link from 'next/link';
function StepIcon({ kind }: { kind: 'search' | 'bag' | 'delivery' }) {
  const paths = {
    search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    bag: 'M5 7h14l2 14H3L5 7ZM8 8V6a4 4 0 0 1 8 0v2',
    delivery:
      'M1 5h13v13H1ZM14 10h4l4 5v3h-8M8 19a2 2 0 1 1-4 0 2 2 0 0 1 4 0M20 19a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
  };
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[kind]} />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="warm-home shell">
      <section
        className="warm-hero warm-hero--film"
        aria-labelledby="home-title"
      >
        <div className="warm-hero__copy">
          <p className="warm-kicker">RESALLER / SIZ UCHUN TANLANGAN</p>
          <h1 id="home-title">
            Har kuningizga <em>mos</em>
          </h1>
          <p className="warm-lede">
            O‘zingizga yoqqanini toping
            <br />
            Resaller’dan buyurtma bering
          </p>
          <Link className="rs-button" href="/marketplace">
            Mahsulotlarni ko‘rish <span aria-hidden="true">↗</span>
          </Link>
          <a className="warm-text-link" href="#qanday-ishlaydi">
            Qanday buyurtma beraman? <span aria-hidden="true">↓</span>
          </a>
        </div>
        <div className="warm-hero-film" aria-hidden="true">
          <video
            autoPlay
            muted
            playsInline
            preload="metadata"
            width={270}
            height={480}
            poster="/brand/resaller-film-poster.webp"
          >
            <source src="/brand/resaller-film-silent.mp4" type="video/mp4" />
          </video>
        </div>
      </section>
      <nav className="warm-shortcuts" aria-label="Tezkor havolalar">
        <Link href="/marketplace">
          <span>01</span> Barcha mahsulotlar <b aria-hidden="true">↗</b>
        </Link>
        <Link href="/favorites">
          <span>02</span> Sevimlilarim <b aria-hidden="true">↗</b>
        </Link>
        <Link href="/orders">
          <span>03</span> Buyurtmalarim <b aria-hidden="true">↗</b>
        </Link>
      </nav>
      <section
        className="warm-guide"
        id="qanday-ishlaydi"
        aria-labelledby="guide-title"
      >
        <div className="warm-section-title">
          <p className="warm-kicker">HAMMASI OSON</p>
          <h2 id="guide-title">Siz tanlang, biz yetkazamiz</h2>
        </div>
        <div className="warm-steps">
          <article>
            <div className="warm-step-top">
              <StepIcon kind="search" />
              <span>01</span>
            </div>
            <span>TANLANG</span>
            <h3>O‘zingizga mosini toping</h3>
            <p>
              Katalogda mahsulot tafsilotlarini ko‘ring, rang va o‘lchamini
              tanlang
            </p>
            <Link href="/marketplace">Katalogni ochish →</Link>
          </article>
          <article>
            <div className="warm-step-top">
              <StepIcon kind="bag" />
              <span>02</span>
            </div>
            <span>BUYURTMA BERING</span>
            <h3>Manzilingizni kiriting</h3>
            <p>Savatni tekshiring va yetkazish ma’lumotlarini to‘ldiring</p>
            <Link href="/cart">Savatga o‘tish →</Link>
          </article>
          <article>
            <div className="warm-step-top">
              <StepIcon kind="delivery" />
              <span>03</span>
            </div>
            <span>KUZATIB BORING</span>
            <h3>Xaridingizdan xabardor bo‘ling</h3>
            <p>
              Buyurtma holatini hisobingizda kuzating, savol bo‘lsa bizga yozing
            </p>
            <Link href="/orders">Buyurtmalarim →</Link>
          </article>
        </div>
      </section>
      <footer className="warm-footer">
        <strong>RESALLER.uz</strong>
        <span>Siz uchun tanlangan mahsulotlar</span>
        <Link href="/account">Mening hisobim ↗</Link>
      </footer>
    </main>
  );
}
