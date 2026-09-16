'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AddToCart } from './add-to-cart';

type Variant = {
  id: string;
  sku: string;
  options: Record<string, string>;
  priceOverrideMinor?: string | null;
  inventory: { available: number } | null;
};

const formatMoney = (value: string) =>
  String(Math.trunc(Number(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export function PurchasePanel({
  listingPublicId,
  basePriceMinor,
  currency,
  variants,
  restricted,
}: {
  listingPublicId: string;
  basePriceMinor: string;
  currency: string;
  variants: Variant[];
  restricted?: boolean;
}) {
  const initial =
    variants.find((item) => (item.inventory?.available ?? 0) > 0)?.id ??
    variants[0]?.id ??
    '';
  const [selectedId, setSelectedId] = useState(initial);
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const selected = useMemo(
    () => variants.find((item) => item.id === selectedId),
    [variants, selectedId],
  );
  const stock = selected?.inventory?.available ?? 0;
  const price = selected?.priceOverrideMinor ?? basePriceMinor;
  return (
    <div className="purchase-panel">
      <p className="text-2xl font-black">
        {formatMoney(price)} {currency === 'UZS' ? 'so‘m' : currency}
      </p>
      {variants.length > 1 && (
        <fieldset className="mt-5">
          <legend className="text-sm font-black">Variantni tanlang</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {variants.map((variant) => {
              const available = (variant.inventory?.available ?? 0) > 0;
              return (
                <button
                  type="button"
                  key={variant.id}
                  className={`variant-choice ${selectedId === variant.id ? 'is-active' : ''}`}
                  disabled={!available}
                  aria-pressed={selectedId === variant.id}
                  onClick={() => {
                    setSelectedId(variant.id);
                    const next = new URLSearchParams(search.toString());
                    next.set('variant', variant.id);
                    router.replace(`${pathname}?${next}`, { scroll: false });
                  }}
                >
                  {Object.values(variant.options).join(' / ') || variant.sku}
                  {!available && ' · tugagan'}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
      <p
        className={`mt-3 text-sm font-bold ${stock ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}
      >
        {restricted
          ? 'Mahsulot sotuvga cheklangan'
          : stock
            ? `Tanlangan variant: omborda ${stock} dona`
            : 'Tanlangan variant tugagan'}
      </p>
      <div className="mt-5">
        <AddToCart
          listingPublicId={listingPublicId}
          variantId={selectedId}
          disabled={restricted || !selected || stock === 0}
        />
      </div>
    </div>
  );
}
