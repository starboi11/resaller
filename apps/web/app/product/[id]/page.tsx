import { StatePanel } from '@resaller/ui';
import { notFound } from 'next/navigation';
import { AddToCart } from '../add-to-cart';
import { ProductActions } from '../product-actions';

export const dynamic = 'force-dynamic';
const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000/api/v1';
type Product = {
  publicId: string;
  nameUz: string;
  descriptionUz: string;
  priceMinor: string;
  currency: string;
  category: { nameUz: string };
  store: {
    nameUz: string;
    username: string;
    sellerProfile: { trustBadge: string; verifiedAt: string | null };
  };
  variants: {
    id: string;
    sku: string;
    options: Record<string, string>;
    inventory: { available: number } | null;
  }[];
  media: { storageKey: string }[];
};

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const response = await fetch(
    `${api}/marketplace/listings/${encodeURIComponent(id)}`,
    { cache: 'no-store' },
  ).catch(() => null);
  if (response?.status === 404) notFound();
  if (!response?.ok)
    return (
      <main className="shell py-12">
        <StatePanel
          tone="danger"
          title="Mahsulotni yuklab bo‘lmadi"
          description="Xizmat vaqtincha ishlamayapti. Keyinroq qayta urinib ko‘ring."
        />
      </main>
    );
  const product = (await response.json()) as Product;
  const stock = product.variants.reduce(
    (sum, variant) => sum + (variant.inventory?.available ?? 0),
    0,
  );
  const firstAvailable =
    product.variants.find(
      (variant) => (variant.inventory?.available ?? 0) > 0,
    ) ?? product.variants[0];
  return (
    <main className="shell py-8 sm:py-12">
      <nav className="muted mb-6 text-sm" aria-label="Breadcrumb">
        <a href="/marketplace">Marketplace</a> <span aria-hidden="true">/</span>{' '}
        {product.category.nameUz}
      </nav>
      <div className="grid gap-8 lg:grid-cols-[1.05fr_.95fr]">
        <section aria-label="Mahsulot rasmlari">
          {product.media[0] ? (
            <img
              src={`${api}/media/${product.media[0].storageKey}`}
              alt={product.nameUz}
              className="surface aspect-square w-full object-cover"
            />
          ) : (
            <div
              className="surface aspect-square bg-gradient-to-br from-violet-200 via-fuchsia-100 to-amber-100 dark:from-violet-950 dark:via-fuchsia-950 dark:to-amber-950"
              role="img"
              aria-label="Mahsulot rasmi mavjud emas"
            />
          )}
        </section>
        <section className="lg:py-3">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-xs font-black text-[var(--brand-strong)]">
              {product.store.sellerProfile.trustBadge.replaceAll('_', ' ')}
            </span>
            {product.store.sellerProfile.verifiedAt && (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                Shaxs tasdiqlangan
              </span>
            )}
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">
            {product.nameUz}
          </h1>
          <p className="mt-4 text-2xl font-black">
            {new Intl.NumberFormat('uz-UZ').format(Number(product.priceMinor))}{' '}
            so‘m
          </p>
          <p
            className={`mt-2 text-sm font-bold ${stock ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}
          >
            {stock ? `Omborda ${stock} dona` : 'Mahsulot tugagan'}
          </p>
          <div className="my-7 h-px bg-[var(--line)]" />
          <p className="muted leading-7">{product.descriptionUz}</p>
          {product.variants.length > 1 && (
            <div className="mt-6">
              <p className="text-sm font-black">Variantlar</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {product.variants.map((variant) => (
                  <span
                    key={variant.id}
                    className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm"
                  >
                    {Object.values(variant.options).join(' / ') || variant.sku}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="surface mt-7 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-black">{product.store.nameUz}</p>
                <p className="muted text-sm">@{product.store.username}</p>
              </div>
              <span className="text-sm font-bold text-[var(--brand-strong)]">
                Do‘kon →
              </span>
            </div>
          </div>
          <div className="mt-7">
            <AddToCart
              listingPublicId={product.publicId}
              variantId={firstAvailable?.id ?? ''}
              disabled={!firstAvailable || stock === 0}
            />
            <div className="mt-3">
              <ProductActions
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
              <b>60 daqiqalik tasdiq</b>
              <p className="muted mt-1">
                Sotuvchi buyurtmaga vaqtida javob beradi.
              </p>
            </div>
            <div className="rounded-2xl bg-[var(--surface-2)] p-4">
              <b>Shaffof tarix</b>
              <p className="muted mt-1">Muhim holatlar buyurtmada saqlanadi.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
