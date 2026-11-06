import { StatePanel } from '@resaller/ui';
import { notFound } from 'next/navigation';
import { ProductActions } from '../product-actions';
import { ProductGallery } from '../product-gallery';
import { PurchasePanel } from '../purchase-panel';
import { demoListings } from '../../lib/demo-catalog';

export const dynamic = 'force-dynamic';
const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
type Product = {
  publicId: string;
  nameUz: string;
  nameRu?: string | null;
  descriptionUz: string;
  descriptionRu?: string | null;
  priceMinor: string;
  salePriceMinor?: string | null;
  videoStorageKey?: string | null;
  currency: string;
  status?: string;
  attributeValues?: Record<string, unknown>;
  purchasable?: boolean;
  category: { nameUz: string };
  store: {
    publicId: string;
    nameUz: string;
    username: string;
    sellerProfile: { trustBadge: string; verifiedAt: string | null };
    vacationMode?: boolean;
    settings?: {
      deliverySettings: unknown;
      workingHours: unknown;
      vacationMessageUz?: string | null;
    } | null;
    policies?: { version: number; content: unknown; publishedAt: string }[];
  };
  variants: {
    id: string;
    sku: string;
    options: Record<string, string>;
    priceOverrideMinor?: string | null;
    inventory: { available: number } | null;
  }[];
  media: {
    storageKey: string;
    thumbnailStorageKey?: string | null;
    variantId?: string | null;
  }[];
  questions?: {
    id: string;
    body: string;
    pinned: boolean;
    author: { username: string };
    answer?: { body: string } | null;
  }[];
  reviews?: {
    id: string;
    rating: number;
    body?: string | null;
    createdAt: string;
  }[];
  rating?: {
    count: number;
    average: number | null;
    distribution?: Record<string, number>;
  };
};

function readable(value: unknown, fallback: string) {
  if (!value || typeof value !== 'object') return fallback;
  const values = Object.values(value as Record<string, unknown>).filter(
    (item) => typeof item === 'string' || typeof item === 'number',
  );
  return values.length ? values.join(' · ') : fallback;
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ variant?: string; lang?: 'uz' | 'ru' }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const response = await fetch(
    `${api}/marketplace/listings/${encodeURIComponent(id)}`,
    { cache: 'no-store' },
  ).catch(() => null);
  const fallback =
    process.env.NODE_ENV === 'development' && process.env.DEMO_CATALOG_ENABLED === 'true'
      ? demoListings.find((item) => item.publicId === id)
      : undefined;
  if (response?.status === 404 && !fallback) notFound();
  if (!response?.ok && !fallback)
    return (
      <main className="shell py-12">
        <StatePanel
          tone="danger"
          title="Mahsulotni yuklab bo‘lmadi"
          description="Xizmat vaqtincha ishlamayapti. Keyinroq qayta urinib ko‘ring."
        />
      </main>
    );
  const product = response?.ok
    ? ((await response.json()) as Product)
    : (fallback as Product);
  const restricted =
    product.purchasable === false ||
    product.status === 'RESTRICTED' ||
    product.store.vacationMode === true;
  const selectedVariant = product.variants.find(
    (item) => item.id === query.variant,
  )?.id;
  const deliveryOverrides = product.attributeValues?.deliveryOverrides as
    Record<string, unknown> | undefined;
  const delivery =
    selectedVariant && deliveryOverrides?.[selectedVariant]
      ? deliveryOverrides[selectedVariant]
      : product.store.settings?.deliverySettings;
  const displayName =
    query.lang === 'ru' && product.nameRu ? product.nameRu : product.nameUz;
  const description =
    query.lang === 'ru' && product.descriptionRu
      ? product.descriptionRu
      : product.descriptionUz;
  return (
    <main className="product-detail shell py-8 sm:py-12">
      <nav className="muted mb-6 text-sm" aria-label="Breadcrumb">
        <a href="/marketplace">Marketplace</a> <span aria-hidden="true">/</span>{' '}
        {product.category.nameUz}
      </nav>
      {product.status === 'RESTRICTED' && (
        <div
          className="mb-6 rounded-xl bg-red-100 p-4 font-bold text-red-900"
          role="status"
        >
          Bu mahsulot moderatsiya cheklovi sabab hozir sotilmaydi.
        </div>
      )}
      {product.status === 'OUT_OF_STOCK' && (
        <div
          className="mb-6 rounded-xl bg-amber-100 p-4 font-bold text-amber-900"
          role="status"
        >
          Mahsulot hozir omborda mavjud emas.
        </div>
      )}
      <div className="product-detail__layout grid gap-8 lg:grid-cols-[1.05fr_.95fr]">
        <section className="product-gallery" aria-label="Mahsulot rasmlari">
          <ProductGallery
            name={displayName}
            media={product.media}
            selectedVariant={selectedVariant}
          />
          {product.videoStorageKey && (
            <video className="surface mt-4 w-full" controls preload="metadata">
              <source src={`${api}/media/${product.videoStorageKey}`} />
            </video>
          )}
        </section>
        <section className="product-info lg:py-3">
          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">
            {displayName}
          </h1>
          {product.rating?.average ? (
            <p className="mt-3 text-sm font-bold">
              ★ {product.rating.average} · {product.rating.count} ta
              tasdiqlangan sharh
            </p>
          ) : (
            <p className="muted mt-3 text-sm">
              Hozircha tasdiqlangan sharh yo‘q
            </p>
          )}
          <div className="my-7 h-px bg-[var(--line)]" />
          <p className="muted leading-7">{description}</p>
          <div className="mt-6">
            <PurchasePanel
              listingPublicId={product.publicId}
              basePriceMinor={product.salePriceMinor ?? product.priceMinor}
              currency={product.currency}
              variants={product.variants}
              restricted={restricted}
            />
          </div>
          {/* One seller: no seller card or trust badges, just who sells it. */}
          <p className="muted mt-5 text-sm">Sotuvchi: Resaller</p>
          <div className="product-buybar mt-7">
            <div>
              <ProductActions
                storePublicId={product.store.publicId}
                product={{
                  publicId: product.publicId,
                  nameUz: product.nameUz,
                  priceMinor: product.priceMinor,
                  currency: product.currency,
                }}
              />
            </div>
          </div>
          <div className="mt-7 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-2xl bg-[var(--surface-2)] p-4">
              <b>Yetkazib berish va ETA</b>
              <p className="muted mt-1">
                {readable(
                  delivery,
                  'Yetkazish usuli va muddati checkout vaqtida manzilga qarab ko‘rsatiladi.',
                )}
              </p>
            </div>
            <div className="rounded-2xl bg-[var(--surface-2)] p-4">
              <b>Qaytarish shartlari</b>
              <p className="muted mt-1">
                {readable(
                  product.store.policies?.[0]?.content,
                  'Qaytarish shartlari buyurtma paytida o‘zgarmas nusxa sifatida saqlanadi.',
                )}
              </p>
            </div>
          </div>
        </section>
      </div>
      <section className="product-community mt-12 grid gap-6 lg:grid-cols-2">
        <div className="surface p-6">
          <h2 className="text-xl font-black">Savol-javob</h2>
          {product.questions?.length ? (
            <div className="mt-4 grid gap-4">
              {product.questions.map((item) => (
                <article key={item.id}>
                  <p className="font-bold">
                    {item.pinned ? '📌 ' : ''}
                    {item.body}
                  </p>
                  <small className="muted">@{item.author.username}</small>
                  {item.answer ? (
                    <p className="mt-2 rounded-xl bg-[var(--surface-2)] p-3">
                      <b>Resaller:</b> {item.answer.body}
                    </p>
                  ) : (
                    <p className="muted mt-2 text-sm">Hali javob berilmagan</p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="muted mt-3">Hozircha ochiq savol yo‘q.</p>
          )}
        </div>
        <div className="surface p-6">
          <h2 className="text-xl font-black">Tasdiqlangan sharhlar</h2>
          {product.rating?.distribution && (
            <div className="rating-distribution" aria-label="Baholar taqsimoti">
              {[5, 4, 3, 2, 1].map((value) => {
                const count =
                  product.rating?.distribution?.[String(value)] ?? 0;
                const percent = product.rating?.count
                  ? Math.round((count / product.rating.count) * 100)
                  : 0;
                return (
                  <div key={value}>
                    <span>{value} ★</span>
                    <i>
                      <b style={{ width: `${percent}%` }} />
                    </i>
                    <small>{count}</small>
                  </div>
                );
              })}
            </div>
          )}
          {product.reviews?.length ? (
            <div className="mt-4 grid gap-4">
              {product.reviews.map((item) => (
                <article key={item.id}>
                  <p aria-label={`${item.rating} yulduz`}>
                    {'★'.repeat(item.rating)}
                    {'☆'.repeat(5 - item.rating)}
                  </p>
                  <p className="mt-1">{item.body || 'Baho qoldirilgan.'}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted mt-3">
              Bu mahsulot uchun hali tasdiqlangan sharh yo‘q.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
