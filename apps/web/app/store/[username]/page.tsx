import Link from 'next/link';
import { notFound } from 'next/navigation';
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
type Store = {
  publicId: string;
  username: string;
  nameUz: string;
  descriptionUz?: string | null;
  vacationMode: boolean;
  sellerProfile: { trustBadge: string; verifiedAt?: string | null };
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
  );
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error('Store unavailable');
  const store = (await response.json()) as Store;
  return (
    <main>
      <section className="border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="shell py-10">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="eyebrow">@{store.username}</p>
              <h1 className="mt-2 text-4xl font-black">{store.nameUz}</h1>
              <p className="muted mt-3 max-w-2xl">
                {store.descriptionUz ?? 'Mahalliy sotuvchi do‘koni.'}
              </p>
            </div>
            <span className="rounded-full bg-[var(--brand-soft)] px-4 py-2 text-sm font-black text-[var(--brand-strong)]">
              {store.sellerProfile.trustBadge.replaceAll('_', ' ')}
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
        <h2 className="text-2xl font-black">Mahsulotlar</h2>
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
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
                <div className="aspect-[4/3] bg-[var(--surface-2)]" />
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
      </section>
    </main>
  );
}
