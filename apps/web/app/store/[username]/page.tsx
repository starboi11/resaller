import { notFound } from 'next/navigation';
import { demoStores } from '../../lib/demo-catalog';
import { StoreActions } from '../store-actions';
import { StoreCatalog } from '../store-catalog';
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
type Store = {
  publicId: string;
  username: string;
  nameUz: string;
  descriptionUz?: string | null;
  vacationMode: boolean;
  logoStorageKey?: string | null;
  bannerStorageKey?: string | null;
  premiumUntil?: string | null;
  collections?: {
    publicId: string;
    nameUz: string;
    nameRu?: string | null;
    items: { listing: { publicId: string; nameUz: string } }[];
  }[];
  sellerProfile: { trustBadge: string; verifiedAt?: string | null };
  questions?: {
    id: string;
    body: string;
    answer?: { body: string } | null;
    listing?: { nameUz: string } | null;
  }[];
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
  const fallback =
    process.env.NODE_ENV === 'development'
      ? demoStores[username as keyof typeof demoStores]
      : undefined;
  if (response?.status === 404 && !fallback) notFound();
  if (!response?.ok && !fallback) throw new Error('Store unavailable');
  const store = response?.ok
    ? ((await response.json()) as Store)
    : (fallback as Store);
  return (
    <main className="store-page">
      <section className="store-hero">
        <div
          className="store-hero__banner"
          style={
            store.bannerStorageKey
              ? {
                  backgroundImage: `linear-gradient(90deg,rgba(2,15,12,.78),rgba(2,15,12,.25)),url(${API}/media/${store.bannerStorageKey})`,
                }
              : undefined
          }
        >
          <span>MORE THAN PRODUCTS</span>
        </div>
        <div className="shell store-hero__content">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="store-identity">
              <i>
                {store.logoStorageKey ? (
                  <img
                    src={`${API}/media/${store.logoStorageKey}`}
                    alt={`${store.nameUz} logosi`}
                  />
                ) : (
                  store.nameUz.slice(0, 2)
                )}
              </i>
              <div>
                <p className="eyebrow">@{store.username}</p>
                <h1 className="mt-2 text-4xl font-black">{store.nameUz}</h1>
                {store.premiumUntil &&
                  new Date(store.premiumUntil) > new Date() && (
                    <span className="premium-pill">PREMIUM</span>
                  )}
                <p className="muted mt-3 max-w-2xl">
                  {store.descriptionUz ?? 'Mahalliy sotuvchi do‘koni.'}
                </p>
              </div>
            </div>
            <StoreActions
              publicId={store.publicId}
              trustBadge={store.sellerProfile.trustBadge}
            />
          </div>
          <div className="store-stats">
            <span>
              <b>{store.listings.length}</b> faol mahsulot
            </span>
            <span>
              <b>
                {store.listings.reduce(
                  (sum, item) =>
                    sum +
                    item.variants.reduce(
                      (total, variant) =>
                        total + (variant.inventory?.available ?? 0),
                      0,
                    ),
                  0,
                )}
              </b>{' '}
              dona mavjud
            </span>
            <span>
              <b>{store.importedTestimonials?.length ?? 0}</b> manbasi
              ko‘rsatilgan fikr
            </span>
            <span>
              <b>{store.sellerProfile.verifiedAt ? 'Ha' : 'Yo‘q'}</b> shaxs
              tasdig‘i
            </span>
          </div>
          {store.vacationMode && (
            <p className="mt-5 rounded-xl bg-amber-100 p-3 text-sm font-bold text-amber-900">
              Do‘kon hozir ta’tilda. Javob kechikishi mumkin.
            </p>
          )}
        </div>
      </section>
      <section className="shell py-10">
        {!!store.collections?.length && (
          <section
            className="store-collections"
            aria-labelledby="collections-title"
          >
            <p className="eyebrow">Tanlangan to‘plamlar</p>
            <h2 id="collections-title">Do‘kon kolleksiyalari</h2>
            <div className="store-collections__grid">
              {store.collections.map((collection) => (
                <article key={collection.publicId}>
                  <h3>{collection.nameUz}</h3>
                  <div>
                    {collection.items.map(({ listing }) => (
                      <a
                        key={listing.publicId}
                        href={`/product/${listing.publicId}`}
                      >
                        {listing.nameUz}
                      </a>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
        <StoreCatalog
          listings={store.listings}
          questions={store.questions}
          testimonials={store.importedTestimonials}
          description={store.descriptionUz}
        />
      </section>
    </main>
  );
}
