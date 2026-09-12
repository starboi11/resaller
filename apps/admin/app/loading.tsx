export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl p-5 sm:p-8" aria-busy="true">
      <p className="eyebrow">Resaller Control Center</p>
      <h1 className="mt-2 text-3xl font-black">Admin boshqaruvi</h1>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[1, 2, 3, 4, 5].map((item) => (
          <div className="metric min-h-24 animate-pulse" key={item} />
        ))}
      </div>
      <span className="sr-only">Yuklanmoqda…</span>
    </main>
  );
}
