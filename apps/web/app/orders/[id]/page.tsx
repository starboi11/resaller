'use client';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { StatePanel } from '@resaller/ui';
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
type Order = {
  publicId: string;
  displayId: string;
  status: string;
  totalMinor: string;
  currency: string;
  createdAt: string;
  sellerAcceptBy: string;
  viewerId: string;
  viewerRole: 'BUYER' | 'SELLER';
  snapshot?: Record<string, unknown>;
  changes?: { id: string; kind: string; before?: unknown; after?: unknown; createdAt: string }[];
  policySnapshots?: { id: string; policyType: string; version: number; content: unknown }[];
  review?: { id: string; rating: number } | null;
  dispute?: { id: string; status: string; events?: { id: string; type: string; createdAt: string }[]; decision?: { outcome: string; reason: string } | null } | null;
  store: { nameUz: string; username: string };
  items: {
    id: string;
    quantity: number;
    unitPriceMinor: string;
    snapshot: Record<string, unknown>;
  }[];
  history: {
    id: string;
    toStatus: string;
    reason?: string;
    createdAt: string;
  }[];
};
type Message = {
  id: string;
  senderId: string;
  body?: string;
  kind?: string;
  attachment?: { latitude?: number; longitude?: number } | null;
  createdAt: string;
  attachments?: { id: string; fileName: string }[];
};
export default function OrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [id, setId] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState('');
  const [connection, setConnection] = useState<'connecting'|'live'|'offline'>('connecting');
  const [uploadState, setUploadState] = useState('');
  const [unread, setUnread] = useState(0);
  const [retryUpload, setRetryUpload] = useState<{ messageId: string; file: File } | null>(null);
  const [actionMode, setActionMode] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    void params.then((value) => setId(value.id));
  }, [params]);
  const load = useCallback(async () => {
    if (!id) return;
    const [a, b] = await Promise.all([
      fetch(`${API}/orders/${id}`, {
        credentials: 'include',
        cache: 'no-store',
      }),
      fetch(`${API}/orders/${id}/messages`, {
        credentials: 'include',
        cache: 'no-store',
      }),
    ]);
    if (a.ok) setOrder((await a.json()) as Order);
    else
      setError(
        a.status === 401
          ? 'Hisobga kirish kerak.'
          : 'Buyurtma topilmadi yoki ruxsat yo‘q.',
      );
    if (b.ok) setMessages((await b.json()) as Message[]);
  }, [id]);
  useEffect(() => {
    void load();
    if (!id) return;
    const stream = new EventSource(`${API}/orders/${id}/messages/stream`, {
      withCredentials: true,
    });
    stream.onopen = () => setConnection('live');
    stream.onerror = () => setConnection(stream.readyState === EventSource.CONNECTING ? 'connecting' : 'offline');
    stream.addEventListener('messages', (event) => {
      try {
        const next = JSON.parse((event as MessageEvent).data) as Message[];
        setMessages((current) => { const known=new Set(current.map(item=>item.id)); const incoming=next.filter(item=>!known.has(item.id)&&item.senderId!==order?.viewerId).length; if(incoming&&document.hidden)setUnread(value=>value+incoming); return next; });
      } catch {}
    });
    const fallback = setInterval(() => {
      if (stream.readyState === EventSource.CLOSED) void load();
    }, 5_000);
    return () => {
      stream.close();
      clearInterval(fallback);
    };
  }, [load, order?.viewerId]);
  useEffect(() => { const read=()=>{if(document.visibilityState==='visible'&&id){setUnread(0);void fetch(`${API}/orders/${id}/messages/read`,{method:'POST',credentials:'include'});}}; document.addEventListener('visibilitychange',read); window.addEventListener('focus',read); return()=>{document.removeEventListener('visibilitychange',read);window.removeEventListener('focus',read);}; },[id]);
  async function uploadAttachment(messageId: string, file: File) {
    setUploadState('Fayl yuklanmoqda…');
    const upload=new FormData();upload.set('file',file);
    const uploaded=await new Promise<boolean>((resolve)=>{const request=new XMLHttpRequest();request.open('POST',`${API}/media/messages/${messageId}/attachment`);request.withCredentials=true;request.upload.onprogress=(progress)=>{if(progress.lengthComputable)setUploadState(`Fayl yuklanmoqda: ${Math.round(progress.loaded/progress.total*100)}%`);};request.onload=()=>resolve(request.status>=200&&request.status<300);request.onerror=()=>resolve(false);request.send(upload);});
    if(!uploaded){setRetryUpload({messageId,file});setUploadState('Fayl yuklanmadi. Qayta urinish mumkin.');return false;} setRetryUpload(null);setUploadState('Fayl yuklandi ✓');return true;
  }
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = String(data.get('body') ?? '').trim();
    if (!body) return;
    const response = await fetch(`${API}/orders/${id}/messages`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    if (response.ok) {
      const created = (await response.json()) as { id: string };
      const file = data.get('file');
      if (file instanceof File && file.size > 0) {
        if (!await uploadAttachment(created.id, file)) return;
      }
      form.reset();
      await load();
    }
  }
  function sendLocation() {
    if(!navigator.geolocation)return setUploadState('Qurilmada joylashuv mavjud emas.');
    setUploadState('Joylashuv olinmoqda…');
    navigator.geolocation.getCurrentPosition(async(position)=>{const response=await fetch(`${API}/orders/${id}/messages/location`,{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({latitude:position.coords.latitude,longitude:position.coords.longitude,label:'Yetkazish joyi'})});setUploadState(response.ok?'Joylashuv yuborildi ✓':'Joylashuv yuborilmadi.');if(response.ok)await load();},()=>setUploadState('Joylashuvga ruxsat berilmadi.'),{enableHighAccuracy:false,timeout:10000});
  }
  async function action(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!actionMode) return;
    const reason = String(new FormData(event.currentTarget).get('reason') ?? '').trim();
    if (!reason || reason.trim().length < 3) return;
    const directCancel = actionMode === 'cancel' && order?.status === 'WAITING_SELLER';
    const path = directCancel ? 'transition' : actionMode === 'cancel' ? 'cancellation-request' : actionMode === 'return' ? 'return-request' : actionMode === 'change' ? 'change-request' : 'dispute';
    const response = await fetch(`${API}/orders/${id}/${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(directCancel ? { to: 'CANCELLED', reason } : actionMode === 'change' ? { request: reason } : { reason }),
    });
    if (response.ok) { setActionMode(null); await load(); }
    else setError('Amalni bajarib bo‘lmadi.');
  }
  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const rating = Number(data.get('rating'));
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return;
    const body = String(data.get('body') ?? '').trim() || undefined;
    const response = await fetch(`${API}/orders/${id}/review`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rating, body }),
    });
    if (response.ok) await load();
    else setError('Sharh faqat yakunlangan buyurtmaga bir marta yoziladi.');
  }
  async function sellerTransition(to: string) {
    const response = await fetch(`${API}/orders/${id}/transition`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to }) });
    if (response.ok) await load(); else setError('Bu holatga o‘tishga ruxsat yo‘q.');
  }
  async function decideCancellation(approved: boolean) {
    const response = await fetch(`${API}/orders/${id}/cancellation-decision`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ approved, reason: approved ? 'Seller approved buyer request' : 'Seller rejected buyer request' }) });
    if (response.ok) await load(); else setError('Bekor qilish so‘roviga qaror saqlanmadi.');
  }
  async function decideChange(changeId: string, approved: boolean) { const response=await fetch(`${API}/orders/${id}/change-request/${changeId}/decision`,{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({approved})});if(response.ok)await load();else setError('O‘zgarish so‘roviga qaror saqlanmadi.'); }
  async function decideReturn(approved:boolean){const response=await fetch(`${API}/orders/${id}/return-decision`,{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({approved})});if(response.ok)await load();else setError('Qaytarish qarori saqlanmadi.');}
  async function uploadEvidence(file:File){if(!order?.dispute)return;setUploadState('Dalil yuklanmoqda…');const data=new FormData();data.set('file',file);const response=await fetch(`${API}/media/disputes/${order.dispute.id}/evidence`,{method:'POST',credentials:'include',body:data});setUploadState(response.ok?'Dalil xavfsiz saqlandi ✓':'Dalil yuklanmadi. Qayta urinib ko‘ring.');if(response.ok)await load();}
  if (error && !order)
    return (
      <main className="shell max-w-3xl py-10">
        <StatePanel
          tone="warning"
          title={error}
          description="Buyurtma egasi yoki tegishli sotuvchi hisobidan kiring."
          action={
            <Link className="rs-button" href="/login">
              Kirish
            </Link>
          }
        />
      </main>
    );
  if (!order)
    return (
      <main className="shell py-10" aria-busy="true">
        <p className="muted">Buyurtma yuklanmoqda…</p>
      </main>
    );
  const remaining = Math.max(0, new Date(order.sellerAcceptBy).getTime() - now);
  const canCancel = ['WAITING_SELLER','ACCEPTED','PREPARING','READY'].includes(order.status) && order.viewerRole === 'BUYER';
  const canReturn = ['DELIVERED','COMPLETED'].includes(order.status) && order.viewerRole === 'BUYER';
  const canDispute = !['CANCELLED','REJECTED','TIMEOUT'].includes(order.status);
  const sellerNext: Record<string, string> = { WAITING_SELLER: 'ACCEPTED', ACCEPTED: 'PREPARING', PREPARING: 'READY', READY: 'SHIPPED', SHIPPED: 'DELIVERED', DELIVERED: 'COMPLETED' };
  const pendingCancellation = order.changes?.find((item) => item.kind === 'CANCELLATION_REQUEST' && typeof item.after === 'object' && item.after !== null && (item.after as { status?: string }).status === 'PENDING');
  return (
    <main className="shell py-10 buyer-workspace order-detail-workspace">
      <Link className="muted text-sm" href="/orders">
        ← Buyurtmalar
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{order.store.nameUz}</p>
          <h1 className="mt-2 text-3xl font-black">{order.displayId}</h1>
          <p className="muted mt-2 text-sm">
            @{order.store.username} ·{' '}
            {new Date(order.createdAt).toLocaleString('uz-UZ')}
          </p>
        </div>
        <span className="rounded-full bg-[var(--brand-soft)] px-4 py-2 font-black text-[var(--brand-strong)]">
          {order.status}
        </span>
      </div>
      {order.status === 'WAITING_SELLER' && <div className="acceptance-clock mt-5" role="timer"><b>Sotuvchi tasdig‘i uchun qolgan vaqt</b><strong>{String(Math.floor(remaining / 60000)).padStart(2,'0')}:{String(Math.floor((remaining % 60000) / 1000)).padStart(2,'0')}</strong><small>60 daqiqada javob bo‘lmasa buyurtma avtomatik yopiladi.</small></div>}
      {error && (
        <p className="mt-4 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
      <div className="mt-8 grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
        <div className="grid content-start gap-6">
          <section className="surface order-summary p-5">
            <h2 className="text-lg font-black">Mahsulotlar</h2>
            <div className="mt-4 grid gap-3">
              {order.items.map((item) => (
                <div
                  className="flex justify-between gap-3 border-b border-[var(--line)] pb-3"
                  key={item.id}
                >
                  <span>
                    {String(
                      item.snapshot.nameUz ?? item.snapshot.name ?? 'Mahsulot',
                    )}{' '}
                    × {item.quantity}
                  </span>
                  <b>{Number(item.unitPriceMinor).toLocaleString('uz-UZ')}</b>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between">
              <strong>Jami</strong>
              <strong>
                {Number(order.totalMinor).toLocaleString('uz-UZ')}{' '}
                {order.currency}
              </strong>
            </div>
          </section>
          <section className="surface order-timeline p-5">
            <h2 className="text-lg font-black">Holat tarixi</h2>
            <ol className="mt-4 grid gap-4">
              {order.history.map((item) => (
                <li className="border-l-2 border-emerald-400 pl-4" key={item.id}>
                  <b>{item.toStatus}</b>
                  <p className="muted text-xs">
                    {new Date(item.createdAt).toLocaleString('uz-UZ')}
                  </p>
                  {item.reason && <p className="mt-1 text-sm">{item.reason}</p>}
                </li>
              ))}
            </ol>
          </section>
          {(order.policySnapshots?.length ?? 0) > 0 && <section className="surface p-5"><h2 className="text-lg font-black">Buyurtmada saqlangan qoidalar</h2>{order.policySnapshots?.map((item) => <details className="mt-3" key={item.id}><summary>{item.policyType} · v{item.version}</summary><pre className="muted mt-2 whitespace-pre-wrap text-xs">{JSON.stringify(item.content, null, 2)}</pre></details>)}</section>}
          {(order.changes?.length ?? 0) > 0 && <section className="surface p-5"><h2 className="text-lg font-black">O‘zgarish so‘rovlari</h2>{order.changes?.map((item) => {const detail=item.after as {status?:string;reason?:string;request?:string}|null;return <article className="order-change-card mt-3" key={item.id}><div><b>{item.kind.replaceAll('_',' ')}</b><span data-status={detail?.status}>{detail?.status??'SAQLANGAN'}</span></div><p>{detail?.request??detail?.reason??'Tafsilot mavjud emas'}</p><small className="muted">{new Date(item.createdAt).toLocaleString('uz-UZ')}</small>{order.viewerRole==='SELLER'&&item.kind==='BUYER_CHANGE_REQUEST'&&detail?.status==='PENDING'&&<div className="mt-3 flex gap-2"><button className="rs-button" onClick={()=>void decideChange(item.id,true)}>Qabul qilish</button><button onClick={()=>void decideChange(item.id,false)}>Rad etish</button></div>}</article>})}</section>}
          <div className="flex flex-wrap gap-2">
            {canCancel && <button className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-bold" onClick={() => setActionMode('cancel')}>Bekor qilish</button>}
            {order.viewerRole==='BUYER'&&['WAITING_SELLER','ACCEPTED','PREPARING'].includes(order.status)&&<button className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-bold" onClick={()=>setActionMode('change')}>O‘zgartirish so‘rovi</button>}
            {canReturn && <button className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-bold" onClick={() => setActionMode('return')}>Qaytarish</button>}
            {canDispute && <button className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-bold" onClick={() => setActionMode('dispute')}>Nizo ochish</button>}
            {order.status === 'COMPLETED' && !order.review && <button
              className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-bold"
              onClick={() => setActionMode('review')}
            >
              Sharh yozish
            </button>}
          </div>
          {order.viewerRole === 'SELLER' && sellerNext[order.status] && <section className="surface p-4"><h2 className="font-black">Keyingi ruxsat etilgan amal</h2><button className="rs-button mt-3" onClick={() => void sellerTransition(sellerNext[order.status]!)}>{sellerNext[order.status]} holatiga o‘tkazish</button></section>}
          {order.viewerRole === 'SELLER' && pendingCancellation && <section className="surface p-4"><h2 className="font-black">Xaridorning bekor qilish so‘rovi</h2><p className="muted mt-2 text-sm">{String((pendingCancellation.after as { reason?: string }).reason ?? 'Sabab ko‘rsatilmagan')}</p><div className="mt-3 flex gap-2"><button className="rs-button" onClick={() => void decideCancellation(true)}>Tasdiqlash</button><button className="rounded-full border border-[var(--line)] px-4 font-bold" onClick={() => void decideCancellation(false)}>Rad etish</button></div></section>}
          {order.viewerRole==='SELLER'&&order.status==='RETURN_REQUESTED'&&<section className="surface p-4"><h2 className="font-black">Qaytarish so‘rovi</h2><p className="muted mt-2 text-sm">Xaridor sababini o‘zgarishlar bo‘limida ko‘ring.</p><div className="mt-3 flex gap-2"><button className="rs-button" onClick={()=>void decideReturn(true)}>Qabul qilish</button><button onClick={()=>void decideReturn(false)}>Rad etish</button></div></section>}
          {order.dispute&&<section className="surface dispute-workspace p-5"><div className="flex justify-between gap-3"><h2 className="font-black">Nizo va dalillar</h2><b>{order.dispute.status}</b></div><p className="muted mt-2 text-sm">Rasm yoki PDF dalil qo‘shing. Fayl faqat ishtirokchilar va moderatorga ko‘rinadi.</p><label className="rs-button mt-3 inline-block cursor-pointer">Dalil yuklash<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={event=>{const file=event.target.files?.[0];if(file)void uploadEvidence(file);}}/></label>{order.dispute.decision&&<div className="mt-4 rounded-xl bg-[var(--surface-2)] p-3"><b>Qaror: {order.dispute.decision.outcome}</b><p>{order.dispute.decision.reason}</p></div>}</section>}
          {actionMode && actionMode !== 'review' && <form className="surface action-form p-4" onSubmit={action}><label htmlFor="action-reason" className="font-black">Sabab</label><textarea id="action-reason" name="reason" minLength={3} required rows={3} placeholder="Qaroringiz sababini yozing"/><div className="flex gap-2"><button className="rs-button">Tasdiqlash</button><button type="button" onClick={() => setActionMode(null)}>Bekor</button></div></form>}
          {actionMode === 'review' && <form className="surface action-form p-4" onSubmit={review}><label htmlFor="rating" className="font-black">Baho</label><select id="rating" name="rating" defaultValue="5">{[5,4,3,2,1].map((value) => <option key={value} value={value}>{value} yulduz</option>)}</select><label htmlFor="review-body">Sharh</label><textarea id="review-body" name="body" rows={3}/><div className="flex gap-2"><button className="rs-button">Sharhni yuborish</button><button type="button" onClick={() => setActionMode(null)}>Bekor</button></div></form>}
        </div>
        <section className="surface private-chat flex min-h-[32rem] flex-col p-5">
          <h2 className="text-lg font-black">Xususiy chat {unread>0&&<span className="unread-badge" aria-label={`${unread} ta yangi xabar`}>{unread}</span>}</h2>
          <p className="muted text-sm">Faqat buyurtma ishtirokchilari ko‘radi. <span className={`connection-state connection-state--${connection}`}>{connection === 'live' ? '● Jonli' : connection === 'connecting' ? '○ Ulanmoqda' : '○ Aloqa tiklanmoqda'}</span></p>
          <div
            className="mt-5 flex-1 space-y-3 overflow-y-auto"
            aria-live="polite"
          >
            {messages.length === 0 && (
              <p className="muted text-sm">Hali xabar yo‘q.</p>
            )}
            {messages.map((message) => (
              <article
                className={`chat-bubble ${message.senderId === order.viewerId ? 'chat-bubble--mine' : 'chat-bubble--theirs'}`}
                key={message.id}
              >
                <p className="text-sm">{message.body}</p>
                {message.kind==='LOCATION'&&message.attachment?.latitude!==undefined&&message.attachment.longitude!==undefined&&<a className="location-card" href={`https://www.openstreetmap.org/?mlat=${message.attachment.latitude}&mlon=${message.attachment.longitude}#map=17/${message.attachment.latitude}/${message.attachment.longitude}`} target="_blank" rel="noreferrer"><b>📍 {message.body||'Joylashuv'}</b><span>{message.attachment.latitude.toFixed(5)}, {message.attachment.longitude.toFixed(5)}</span><small>Xaritada ochish →</small></a>}
                <time className="muted mt-1 block text-[11px]">
                  {new Date(message.createdAt).toLocaleTimeString('uz-UZ')}
                </time>
                {message.attachments?.map((file) => (
                  <a
                    className="mt-2 block text-xs font-bold text-[var(--brand-strong)]"
                    key={file.id}
                    href={`${API}/media/private/attachments/${file.id}`}
                  >
                    📎 {file.fileName}
                  </a>
                ))}
              </article>
            ))}
          </div>
          {uploadState && <p className="text-xs font-bold" role="status">{uploadState} {retryUpload&&<button className="upload-retry" onClick={()=>void uploadAttachment(retryUpload.messageId,retryUpload.file)}>Qayta urinish</button>}</p>}
          <form
            className="mt-4 grid grid-cols-[1fr_auto] gap-2"
            onSubmit={send}
          >
            <label className="sr-only" htmlFor="message">
              Xabar
            </label>
            <input
              id="message"
              name="body"
              className="field flex-1"
              maxLength={4000}
              placeholder="Xabar yozing…"
            />
            <label className="col-span-2 cursor-pointer text-xs font-bold text-[var(--brand-strong)]">
              📎 Fayl biriktirish
              <input
                className="sr-only"
                type="file"
                name="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
              />
            </label>
            <button type="button" className="chat-location-button" onClick={sendLocation}>📍 Joylashuv</button>
            <button className="rs-button">Yuborish</button>
          </form>
        </section>
      </div>
    </main>
  );
}
