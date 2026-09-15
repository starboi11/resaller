import Link from 'next/link';

export default async function CheckoutSuccess({ searchParams }: { searchParams: Promise<{ checkout?: string; orders?: string }> }) {
  const query = await searchParams;
  const orders = (query.orders ?? '').split(',').filter(Boolean);
  return <main className="shell max-w-3xl py-14"><section className="surface checkout-success p-8 text-center"><span className="checkout-success__mark" aria-hidden="true">✓</span><p className="eyebrow mt-5">Buyurtma qabul qilindi</p><h1 className="mt-2 text-3xl font-black">Hammasi tayyor</h1><p className="muted mx-auto mt-3 max-w-xl">Har bir sotuvchi buyurtmani 60 daqiqa ichida tasdiqlaydi. Holat o‘zgarsa buyurtma sahifasida ko‘rasiz.</p>{query.checkout&&<p className="muted mt-3 text-xs">Checkout: {query.checkout}</p>}<div className="mt-7 flex flex-wrap justify-center gap-3">{orders.map((id,index)=><Link className="rs-button" href={`/orders/${id}`} key={id}>{orders.length>1?`${index+1}-buyurtma`:'Buyurtmani kuzatish'}</Link>)}<Link className="rounded-full border border-[var(--line)] px-5 py-3 font-bold" href="/marketplace">Xaridni davom ettirish</Link></div></section></main>;
}
