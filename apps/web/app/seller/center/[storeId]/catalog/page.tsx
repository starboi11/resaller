import Link from 'next/link';

export const metadata = { title: 'Bo‘lim ishlatilmaydi — Resaller' };

// The reseller model was retired on 2026-11-03 (only the owner sells). Old
// bookmarks land here instead of on a page that no longer does anything.
export default async function RetiredResalePage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  return (
    <main className="shell max-w-2xl py-14">
      <section className="surface p-8">
        <h1 className="text-2xl font-black">Bu bo‘lim endi ishlatilmaydi</h1>
        <p className="muted mt-3">Qayta sotish modeli to‘xtatilgan. Do‘konni boshqarish va buyurtmalar Sotuvchi kabinetida qoldi.</p>
        <Link className="rs-button mt-6 inline-flex" href={`/seller/center/${encodeURIComponent(storeId)}`}>Boshqaruvga qaytish</Link>
      </section>
    </main>
  );
}
