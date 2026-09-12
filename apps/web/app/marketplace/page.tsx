import Link from 'next/link';
import { StatePanel } from '@resaller/ui';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Marketplace' };
type Listing = {
  publicId: string;
  nameUz: string;
  priceMinor: string;
  store: { nameUz: string; sellerProfile: { trustBadge: string } };
  variants: { inventory: { available: number } | null }[];
  media: { storageKey: string; thumbnailStorageKey?: string | null }[];
};
const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000/api/v1';
const money = (value: string) =>
  new Intl.NumberFormat('uz-UZ').format(Number(value));

export default async function Marketplace({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q, category } = await searchParams;
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (category) params.set('category', category);
  let products: Listing[] = [];
  let unavailable = false;
  try {
    const response = await fetch(`${api}/marketplace/listings?${params}`, {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error();
    products = (await response.json()) as Listing[];
  } catch {
    unavailable = true;
  }
  return (
    <main className="shell py-9 sm:py-12">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Xavfsiz xarid boshlanishi</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            Marketplace
          </h1>
          <p className="muted mt-2 text-sm">
            Mahsulot, do‘kon yoki kategoriya bo‘yicha qidiring.
          </p>
        </div>
        <span className="muted text-sm">
          {unavailable ? '—' : `${products.length} ta natija`}
        </span>
      </header>
      <form className="surface mt-7 flex gap-2 p-2" role="search">
        <label className="sr-only" htmlFor="market-search">
          Mahsulot qidirish
        </label>
        <input
          id="market-search"
          name="q"
          defaultValue={q}
          placeholder="Masalan: qo‘l sumkasi"
          className="field min-w-0 flex-1 border-0 bg-transparent"
        />
        <button className="rs-button shrink-0">Qidirish</button>
      </form>
      <div
        className="mt-4 flex gap-2 overflow-x-auto pb-2"
        aria-label="Tezkor kategoriyalar"
      >
        {['Barchasi', 'Kiyim', 'Uy uchun', 'Elektronika', 'Go‘zallik'].map(
          (item, index) => (
            <Link
              key={item}
              href={
                index === 0
                  ? '/marketplace'
                  : `/marketplace?category=${encodeURIComponent(['', 'clothing', 'home', 'electronics', 'beauty'][index]!)}`
              }
              className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-bold ${index === 0 ? 'border-transparent bg-[var(--brand-soft)] text-[var(--brand-strong)]' : 'border-[var(--line)] bg-[var(--surface)]'}`}
            >
              {item}
            </Link>
          ),
        )}
      </div>
      {unavailable && (
        <div className="mt-8">
          <StatePanel
            tone="danger"
            title="Marketplace vaqtincha ochilmadi"
            description="Internet yoki xizmat holatini tekshirib, sahifani qayta yuklang."
            action={
              <Link className="rs-button" href="/marketplace">
                Qayta urinish
              </Link>
            }
          />
        </div>
      )}
      {!unavailable && products.length === 0 && (
        <div className="mt-8">
          <StatePanel
            title={
              q
                ? 'Qidiruv bo‘yicha mahsulot topilmadi'
                : 'Hozircha faol mahsulot yo‘q'
            }
            description={
              q
                ? 'So‘zni qisqartirib yoki boshqa nom bilan qidirib ko‘ring.'
                : 'Tasdiqlangan mahsulotlar shu yerda paydo bo‘ladi.'
            }
            action={
              q ? (
                <Link className="rs-button" href="/marketplace">
                  Filtrni tozalash
                </Link>
              ) : undefined
            }
          />
        </div>
      )}
      <section className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
        {products.map((product) => {
          const stock = product.variants.reduce(
            (sum, variant) => sum + (variant.inventory?.available ?? 0),
            0,
          );
          return (
            <Link
              href={`/product/${product.publicId}`}
              key={product.publicId}
              className="surface group overflow-hidden transition-transform hover:-translate-y-1"
            >
              <div className="relative">
                {product.media[0] ? (
                  <img
                    src={`${api}/media/${product.media[0].thumbnailStorageKey ?? product.media[0].storageKey}`}
                    alt={product.nameUz}
                    className="aspect-[4/3] w-full object-cover"
                  />
                ) : (
                  <div className="aspect-[4/3] bg-gradient-to-br from-violet-200 via-fuchsia-100 to-amber-100 dark:from-violet-950 dark:via-fuchsia-950 dark:to-amber-950" />
                )}
                <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-black text-white backdrop-blur">
                  {product.store.sellerProfile.trustBadge.replaceAll('_', ' ')}
                </span>
              </div>
              <div className="p-4 sm:p-5">
                <p className="muted truncate text-xs">{product.store.nameUz}</p>
                <h2 className="mt-1 line-clamp-2 min-h-10 text-sm font-bold sm:text-lg">
                  {product.nameUz}
                </h2>
                <div className="mt-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <b className="text-sm sm:text-base">
                    {money(product.priceMinor)} so‘m
                  </b>
                  <span
                    className={`text-xs ${stock ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}
                  >
                    {stock ? `${stock} dona` : 'Tugagan'}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
