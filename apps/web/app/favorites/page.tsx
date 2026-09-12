'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
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
  useEffect(() => {
    void fetch(`${API}/favorites`, {
      credentials: 'include',
      cache: 'no-store',
    }).then(async (response) => {
      if (response.status === 401) {
        setLogin(true);
        return;
      }
      if (response.ok) setItems((await response.json()) as Item[]);
    });
  }, []);
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
    <main className="shell py-10">
      <p className="eyebrow">Shaxsiy ro‘yxat</p>
      <h1 className="mt-2 text-3xl font-black">Sevimlilar</h1>
      {items?.length === 0 && (
        <div className="mt-7">
          <StatePanel
            title="Saqlangan mahsulot yo‘q"
            description="Yoqtirgan mahsulotingizdagi yurak tugmasini bosing."
            action={
              <Link className="rs-button" href="/marketplace">
                Marketplace
              </Link>
            }
          />
        </div>
      )}
      <section className="mt-7 grid grid-cols-2 gap-4 lg:grid-cols-3">
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
