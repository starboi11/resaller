'use client';
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <p className="eyebrow">Tizim xatosi</p>
      <h1 className="mt-3 text-3xl font-black">Admin panel ochilmadi</h1>
      <p className="mt-3 text-slate-400">
        Amal bajarilmadi. Xizmat holatini tekshirib, qayta urinib ko‘ring.
      </p>
      <button className="rs-button mt-6" onClick={reset}>
        Qayta urinish
      </button>
    </main>
  );
}
