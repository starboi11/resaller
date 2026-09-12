import Link from 'next/link';
import { StatePanel } from '@resaller/ui';
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
type Category = {
  slug: string;
  nameUz: string;
  nameRu?: string | null;
  parent?: { slug: string } | null;
  attributes: unknown[];
};
export const dynamic = 'force-dynamic';
export default async function Categories() {
  let categories: Category[] = [];
  let failed = false;
  try {
    const response = await fetch(`${API}/categories`, { cache: 'no-store' });
    if (!response.ok) throw new Error();
    categories = (await response.json()) as Category[];
  } catch {
    failed = true;
  }
  return (
    <main className="shell py-10">
      <p className="eyebrow">Katalog</p>
      <h1 className="mt-2 text-3xl font-black">Kategoriyalar</h1>
      <p className="muted mt-2">Mahsulotlarni kerakli bo‘limdan tez toping.</p>
      {failed && (
        <div className="mt-7">
          <StatePanel
            tone="danger"
            title="Kategoriyalar ochilmadi"
            description="Xizmatni tekshirib, qayta urinib ko‘ring."
          />
        </div>
      )}
      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((category, index) => (
          <Link
            href={`/marketplace?category=${encodeURIComponent(category.slug)}`}
            className="surface min-h-36 p-5"
            key={category.slug}
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--brand-soft)] font-black text-[var(--brand-strong)]">
              {index + 1}
            </span>
            <h2 className="mt-5 font-black">{category.nameUz}</h2>
            <p className="muted mt-1 text-xs">
              {category.attributes.length} ta xususiyat
            </p>
          </Link>
        ))}
      </section>
    </main>
  );
}
