import { Skeleton } from '@resaller/ui';

export default function Loading() {
  return (
    <main
      className="shell py-10"
      aria-label="Sahifa yuklanmoqda"
      aria-busy="true"
    >
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-4 h-10 max-w-xl" />
      <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="surface overflow-hidden">
            <Skeleton className="aspect-[4/3] rounded-none" />
            <div className="p-5">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="mt-3 h-4 w-1/2" />
            </div>
          </div>
        ))}
      </section>
      <span className="sr-only">Yuklanmoqda…</span>
    </main>
  );
}
