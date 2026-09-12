'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { StatePanel } from '@resaller/ui';
type Item = {
  publicId: string;
  nameUz: string;
  priceMinor: string;
  currency: string;
};
export default function Recent() {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    try {
      setItems(
        JSON.parse(localStorage.getItem('resaller-recent') ?? '[]') as Item[],
      );
    } catch {}
  }, []);
  return (
    <main className="shell py-10 buyer-workspace collection-workspace">
      <p className="eyebrow">Qayta topish oson</p>
      <h1 className="mt-2 text-3xl font-black">Yaqinda ko‘rilganlar</h1>
      {items.length === 0 && (
        <div className="mt-7">
          <StatePanel
            title="Tarix hozircha bo‘sh"
            description="Ko‘rgan mahsulotlaringiz shu qurilmada saqlanadi."
            action={
              <Link className="rs-button" href="/marketplace">
                Mahsulot ko‘rish
              </Link>
            }
          />
        </div>
      )}
      <section className="collection-grid mt-7 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {items.map((item) => (
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
