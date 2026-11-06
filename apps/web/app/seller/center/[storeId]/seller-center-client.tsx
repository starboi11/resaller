'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const tabs = ['Overview', 'Orders', 'Products', 'Inventory', 'Customers', 'Delivery', 'Finance', 'Analytics', 'Store Settings'] as const;
type Tab = typeof tabs[number];
type Order = { publicId: string; displayId?: string; kind: 'MARKETPLACE' | 'EXTERNAL'; resaleRole?: 'FULFIL' | 'RESALE' | null; source: string; status: string; totalMinor: string; paymentStatus: string; customerName: string; createdAt: string; items: { quantity: number; snapshot: unknown }[] };
type Stock = { variants: { id: string; sku: string; listing: { nameUz: string; status: string }; inventory: { available: number; reserved: number } | null }[]; movements: { id: string; type: string; availableDelta: number; reservedDelta: number; reason: string | null; createdAt: string }[]; lowStock: number };
type Customer = { publicId: string; name: string; phone: string | null; notes: string | null; tags: string[]; orderCount: number; totalSpentMinor: string; averageOrderValueMinor: string; lastOrderAt: string | null; repeatCustomer: boolean };
type Finance = { revenueMinor: string; marketplaceRevenueMinor: string; externalRevenueMinor: string; refundsMinor: string; netProfitEstimateExternalMinor: string; costOfGoodsKnownMinor: string; sellerDeliveryCostMinor: string; otherExpensesMinor: string; averageOrderValueMinor: string; orderCount: number; refundsRecorded: number; cancellationRatePercent: number; externalRefundRatePercent: number; repeatCustomers: number; topProducts: { name: string; quantity: number }[]; topExternalCategories: { name: string; quantity: number }[]; marketplaceProfitKnown: boolean; verifiedPaymentSettlement: boolean; bySource: Record<string, { orders: number; revenueMinor: string }>; byDay: { day: string; orders: number; revenueMinor: string }[]; expenses: { publicId: string; amountMinor: string; category: string; occurredAt: string }[]; truncated: boolean };
type Dashboard = { store: { publicId: string; nameUz: string }; todayRevenueMinor: string; todayOrderCount: number; todayProfitEstimateExternalMinor: string | null; newOrders: number; preparingOrders: number; deliveredOrders: number; lowStockAlerts: { id: string; sku: string; listing: { nameUz: string }; inventory: { available: number } | null }[]; recentOrders: Order[]; salesChart: Finance['byDay']; topSellingProduct: { name: string; quantity: number } | null; profitDisclosure: string };
type ExternalDetail = { publicId: string; status: string; paymentStatus: string; deliveryAddress: string | null; courierName: string | null; trackingNumber: string | null; customer: { name: string; phone: string | null } | null; history: { id: string; toStatus: string; createdAt: string; reason: string | null }[]; buyerProtection: false; verifiedMarketplacePurchase: false };
type Context = { revenueMinor: string; externalProfitEstimateMinor: string; lowStock: { name: string; sku: string; available: number }[]; bySource: Finance['bySource']; personalDataIncluded: false; actionAuthority: 'READ_ONLY' };
const nextStatus: Record<string, string[]> = { NEW: ['PENDING', 'CONFIRMED', 'CANCELLED'], PENDING: ['CONFIRMED', 'CANCELLED'], CONFIRMED: ['PREPARING', 'CANCELLED'], PREPARING: ['READY', 'CANCELLED'], READY: ['SHIPPED', 'DELIVERED', 'CANCELLED'], SHIPPED: ['DELIVERED'] };
const money = (value: string | number | null | undefined) => `${new Intl.NumberFormat('uz-UZ').format(Number(value ?? 0))} so‘m`;
const date = (value: string) => new Date(value).toLocaleString('uz-UZ');

export default function SellerCenterClient({ storeId }: { storeId: string }) {
  const root = `${API}/seller-center/stores/${encodeURIComponent(storeId)}`;
  const [tab, setTab] = useState<Tab>('Overview');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Set when the server says this account is not the owner of this store.
  const [denied, setDenied] = useState(false);
  const [message, setMessage] = useState('');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stock, setStock] = useState<Stock | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [finance, setFinance] = useState<Finance | null>(null);
  const [financePeriod, setFinancePeriod] = useState<1 | 7 | 30>(30);
  const [context, setContext] = useState<Context | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<ExternalDetail | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<{ publicId: string; source: string; status: string; totalMinor: string; createdAt: string }[]>([]);
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const [extraItems, setExtraItems] = useState<string[]>([]);

  const get = useCallback(async <T,>(path: string): Promise<T> => {
    const response = await fetch(`${root}/${path}`, { credentials: 'include', cache: 'no-store' });
    if (response.status === 403) setDenied(true);
    if (!response.ok) throw new Error(response.status === 403 ? 'Bu bo‘lim faqat do‘kon egasi uchun.' : response.status === 401 ? 'Avval akkauntga kiring.' : 'Ma’lumot yuklanmadi.');
    return response.json() as Promise<T>;
  }, [root]);
  const refresh = useCallback(async () => {
    setError('');
    try {
      if (tab === 'Overview') setDashboard(await get<Dashboard>('dashboard'));
      if (tab === 'Orders' || tab === 'Delivery') {
        setOrders(await get<Order[]>('orders'));
        setStock(await get<Stock>('inventory'));
      }
      if (tab === 'Inventory') setStock(await get<Stock>('inventory'));
      if (tab === 'Customers') setCustomers(await get<Customer[]>('customers'));
      if (tab === 'Finance' || tab === 'Analytics') setFinance(await get<Finance>(`finance?period=${financePeriod}`));
      if (tab === 'Analytics') setContext(await get<Context>('assistant-context'));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Server bilan aloqa yo‘q.'); }
  }, [financePeriod, get, tab]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function mutate(path: string, method: 'POST' | 'PATCH', payload: unknown) {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(`${root}/${path}`, { method, credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(body.message ?? 'O‘zgarish saqlanmadi.');
      setMessage('Saqlandi.'); await refresh();
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Server bilan aloqa yo‘q.'); return false; }
    finally { setBusy(false); }
  }

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await mutate('external-orders', 'POST', {
      source: data.get('source'), customerName: data.get('customerName'),
      customerPhone: data.get('customerPhone') || undefined,
      items: [{ variantId: data.get('variantId'), quantity: Number(data.get('quantity')),
        unitPriceMinor: String(data.get('unitPriceMinor')), unitCostMinor: String(data.get('unitCostMinor')) },
        ...extraItems.map((id) => ({ variantId: data.get(`variantId-${id}`), quantity: Number(data.get(`quantity-${id}`)),
          unitPriceMinor: String(data.get(`unitPriceMinor-${id}`)), unitCostMinor: String(data.get(`unitCostMinor-${id}`)) }))],
      discountMinor: String(data.get('discountMinor') || '0'), deliveryCostMinor: String(data.get('deliveryCostMinor') || '0'),
      deliveryAddress: data.get('deliveryAddress') || undefined, notes: data.get('notes') || undefined,
      idempotencyKey: requestKey,
    });
    if (result) { form.reset(); setExtraItems([]); setRequestKey(crypto.randomUUID()); }
  }

  async function openOrder(order: Order) {
    if (order.kind === 'MARKETPLACE') return;
    setError('');
    try { setSelectedOrder(await get<ExternalDetail>(`external-orders/${encodeURIComponent(order.publicId)}`)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Buyurtma yuklanmadi.'); }
  }

  async function openCustomer(customer: Customer) {
    setSelectedCustomer(customer);
    try { setCustomerOrders(await get<typeof customerOrders>(`customers/${encodeURIComponent(customer.publicId)}/orders`)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Mijoz buyurtmalari yuklanmadi.'); }
  }

  if (denied)
    return <main className="shell max-w-2xl py-14"><section className="surface p-8" role="alert"><h1 className="text-2xl font-black">Bu bo‘lim faqat do‘kon egasi uchun</h1><p className="muted mt-3">Resaller’da faqat do‘kon egasi sotadi. Xarid qilish uchun katalogga o‘ting.</p><Link className="rs-button mt-6 inline-flex" href="/marketplace">Mahsulotlarni ko‘rish</Link></section></main>;
  return <main className="shell py-10 seller-workspace">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div><p className="eyebrow">RESALLER · SELLER CENTER</p><h1 className="text-3xl font-black">{dashboard?.store.nameUz ?? 'SellerOS'}</h1>
        <p className="muted mt-1">Instagram va Telegram’da sotishda davom eting — barcha savdoni bir joyda boshqaring.</p></div>
      <div className="seller-resale-links">
        <Link className="rs-button rs-button--outline" href="/seller/manage">Do‘kon boshqaruviga qaytish</Link>
      </div>
    </div>
    <nav className="flex flex-wrap gap-2 border-b border-[var(--line)] pb-4" aria-label="Seller Center bo‘limlari">
      {tabs.map((item) => <button key={item} type="button" onClick={() => { setTab(item); setSelectedOrder(null); setMessage(''); }}
        aria-current={tab === item ? 'page' : undefined}
        className={`rounded-full border px-4 py-2 text-sm font-bold ${tab === item ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--line)]'}`}>{item}</button>)}
    </nav>
    {error && <div role="alert" className="mt-5 rounded-xl border border-red-500 p-4 text-red-300">{error} <button type="button" className="underline" onClick={() => void refresh()}>Qayta urinish</button></div>}
    {message && <p role="status" className="mt-4 text-emerald-300">{message}</p>}

    {tab === 'Overview' && <section className="mt-6 space-y-6">
      {!dashboard ? <p className="muted">Ko‘rsatkichlar yuklanmoqda…</p> : <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric title="Bugungi savdo" value={money(dashboard.todayRevenueMinor)} />
          <Metric title="Bugungi taxminiy tashqi foyda" value={dashboard.todayProfitEstimateExternalMinor === null ? 'Noma’lum' : money(dashboard.todayProfitEstimateExternalMinor)} />
          <Metric title="Bugungi buyurtmalar" value={dashboard.todayOrderCount} />
          <Metric title="Yangi buyurtmalar" value={dashboard.newOrders} />
          <Metric title="Kam qolgan variantlar" value={dashboard.lowStockAlerts.length} />
          <Metric title="Tayyorlanmoqda" value={dashboard.preparingOrders} />
          <Metric title="Bugun yakunlangan" value={dashboard.deliveredOrders} />
          <Metric title="Ko‘p sotilgan mahsulot" value={dashboard.topSellingProduct ? `${dashboard.topSellingProduct.name} · ${dashboard.topSellingProduct.quantity} ta` : 'Hali yo‘q'} />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="So‘nggi buyurtmalar">{dashboard.recentOrders.length ? dashboard.recentOrders.map((order) => <p key={`${order.kind}-${order.publicId}`} className="border-b border-[var(--line)] py-2 text-sm">{order.source} · {order.customerName} · {order.status} · {money(order.totalMinor)}</p>) : <Empty />}</Panel>
          <Panel title="Stock ogohlantirishlari">{dashboard.lowStockAlerts.length ? dashboard.lowStockAlerts.map((item) => <p key={item.id} className="border-b border-[var(--line)] py-2 text-sm">{item.listing.nameUz} / {item.sku} · {item.inventory?.available ?? 0} ta</p>) : <Empty />}</Panel>
        </div>
        <Panel title="Savdo dinamikasi"><SalesBars rows={dashboard.salesChart} /></Panel>
        <p className="muted text-sm">Foyda ko‘rsatkichi marketplace uchun hozir hisoblanmaydi: mahsulot tannarxi va real to‘lov tasdiqlanmagan. Finance bo‘limida tashqi savdoning taxminiy foydasi alohida ko‘rsatiladi.</p>
      </>}
    </section>}

    {tab === 'Orders' && <section className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
      <Panel title="Barcha savdolar"><p className="muted mb-4 text-sm">Resaller orderlari avtomatik; Instagram, Telegram va offline orderlarini qo‘lda kiriting. Tashqi order Resaller review/dispute himoyasiga ega emas.</p>
        {orders.length ? orders.map((order) => <article key={`${order.kind}-${order.publicId}`} className="mb-2 rounded-xl border border-[var(--line)] p-3">
          <div className="flex flex-wrap justify-between gap-2"><strong>{order.source} · {order.customerName}</strong><span>{money(order.totalMinor)}</span></div>
          <p className="muted text-sm">{date(order.createdAt)} · {order.status} · To‘lov: {order.paymentStatus === 'DEFERRED' ? 'MVPda kechiktirilgan' : `${order.paymentStatus} (seller qaydi)`}</p>
          {order.kind === 'EXTERNAL' ? <button type="button" className="mt-2 underline" onClick={() => void openOrder(order)}>Tafsilot va amallar</button> : <Link className="mt-2 inline-block underline" href={`/orders/${order.publicId}`}>Marketplace orderini ko‘rish</Link>}
        </article>) : <Empty />}
      </Panel>
      <Panel title="Tashqi order kiritish"><form onSubmit={createOrder} className="grid gap-3">
        <label>Manba<select className="field mt-1" name="source"><option value="INSTAGRAM">Instagram</option><option value="TELEGRAM">Telegram</option><option value="OFFLINE">Offline</option><option value="OTHER">Boshqa</option></select></label>
        <label>Customer ismi<input className="field mt-1" name="customerName" maxLength={100} required /></label>
        <label>Telefon (+998)<input className="field mt-1" name="customerPhone" type="tel" pattern="\+998[0-9]{9}" placeholder="+998901234567" /></label>
        <label>Variant<select className="field mt-1" name="variantId" required><option value="">Tanlang</option>{stock?.variants.map((item) => <option key={item.id} value={item.id}>{item.listing.nameUz} · {item.sku} · {item.inventory?.available ?? 0} ta</option>)}</select></label>
        <div className="grid grid-cols-2 gap-3"><label>Soni<input className="field mt-1" name="quantity" type="number" min="1" max="10000" defaultValue="1" required /></label><label>Narx (so‘m)<input className="field mt-1" name="unitPriceMinor" type="number" min="0" defaultValue="0" required /></label></div>
        <div className="grid grid-cols-2 gap-3"><label>Tannarx (so‘m)<input className="field mt-1" name="unitCostMinor" type="number" min="0" defaultValue="0" required /></label><label>Chegirma<input className="field mt-1" name="discountMinor" type="number" min="0" defaultValue="0" required /></label></div>
        {extraItems.map((id, index) => <div key={id} className="grid gap-3 rounded-xl border border-[var(--line)] p-3">
          <div className="flex justify-between"><strong>Yana mahsulot {index + 2}</strong><button type="button" className="underline" onClick={() => setExtraItems((items) => items.filter((item) => item !== id))}>Olib tashlash</button></div>
          <select className="field" name={`variantId-${id}`} required><option value="">Variantni tanlang</option>{stock?.variants.map((item) => <option key={item.id} value={item.id}>{item.listing.nameUz} · {item.sku} · {item.inventory?.available ?? 0} ta</option>)}</select>
          <div className="grid grid-cols-3 gap-2"><label>Soni<input className="field mt-1" name={`quantity-${id}`} type="number" min="1" max="10000" defaultValue="1" required /></label><label>Narx<input className="field mt-1" name={`unitPriceMinor-${id}`} type="number" min="0" defaultValue="0" required /></label><label>Tannarx<input className="field mt-1" name={`unitCostMinor-${id}`} type="number" min="0" defaultValue="0" required /></label></div>
        </div>)}
        <button type="button" className="underline text-left" disabled={extraItems.length >= 29} onClick={() => setExtraItems((items) => [...items, crypto.randomUUID()])}>+ Mahsulot qo‘shish</button>
        <label>Seller to‘laydigan delivery xarajati<input className="field mt-1" name="deliveryCostMinor" type="number" min="0" defaultValue="0" required /></label>
        <label>Yetkazish manzili<input className="field mt-1" name="deliveryAddress" maxLength={300} /></label>
        <label>Izoh<textarea className="field mt-1" name="notes" maxLength={1000} /></label>
        <button className="rs-button" disabled={busy || !stock?.variants.length}>Orderni saqlash va stockni band qilish</button>
      </form></Panel>
      {selectedOrder && <Panel title={`Tashqi order · ${selectedOrder.publicId}`}>
        <p>{selectedOrder.customer?.name} · {selectedOrder.customer?.phone ?? 'Telefon yo‘q'}</p>
        <p className="muted text-sm">{selectedOrder.status} · {selectedOrder.paymentStatus} seller qaydi · Resaller buyer protection/review yo‘q</p>
        <div className="mt-3 flex flex-wrap gap-2">{(nextStatus[selectedOrder.status] ?? []).map((status) => <button type="button" key={status} className="rounded-full border border-[var(--line)] px-3 py-2 text-sm" disabled={busy} onClick={async () => { if (await mutate(`external-orders/${selectedOrder.publicId}/transition`, 'POST', { status })) setSelectedOrder(await get<ExternalDetail>(`external-orders/${selectedOrder.publicId}`)); }}>{status}</button>)}</div>
        <form key={`${selectedOrder.publicId}-${selectedOrder.paymentStatus}`} className="mt-4 grid gap-2" onSubmit={async (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); if (await mutate(`external-orders/${selectedOrder.publicId}/payment-record`, 'PATCH', { status: data.get('status'), reason: data.get('reason') })) setSelectedOrder(await get<ExternalDetail>(`external-orders/${selectedOrder.publicId}`)); }}>
          <label>Seller qayd qilgan to‘lov holati<select className="field mt-1" name="status" defaultValue={selectedOrder.paymentStatus}><option value="UNPAID">To‘lanmagan</option><option value="PARTIAL">Qisman</option><option value="PAID">To‘langan</option><option value="REFUNDED">Qaytarilgan</option></select></label>
          <input className="field" name="reason" minLength={5} maxLength={500} placeholder="O‘zgartirish sababi" required />
          <button className="rs-button" disabled={busy}>To‘lov qaydini yangilash</button>
          <p className="muted text-xs">Bu sellerning ichki qaydi; Resaller to‘lovni yoki settlementni tasdiqlamaydi.</p>
        </form>
        <p className="muted mt-4 text-sm">Status tarixi</p>{selectedOrder.history.map((item) => <p key={item.id} className="text-sm">{date(item.createdAt)} · {item.toStatus}{item.reason ? ` · ${item.reason}` : ''}</p>)}
      </Panel>}
    </section>}

    {tab === 'Products' && <section className="mt-6"><Panel title="Mahsulotlar"><p className="muted mb-4">Mahsulot, media, variant va katalog boshqaruvi mavjud seller workspace orqali ishlaydi.</p><Link className="rs-button" href="/seller/manage#products">Mahsulotlarga o‘tish</Link></Panel></section>}

    {tab === 'Inventory' && <section className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <Panel title="Umumiy stock"><p className="muted mb-3 text-sm">Resaller va tashqi orderlar bir xil variant stockini ishlatadi. Bandlangan son alohida ko‘rsatiladi.</p>
        {stock?.variants.length ? stock.variants.map((item) => <p key={item.id} className="border-b border-[var(--line)] py-2 text-sm">{item.listing.nameUz} · {item.sku} <strong className="float-right">Mavjud {item.inventory?.available ?? 0} / band {item.inventory?.reserved ?? 0}</strong></p>) : <Empty />}</Panel>
      <div className="space-y-5"><Panel title="Stockni qo‘lda tuzatish"><form className="grid gap-3" onSubmit={async (event) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); if (await mutate('inventory/adjust', 'POST', { variantId: data.get('variantId'), delta: Number(data.get('delta')), reason: data.get('reason') })) form.reset(); }}>
        <select className="field" name="variantId" required><option value="">Variantni tanlang</option>{stock?.variants.map((item) => <option key={item.id} value={item.id}>{item.listing.nameUz} / {item.sku}</option>)}</select>
        <input className="field" name="delta" type="number" placeholder="+5 yoki -2" required /><input className="field" name="reason" minLength={5} maxLength={500} placeholder="Sabab" required />
        <button className="rs-button" disabled={busy}>O‘zgarishni qayd qilish</button></form></Panel>
        <Panel title="Stock harakati">{stock?.movements.length ? stock.movements.map((move) => <p key={move.id} className="border-b border-[var(--line)] py-2 text-sm">{date(move.createdAt)} · {move.type} · mavjud {move.availableDelta > 0 ? '+' : ''}{move.availableDelta} · band {move.reservedDelta > 0 ? '+' : ''}{move.reservedDelta}</p>) : <Empty />}</Panel>
      </div>
    </section>}

    {tab === 'Customers' && <section className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]"><Panel title="Mijozlar"><p className="muted mb-3 text-sm">Tashqi order contactlari faqat shu do‘konga tegishli. Marketplace buyer telefoni CRMga avtomatik ko‘chirilmaydi.</p>
      {customers.length ? customers.map((customer) => <button key={customer.publicId} type="button" onClick={() => void openCustomer(customer)} className="block w-full border-b border-[var(--line)] py-3 text-left"><strong>{customer.name}</strong> · {customer.phone ?? 'Telefon yo‘q'}<span className="muted block text-sm">{customer.orderCount} yakunlangan order · {money(customer.totalSpentMinor)} · {customer.repeatCustomer ? 'Takroriy mijoz' : 'Yangi mijoz'}</span></button>) : <Empty />}</Panel>
      {selectedCustomer && <Panel title={selectedCustomer.name}><p className="muted mb-3 text-sm">So‘nggi order: {selectedCustomer.lastOrderAt ? date(selectedCustomer.lastOrderAt) : 'hali yo‘q'} · O‘rtacha: {money(selectedCustomer.averageOrderValueMinor)}</p>
        <form key={selectedCustomer.publicId} className="grid gap-3" onSubmit={async (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); if (await mutate(`customers/${selectedCustomer.publicId}`, 'PATCH', { notes: data.get('notes'), tags: String(data.get('tags') ?? '').split(',').map((tag) => tag.trim()).filter(Boolean) })) setCustomers(await get<Customer[]>('customers')); }}>
          <label>Qaydlar<textarea className="field mt-1" name="notes" defaultValue={selectedCustomer.notes ?? ''} maxLength={2000} /></label><label>Taglar (vergul bilan)<input className="field mt-1" name="tags" defaultValue={selectedCustomer.tags.join(', ')} /></label><button className="rs-button" disabled={busy}>CRMni saqlash</button></form>
        <h3 className="mt-5 font-bold">Buyurtmalar tarixi</h3>{customerOrders.length ? customerOrders.map((order) => <p key={order.publicId} className="border-b border-[var(--line)] py-2 text-sm">{date(order.createdAt)} · {order.source} · {order.status} · {money(order.totalMinor)}</p>) : <Empty />}</Panel>}
    </section>}

    {tab === 'Delivery' && <section className="mt-6 grid gap-6 lg:grid-cols-2"><Panel title="Yetkazish jarayoni"><p className="muted mb-3 text-sm">Marketplace delivery o‘z order workspace’ida; tashqi order courier ma’lumoti shu yerda.</p>
      {orders.filter((item) => item.kind === 'EXTERNAL').map((item) => <button key={item.publicId} type="button" onClick={() => void openOrder(item)} className="block w-full border-b border-[var(--line)] py-3 text-left">{item.customerName} · {item.source} · {item.status}</button>)}</Panel>
      {selectedOrder && <Panel title="Courier va tracking"><p className="muted mb-3 text-sm">{selectedOrder.customer?.name} · {selectedOrder.status}</p><form key={selectedOrder.publicId} className="grid gap-3" onSubmit={async (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); if (await mutate(`external-orders/${selectedOrder.publicId}/delivery`, 'PATCH', { deliveryAddress: data.get('deliveryAddress'), courierName: data.get('courierName'), trackingNumber: data.get('trackingNumber') })) setSelectedOrder(await get<ExternalDetail>(`external-orders/${selectedOrder.publicId}`)); }}>
        <input className="field" name="deliveryAddress" defaultValue={selectedOrder.deliveryAddress ?? ''} placeholder="Yetkazish manzili" maxLength={300} /><input className="field" name="courierName" defaultValue={selectedOrder.courierName ?? ''} placeholder="Courier" maxLength={100} /><input className="field" name="trackingNumber" defaultValue={selectedOrder.trackingNumber ?? ''} placeholder="Tracking raqam" maxLength={100} /><button className="rs-button" disabled={busy}>Yetkazishni saqlash</button></form></Panel>}
    </section>}

    {tab === 'Finance' && <section className="mt-6 space-y-5"><p className="muted">Bu sellerning ichki hisoboti. Marketplace revenue to‘lov kelib tushganini anglatmaydi; settlement MVPda yo‘q.</p>
      <div className="flex flex-wrap gap-2" aria-label="Hisobot davri">{([1, 7, 30] as const).map((days) => <button key={days} type="button" aria-pressed={financePeriod === days} className={`rounded-full border px-4 py-2 ${financePeriod === days ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--line)]'}`} onClick={() => setFinancePeriod(days)}>{days === 1 ? 'Bugun' : days === 7 ? '7 kun' : '30 kun'}</button>)}</div>
      {finance && <><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric title={`${financePeriod} kunlik qayd qilingan savdo`} value={money(finance.revenueMinor)} /><Metric title="Resaller orderlari" value={money(finance.marketplaceRevenueMinor)} /><Metric title="Tashqi orderlar" value={money(finance.externalRevenueMinor)} /><Metric title="Tashqi taxminiy sof foyda" value={money(finance.netProfitEstimateExternalMinor)} /></div>
        <div className="grid gap-5 lg:grid-cols-2"><Panel title="Xarajatlar"><p>Tashqi mahsulot tannarxi: {money(finance.costOfGoodsKnownMinor)}</p><p>Delivery xarajati: {money(finance.sellerDeliveryCostMinor)}</p><p>Qaytarilgan to‘lovlar: {money(finance.refundsMinor)}</p><p>Boshqa xarajatlar: {money(finance.otherExpensesMinor)}</p><p className="muted mt-3 text-sm">Refund savdo daromadini kamaytiradi. Yetkazilgan buyurtmaning tannarxi va courier xarajati fizik qaytish/restock alohida qayd qilinmaguncha xarajat bo‘lib qoladi. Marketplace foydasi noma’lum.</p>{finance.truncated && <p className="text-red-300">Natija 5000 yozuv limitida qisqartirilgan.</p>}</Panel>
          <Panel title="Xarajat qo‘shish"><form className="grid gap-3" onSubmit={async (event) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); if (await mutate('expenses', 'POST', { amountMinor: String(data.get('amountMinor')), category: data.get('category'), note: data.get('note') || undefined, occurredOn: data.get('occurredOn') || undefined })) form.reset(); }}>
            <input className="field" name="amountMinor" type="number" min="1" placeholder="Summa (so‘m)" required /><select className="field" name="category"><option value="RENT">Ijara</option><option value="MARKETING">Marketing</option><option value="SALARY">Ish haqi</option><option value="PACKAGING">Qadoqlash</option><option value="OTHER">Boshqa</option></select><input className="field" name="occurredOn" type="date" /><input className="field" name="note" maxLength={500} placeholder="Izoh" /><button className="rs-button" disabled={busy}>Xarajatni qayd qilish</button></form></Panel></div></>}
    </section>}

    {tab === 'Analytics' && <section className="mt-6 grid gap-5 lg:grid-cols-2"><div className="flex flex-wrap gap-2 lg:col-span-2" aria-label="Analytics davri">{([1, 7, 30] as const).map((days) => <button key={days} type="button" aria-pressed={financePeriod === days} className={`rounded-full border px-4 py-2 ${financePeriod === days ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--line)]'}`} onClick={() => setFinancePeriod(days)}>{days === 1 ? 'Bugun' : days === 7 ? '7 kun' : '30 kun'}</button>)}</div><Panel title="Manbalar bo‘yicha savdo">{finance && Object.entries(finance.bySource).map(([source, values]) => <p key={source} className="border-b border-[var(--line)] py-2">{source}: {values.orders} order · {money(values.revenueMinor)}</p>)}</Panel>
      <Panel title={financePeriod === 1 ? 'Bugun' : `So‘nggi ${financePeriod} kun`}><SalesBars rows={finance?.byDay ?? []} /><p className="muted mt-3 text-sm">O‘rtacha order: {money(finance?.averageOrderValueMinor)} · Qaytarilgan tashqi to‘lovlar: {finance?.refundsRecorded ?? 0}</p></Panel>
      <Panel title="Mijoz va savdo sifati"><p>Takroriy tashqi mijozlar: {finance?.repeatCustomers ?? 0}</p><p>Bekor qilish ulushi: {finance?.cancellationRatePercent ?? 0}%</p><p>Tashqi qaytarilgan to‘lov ulushi: {finance?.externalRefundRatePercent ?? 0}%</p><p className="muted mt-3 text-sm">To‘lov statusi seller qaydi, gateway tasdig‘i emas.</p></Panel>
      <Panel title="Ko‘p sotilgan mahsulotlar">{finance?.topProducts.length ? finance.topProducts.map((product) => <p key={product.name} className="border-b border-[var(--line)] py-2">{product.name} · {product.quantity} ta</p>) : <Empty />}{finance?.topExternalCategories.length ? <p className="muted mt-3 text-xs">Kategoriyalar: {finance.topExternalCategories.map((item) => `${item.name} (${item.quantity})`).join(', ')}.</p> : null}</Panel>
      <Panel title="AI yordamchiga tayyor xavfsiz kontekst"><p className="muted text-sm">Hozir tashqi pullik AI ulanmagan. Quyidagi ma’lumotlar ruxsat tekshiruvidan o‘tib, mijoz telefoni/manzilisiz faqat o‘qish uchun beriladi.</p>{context && <><p className="mt-3">7 kunlik savdo: {money(context.revenueMinor)}</p><p>Tashqi taxminiy foyda: {money(context.externalProfitEstimateMinor)}</p><p>Kam qolganlar: {context.lowStock.map((item) => `${item.name} (${item.available})`).join(', ') || 'Yo‘q'}</p></>}</Panel>
    </section>}

    {tab === 'Store Settings' && <section className="mt-6"><Panel title="Do‘kon sozlamalari"><p className="muted mb-4">Ish vaqti, vacation, siyosatlar va storefront mavjud do‘kon boshqaruvida.</p><Link className="rs-button" href="/seller/manage#settings">Sozlamalarga o‘tish</Link></Panel></section>}
  </main>;
}

function Metric({ title, value }: { title: string; value: string | number }) { return <div className="surface p-5"><p className="muted text-sm">{title}</p><strong className="mt-2 block text-xl">{value}</strong></div>; }
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <div className="surface p-5"><h2 className="mb-4 text-xl font-black">{title}</h2>{children}</div>; }
function Empty() { return <p className="muted text-sm">Hozircha ma’lumot yo‘q.</p>; }
function SalesBars({ rows }: { rows: Finance['byDay'] }) { const max = Math.max(...rows.map((row) => Number(row.revenueMinor)), 1); return rows.length ? <div className="space-y-2">{rows.slice(-14).map((row) => <div key={row.day} className="grid grid-cols-[5rem_1fr_7rem] items-center gap-2 text-xs"><span>{row.day.slice(5)}</span><div className="h-2 overflow-hidden rounded-full bg-black/30"><div className="h-full rounded-full bg-red-500" style={{ width: `${Math.max(2, Number(row.revenueMinor) / max * 100)}%` }} /></div><span className="text-right">{money(row.revenueMinor)}</span></div>)}</div> : <Empty />; }
