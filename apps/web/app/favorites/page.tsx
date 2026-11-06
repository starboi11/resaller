'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { StatePanel } from '@resaller/ui';
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
type Item = {
  publicId: string;
  nameUz: string;
  priceMinor: string;
  currency: string;
};
export default function Favorites() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [login, setLogin] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch(`${API}/favorites`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (response.status === 401) {
        setLogin(true);
        return;
      }
      if (!response.ok) throw new Error('Favorites unavailable');
      setLogin(false);
      setItems((await response.json()) as Item[]);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  if (login)
    return (
      <main className="shell py-10">
        <StatePanel
          tone="warning"
          title="Sevimlilar uchun kiring"
          description="Saqlangan mahsulotlar hisobingizga bog‘lanadi."
          action={
            <Link className="rs-button" href="/login">
              Kirish
            </Link>
          }
        />
      </main>
    );
  return (
    <main className="shell py-10 buyer-workspace collection-workspace">
      <p className="eyebrow">Shaxsiy ro‘yxat</p>
      <h1 className="mt-2 text-3xl font-black">Sevimlilar</h1>
      {loading && (
        <p role="status" className="mt-7">
          Mahsulotlar yuklanmoqda…
        </p>
      )}
      {error && (
        <div className="mt-7">
          <StatePanel
            tone="danger"
            title="Sevimlilarni yuklab bo‘lmadi"
            description="Aloqani tekshirib, qayta urinib ko‘ring"
            action={
              <button className="rs-button" onClick={() => void load()}>
                Qayta urinish
              </button>
            }
          />
        </div>
      )}
      {items?.length === 0 && (
        <div className="mt-7">
          <StatePanel
            title="Saqlangan mahsulot yo‘q"
            description="Yoqtirgan mahsulotingizdagi yurak tugmasini bosing."
            action={
              <Link className="rs-button" href="/marketplace">
                Mahsulotlarni ko‘rish
              </Link>
            }
          />
        </div>
      )}
      <section className="collection-grid mt-7 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {items?.map((item) => (
          <Link
            className="surface p-5"
            href={`/product/${item.publicId}`}
            key={item.publicId}
          >
            <h2 className="font-black">{item.nameUz}</h2>
            <p className="mt-3 font-bold">
              {Number(item.priceMinor).toLocaleString('uz-UZ')} {item.currency}
            </p>
          </Link>
        ))}
      </section>
    </main>
  );
}
