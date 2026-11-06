import Link from 'next/link';

// Retired with the reseller model (2026-11-03): only the owner sells.
export default function RetiredPage() {
  return (
    <main className="admin-shell grid max-w-2xl gap-4 p-6">
      <h1>Bu bo‘lim endi ishlatilmaydi</h1>
      <p className="empty">Qayta sotish modeli to‘xtatilgan. Eski yozuvlar audit uchun database’da saqlanadi.</p>
      <Link className="rs-button" href="/owner">Boshqaruvga qaytish</Link>
    </main>
  );
}
