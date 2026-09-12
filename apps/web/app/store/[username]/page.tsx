import Link from 'next/link';
import { notFound } from 'next/navigation';
import { demoStores } from '../../lib/demo-catalog';
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
type Store = {
  publicId: string;
  username: string;
  nameUz: string;
  descriptionUz?: string | null;
  vacationMode: boolean;
  sellerProfile: { trustBadge: string; verifiedAt?: string | null };
  importedTestimonials?: {
    id: string;
    sourceLabel: string;
    authorLabel: string;
    body: string;
    createdAt: string;
  }[];
  listings: {
    publicId: string;
    nameUz: string;
    priceMinor: string;
    currency: string;
    media: { storageKey: string; thumbnailStorageKey?: string | null }[];
    variants: { inventory: { available: number } | null }[];
  }[];
};
export const dynamic = 'force-dynamic';
export default async function StorePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const response = await fetch(
    `${API}/stores/${encodeURIComponent(username)}`,
    { cache: 'no-store' },
  ).catch(() => null);
  const fallback = demoStores[username as keyof typeof demoStores];
  if (response?.status === 404 && !fallback) notFound();
  if (!response?.ok && !fallback) throw new Error('Store unavailable');
  const store = response?.ok ? (await response.json()) as Store : fallback as Store;
  return (
    <main className="store-page">
      <section className="store-hero">
        <div className="store-hero__banner"><span>MORE THAN PRODUCTS</span></div>
        <div className="shell store-hero__content">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="store-identity">
              <i>{store.nameUz.slice(0, 2)}</i>
              <div>
              <p className="eyebrow">@{store.username}</p>
              <h1 className="mt-2 text-4xl font-black">{store.nameUz}</h1>
              <p className="muted mt-3 max-w-2xl">
                {store.descriptionUz ?? 'Mahalliy sotuvchi do‘koni.'}
              </p>
              </div>
            </div>
            <div className="store-hero__actions"><span>✓ {store.sellerProfile.trustBadge.replaceAll('_', ' ')}</span><button>+ Kuzatish</button><button>Ulashish</button></div>
          </div>
          <div className="store-stats"><span><b>4.9</b> 1.2K sharh</span><span><b>1,284</b> Buyurtma</span><span><b>98%</b> Muvaffaqiyat</span><span><b>2 yil</b> Resaller’da</span><span><b>Toshkent</b> Joylashuv</span></div>
          {store.vacationMode && (
            <p className="mt-5 rounded-xl bg-amber-100 p-3 text-sm font-bold text-amber-900">
              Do‘kon hozir ta’tilda. Javob kechikishi mumkin.
            </p>
          )}
        </div>
      </section>
      <section className="shell py-10">
        <nav className="store-tabs"><b>Mahsulotlar ({store.listings.length})</b><span>Kategoriyalar</span><span>Aksiyalar</span><span>Savol-javob</span><span>Sharhlar</span><span>Do‘kon haqida</span></nav>
        <div className="store-products-head"><h2 className="text-2xl font-black">Mahsulotlar</h2><input aria-label="Do‘kondan qidirish" placeholder="Do‘kondan mahsulot qidiring..." /></div>
        <div className="store-products mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {store.listings.map((item) => (
            <Link
              className="surface overflow-hidden"
              href={`/product/${item.publicId}`}
              key={item.publicId}
            >
              {item.media[0] ? (
                <img
                  className="aspect-[4/3] w-full object-cover"
                  src={`${API}/media/${item.media[0].thumbnailStorageKey ?? item.media[0].storageKey}`}
                  alt={item.nameUz}
                />
              ) : (
                <div className="aspect-[4/3] product-art product-art--phone"><span /></div>
              )}
              <div className="p-4">
                <h3 className="font-black">{item.nameUz}</h3>
                <p className="mt-2 text-sm font-bold">
                  {Number(item.priceMinor).toLocaleString('uz-UZ')}{' '}
                  {item.currency}
                </p>
              </div>
            </Link>
          ))}
        </div>
        <section className="store-testimonials mt-12">
          <div><p className="eyebrow">Tashqi platformalardan</p><h2 className="mt-2 text-2xl font-black">Import qilingan fikrlar</h2><p className="muted mt-2 text-sm">Bu fikrlar Resaller buyurtmasi orqali tasdiqlanmagan va manbasi alohida ko‘rsatiladi.</p></div>
          {(store.importedTestimonials?.length ?? 0) > 0 ? <div className="mt-5 grid gap-4 md:grid-cols-3">{store.importedTestimonials?.map((item) => <article className="surface p-5" key={item.id}><span className="testimonial-source">IMPORT · {item.sourceLabel}</span><p className="mt-4 leading-relaxed">“{item.body}”</p><b className="mt-4 block text-sm">{item.authorLabel}</b></article>)}</div> : <div className="surface mt-5 p-5"><p className="muted text-sm">Hozircha import qilingan fikr yo‘q. Resaller ichidagi tasdiqlangan sharhlar doimo alohida ko‘rsatiladi.</p></div>}
        </section>
      </section>
    </main>
  );
}
