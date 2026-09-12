'use client';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { StatePanel } from '@resaller/ui';
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
type Store = {
  publicId: string;
  username: string;
  nameUz: string;
  status: string;
  vacationMode: boolean;
  members: { role: string; user: { username: string } }[];
  questions: {
    id: string;
    body: string;
    createdAt: string;
    answer?: { id: string; body: string } | null;
    listing?: { nameUz: string } | null;
  }[];
  importedTestimonials: { id: string; sourceLabel: string; authorLabel: string; body: string; createdAt: string }[];
  listings: {
    publicId: string;
    nameUz: string;
    status: string;
    priceMinor: string;
    currency: string;
    variants: {
      id: string;
      sku: string;
      inventory: { available: number } | null;
    }[];
  }[];
};
export default function SellerManage() {
  const [stores, setStores] = useState<Store[] | null>(null);
  const [message, setMessage] = useState('');
  const [login, setLogin] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [editTarget, setEditTarget] = useState<Store['listings'][number] | null>(null);
  const [answerTarget, setAnswerTarget] = useState<string | null>(null);
  const load = useCallback(async () => {
    const response = await fetch(`${API}/seller/stores`, {
      credentials: 'include',
      cache: 'no-store',
    });
    if (response.status === 401) {
      setLogin(true);
      return;
    }
    if (response.ok) setStores((await response.json()) as Store[]);
    else setMessage('Seller ma’lumotlari ochilmadi.');
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function post(path: string, body: unknown, method = 'POST') {
    const response = await fetch(`${API}/${path}`, {
      method,
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    setMessage(
      response.ok
        ? 'Muvaffaqiyatli saqlandi.'
        : (payload?.message ?? 'Saqlanmadi.'),
    );
    if (response.ok) await load();
    return response.ok;
  }
  async function apply() {
    await post('seller/apply', {});
  }
  async function verification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await post('seller/verification', {
      legalName: data.get('legalName'),
      documentType: data.get('documentType'),
      documentNumber: data.get('documentNumber'),
    });
  }
  async function verificationDocument(file: File) {
    const data = new FormData();
    data.set('file', file);
    const response = await fetch(`${API}/media/verification/document`, {
      method: 'POST',
      credentials: 'include',
      body: data,
    });
    setMessage(
      response.ok
        ? 'Verification hujjati xavfsiz yuklandi.'
        : 'Hujjat yuklanmadi. PDF/JPEG/PNG va 5 MB limitni tekshiring.',
    );
  }
  async function createStore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await post('stores', {
      username: data.get('username'),
      nameUz: data.get('nameUz'),
      orderPrefix: data.get('orderPrefix'),
    });
  }
  async function createListing(
    event: FormEvent<HTMLFormElement>,
    storeId: string,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const ok = await post(`stores/${storeId}/listings`, {
      nameUz: data.get('nameUz'),
      descriptionUz: data.get('descriptionUz'),
      priceMinor: Number(data.get('priceMinor')),
      sku: data.get('sku'),
      stock: Number(data.get('stock')),
      categorySlug: data.get('categorySlug') || 'other',
    });
    if (ok) form.reset();
  }
  async function image(listingId: string, file: File) {
    const data = new FormData();
    data.set('file', file);
    const response = await fetch(`${API}/media/listings/${listingId}/images`, {
      method: 'POST',
      credentials: 'include',
      body: data,
    });
    setMessage(
      response.ok ? 'Rasm siqildi va thumbnail yaratildi.' : 'Rasm yuklanmadi.',
    );
    if (response.ok) await load();
  }
  async function saveSettings(
    event: FormEvent<HTMLFormElement>,
    storeId: string,
  ) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await post(
      `stores/${storeId}/settings`,
      {
        workingHours: {
          weekdays: String(data.get('weekdays')),
          saturday: String(data.get('saturday')),
          sunday: String(data.get('sunday')),
        },
        deliverySettings: {
          coverage: String(data.get('coverage')),
          eta: String(data.get('eta')),
        },
        vacationMessageUz: String(data.get('vacationMessageUz') ?? ''),
      },
      'PATCH',
    );
  }
  async function addMember(event: FormEvent<HTMLFormElement>, storeId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (
      await post(`stores/${storeId}/members`, {
        username: data.get('username'),
        role: data.get('role'),
      })
    )
      form.reset();
  }
  async function addTestimonial(event: FormEvent<HTMLFormElement>, storeId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (await post(`stores/${storeId}/testimonials`, { sourceLabel: data.get('sourceLabel'), authorLabel: data.get('authorLabel'), body: data.get('body') })) form.reset();
  }
  async function editListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editTarget) return;
    const data = new FormData(event.currentTarget);
    const nameUz = String(data.get('nameUz') ?? '').trim();
    const price = Number(data.get('priceMinor'));
    if (!nameUz || !Number.isFinite(price)) return;
    await post(
      `listings/${editTarget.publicId}`,
      { nameUz, priceMinor: Number(price) },
      'PATCH',
    );
    setEditTarget(null);
  }
  async function addVariant(
    event: FormEvent<HTMLFormElement>,
    listingId: string,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (
      await post(`listings/${listingId}/variants`, {
        sku: data.get('sku'),
        options: { option: data.get('option') },
        stock: Number(data.get('stock')),
        priceOverrideMinor: data.get('price')
          ? Number(data.get('price'))
          : undefined,
      })
    )
      form.reset();
  }
  async function answerQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!answerTarget) return;
    const body = String(new FormData(event.currentTarget).get('body') ?? '').trim();
    if (!body) return;
    await post(`questions/${answerTarget}/answer`, { body });
    setAnswerTarget(null);
  }
  if (login)
    return (
      <main className="shell py-10">
        <StatePanel
          tone="warning"
          title="Seller boshqaruvi uchun kiring"
          description="Do‘kon ma’lumotlari faqat vakolatli jamoaga ochiq."
          action={
            <Link className="rs-button" href="/login">
              Kirish
            </Link>
          }
        />
      </main>
    );
  return (
    <main className="shell py-10 seller-workspace seller-manage-workspace">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Seller workspace</p>
          <h1 className="mt-2 text-3xl font-black">
            Do‘kon va katalog boshqaruvi
          </h1>
        </div>
        <Link
          className="rounded-full border border-[var(--line)] px-4 py-2 font-bold"
          href="/seller"
        >
          Action Center
        </Link>
      </div>
      <p
        className="mt-4 rounded-xl bg-[var(--surface-2)] p-3 text-sm"
        aria-live="polite"
      >
        {message || 'Onboarding, jamoa, sozlama va mahsulotlar bitta joyda.'}
      </p>
      {stores?.length === 0 && (
        <section className="mt-7 grid gap-5 lg:grid-cols-3">
          <div className="surface p-5">
            <h2 className="font-black">1. Seller arizasi</h2>
            <p className="muted my-3 text-sm">
              Seller rolini faollashtirish uchun ariza oching.
            </p>
            <button className="rs-button" onClick={() => void apply()}>
              Ariza boshlash
            </button>
          </div>
          <form className="surface grid gap-3 p-5" onSubmit={verification}>
            <h2 className="font-black">2. Verification</h2>
            <input
              className="field"
              name="legalName"
              required
              placeholder="Yuridik/to‘liq ism"
            />
            <select className="field" name="documentType">
              <option value="ID_CARD">ID karta</option>
              <option value="PASSPORT">Pasport</option>
              <option value="BUSINESS_REGISTRATION">Biznes hujjati</option>
            </select>
            <input
              className="field"
              name="documentNumber"
              required
              placeholder="Hujjat raqami"
            />
            <button className="rs-button">Yuborish</button>
            <label className="cursor-pointer rounded-full border border-[var(--line)] px-4 py-3 text-center text-sm font-bold">
              Hujjat faylini yuklash
              <input
                className="sr-only"
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void verificationDocument(file);
                }}
              />
            </label>
          </form>
          <form className="surface grid gap-3 p-5" onSubmit={createStore}>
            <h2 className="font-black">3. Do‘kon yaratish</h2>
            <input
              className="field"
              name="nameUz"
              required
              placeholder="Do‘kon nomi"
            />
            <input
              className="field"
              name="username"
              required
              pattern="[a-z0-9_]+"
              placeholder="username"
            />
            <input
              className="field"
              name="orderPrefix"
              required
              pattern="[A-Z0-9]+"
              placeholder="ORDER PREFIX"
            />
            <button className="rs-button">Yaratish</button>
          </form>
        </section>
      )}
      {stores?.map((store) => (
        <section className="surface mt-7 p-5 sm:p-7" key={store.publicId}>
          <div className="flex flex-wrap justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">{store.nameUz}</h2>
              <p className="muted">
                @{store.username} · {store.status}
              </p>
            </div>
            <button
              className="rounded-full border border-[var(--line)] px-4 py-2 font-bold"
              onClick={() =>
                void post(
                  `stores/${store.publicId}/vacation`,
                  { enabled: !store.vacationMode },
                  'PATCH',
                )
              }
            >
              {store.vacationMode ? 'Ta’tildan qaytish' : 'Ta’til rejimi'}
            </button>
            <Link
              className="rs-button"
              href={`/seller/marketing/${store.publicId}`}
            >
              Marketing va analytics
            </Link>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <form
              className="product-wizard grid gap-3 rounded-2xl bg-[var(--surface-2)] p-4"
              onSubmit={(event) => void createListing(event, store.publicId)}
              onChange={(event) => { const form = event.currentTarget; const values = Object.fromEntries(new FormData(form).entries()); localStorage.setItem(`resaller-draft-${store.publicId}`, JSON.stringify(values)); setMessage('Draft avtomatik saqlandi.'); }}
            >
              <div><h3 className="font-black">Yangi mahsulot</h3><p className="muted text-xs">4 bosqich · draft avtomatik saqlanadi</p></div>
              <ol className="wizard-steps">{['Tafsilotlar','Media','Narx va variant','Ko‘rish/publish'].map((label,index) => <li key={label} className={wizardStep === index + 1 ? 'is-active' : wizardStep > index + 1 ? 'is-done' : ''}><button type="button" onClick={() => setWizardStep(index + 1)}>{index + 1}. {label}</button></li>)}</ol>
              <fieldset hidden={wizardStep !== 1} className="grid gap-3"><legend className="sr-only">Tafsilotlar</legend>
              <input
                className="field"
                name="nameUz"
                required
                minLength={2}
                placeholder="Mahsulot nomi"
              />
              <textarea
                className="field min-h-24"
                name="descriptionUz"
                required
                minLength={10}
                placeholder="Batafsil tavsif"
              />
              <input className="field" name="categorySlug" placeholder="Kategoriya slug" />
              <button type="button" className="rs-button" onClick={() => setWizardStep(2)}>Media bosqichi →</button></fieldset>
              <fieldset hidden={wizardStep !== 2} className="grid gap-3"><legend className="sr-only">Media</legend><div className="media-dropzone"><b>Rasmlarni draft yaratilgach yuklaysiz</b><p className="muted text-sm">JPG, PNG yoki WebP. Tizim siqadi va thumbnail yaratadi; mahsulot kartasidan tartib va variant media boshqariladi.</p></div><div className="flex justify-between"><button type="button" onClick={() => setWizardStep(1)}>← Orqaga</button><button type="button" className="rs-button" onClick={() => setWizardStep(3)}>Narx va variant →</button></div></fieldset>
              <fieldset hidden={wizardStep !== 3} className="grid gap-3"><legend className="sr-only">Narx, stock va variant</legend><div className="grid grid-cols-2 gap-3">
                <input
                  className="field"
                  name="priceMinor"
                  type="number"
                  min="0"
                  required
                  placeholder="Narx"
                />
                <input
                  className="field"
                  name="stock"
                  type="number"
                  min="0"
                  required
                  placeholder="Soni"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="field"
                  name="sku"
                  required
                  placeholder="SKU"
                />
                <input className="field" name="deliveryOverride" placeholder="Delivery override (ixtiyoriy)" />
              </div>
              <div className="flex justify-between"><button type="button" onClick={() => setWizardStep(2)}>← Orqaga</button><button type="button" className="rs-button" onClick={() => setWizardStep(4)}>Preview →</button></div></fieldset>
              <fieldset hidden={wizardStep !== 4} className="grid gap-3"><legend className="sr-only">Preview va publish</legend><div className="product-preview"><span>DESKTOP / MOBILE PREVIEW</span><b>Draftdagi mahsulot</b><p className="muted text-sm">Yaratilgach rasm qo‘shing, barcha variantlarni tekshiring va moderatsiyaga yuboring.</p></div><div className="flex justify-between"><button type="button" onClick={() => setWizardStep(3)}>← Orqaga</button><button className="rs-button">Draft yaratish</button></div></fieldset>
            </form>
            <div>
              <h3 className="font-black">
                Mahsulotlar ({store.listings.length})
              </h3>
              <div className="mt-3 grid gap-3">
                {store.listings.map((item) => (
                  <article
                    className="rounded-2xl border border-[var(--line)] p-4"
                    key={item.publicId}
                  >
                    <div className="flex justify-between gap-3">
                      <div>
                        <b>{item.nameUz}</b>
                        <p className="muted text-xs">
                          {item.status} ·{' '}
                          {Number(item.priceMinor).toLocaleString('uz-UZ')}{' '}
                          {item.currency}
                        </p>
                      </div>
                      <label className="cursor-pointer text-sm font-bold text-[var(--brand-strong)]">
                        Rasm yuklash
                        <input
                          className="sr-only"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) void image(item.publicId, file);
                          }}
                        />
                      </label>
                    </div>
                    <button
                      className="mt-3 text-sm font-black text-[var(--brand-strong)]"
                      onClick={() =>
                        void post(`listings/${item.publicId}/submit`, {})
                      }
                    >
                      Moderatsiyaga yuborish
                    </button>
                    <button
                      className="ml-4 mt-3 text-sm font-black"
                      onClick={() => setEditTarget(item)}
                    >
                      Tahrirlash
                    </button>
                    <form
                      className="mt-3 grid grid-cols-2 gap-2"
                      onSubmit={(event) =>
                        void addVariant(event, item.publicId)
                      }
                    >
                      <input
                        className="field"
                        name="sku"
                        required
                        placeholder="Variant SKU"
                      />
                      <input
                        className="field"
                        name="option"
                        required
                        placeholder="Rang/o‘lcham"
                      />
                      <input
                        className="field"
                        name="stock"
                        type="number"
                        min="0"
                        required
                        placeholder="Soni"
                      />
                      <input
                        className="field"
                        name="price"
                        type="number"
                        min="0"
                        placeholder="Alohida narx"
                      />
                      <button className="rs-button col-span-2">
                        Variant qo‘shish
                      </button>
                    </form>
                  </article>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <form
              className="grid gap-3 rounded-2xl bg-[var(--surface-2)] p-4"
              onSubmit={(event) => void saveSettings(event, store.publicId)}
            >
              <h3 className="font-black">Ish va yetkazish vaqtlari</h3>
              <input
                className="field"
                name="weekdays"
                required
                defaultValue="09:00–18:00"
                aria-label="Dushanba–Juma"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="field"
                  name="saturday"
                  defaultValue="10:00–16:00"
                  aria-label="Shanba"
                />
                <input
                  className="field"
                  name="sunday"
                  defaultValue="Yopiq"
                  aria-label="Yakshanba"
                />
              </div>
              <input
                className="field"
                name="coverage"
                required
                placeholder="Yetkazish hududi"
              />
              <input
                className="field"
                name="eta"
                required
                placeholder="Yetkazish muddati"
              />
              <input
                className="field"
                name="vacationMessageUz"
                placeholder="Ta’til xabari"
              />
              <button className="rs-button">Sozlamalarni saqlash</button>
            </form>
            <div className="rounded-2xl bg-[var(--surface-2)] p-4">
              <h3 className="font-black">Jamoa</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {store.members.map((member) => (
                  <span
                    className="rounded-full bg-[var(--surface-2)] px-3 py-2 text-sm"
                    key={member.user.username}
                  >
                    @{member.user.username} · {member.role}
                  </span>
                ))}
              </div>
              <form
                className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]"
                onSubmit={(event) => void addMember(event, store.publicId)}
              >
                <input
                  className="field"
                  name="username"
                  required
                  placeholder="Jamoa username"
                />
                <select className="field" name="role">
                  <option value="STORE_MANAGER">Manager</option>
                  <option value="ORDER_OPERATOR">Order operator</option>
                </select>
                <button className="rs-button">Qo‘shish</button>
              </form>
            </div>
          </div>
          <div className="mt-6">
            <h3 className="font-black">Xaridor savollari</h3>
            <div className="mt-3 grid gap-3">
              {store.questions.map((question) => (
                <article
                  className="rounded-2xl border border-[var(--line)] p-4"
                  key={question.id}
                >
                  <p className="text-sm font-bold">
                    {question.listing?.nameUz ?? 'Do‘kon haqida'}
                  </p>
                  <p className="mt-1">{question.body}</p>
                  {question.answer ? (
                    <p className="muted mt-2 text-sm">
                      Javob: {question.answer.body}
                    </p>
                  ) : (
                    <button
                      className="mt-3 text-sm font-black text-[var(--brand-strong)]"
                      onClick={() => setAnswerTarget(question.id)}
                    >
                      Javob berish
                    </button>
                  )}
                </article>
              ))}
            </div>
          </div>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <form className="grid gap-3 rounded-2xl bg-[var(--surface-2)] p-4" onSubmit={(event) => void addTestimonial(event, store.publicId)}><h3 className="font-black">Import qilingan fikr</h3><p className="muted text-sm">Faqat ruxsat bilan olingan fikrni manbasi bilan kiriting. U verified review sifatida ko‘rsatilmaydi.</p><input className="field" name="sourceLabel" minLength={2} required placeholder="Manba, masalan Telegram"/><input className="field" name="authorLabel" minLength={2} required placeholder="Muallif nomi"/><textarea className="field min-h-24" name="body" minLength={3} maxLength={1000} required placeholder="Fikr matni"/><button className="rs-button">Import fikrni saqlash</button></form>
            <section><h3 className="font-black">Saqlangan import fikrlar ({store.importedTestimonials.length})</h3><div className="mt-3 grid gap-3">{store.importedTestimonials.map((item) => <article className="rounded-2xl border border-[var(--line)] p-4" key={item.id}><span className="testimonial-source">IMPORT · {item.sourceLabel}</span><p className="mt-2 text-sm">{item.body}</p><div className="mt-3 flex justify-between"><b className="text-sm">{item.authorLabel}</b><button className="text-sm font-black text-[var(--danger)]" onClick={() => void post(`stores/${store.publicId}/testimonials/${item.id}`, {}, 'DELETE')}>O‘chirish</button></div></article>)}{!store.importedTestimonials.length && <p className="muted text-sm">Import fikr yo‘q.</p>}</div></section>
          </div>
        </section>
      ))}
      {editTarget && <div className="dialog-backdrop" role="presentation"><form className="surface app-dialog" role="dialog" aria-modal="true" aria-label="Mahsulotni tahrirlash" onSubmit={editListing}><h2 className="text-xl font-black">Mahsulotni tahrirlash</h2><label>Mahsulot nomi<input className="field" name="nameUz" defaultValue={editTarget.nameUz} minLength={2} required /></label><label>Narx<input className="field" name="priceMinor" type="number" min="0" defaultValue={editTarget.priceMinor} required /></label><div className="flex gap-2"><button className="rs-button">Saqlash</button><button type="button" onClick={() => setEditTarget(null)}>Bekor</button></div></form></div>}
      {answerTarget && <div className="dialog-backdrop" role="presentation"><form className="surface app-dialog" role="dialog" aria-modal="true" aria-label="Savolga javob" onSubmit={answerQuestion}><h2 className="text-xl font-black">Savolga javob</h2><textarea className="field min-h-28" name="body" minLength={2} maxLength={2000} required autoFocus /><div className="flex gap-2"><button className="rs-button">Javobni yuborish</button><button type="button" onClick={() => setAnswerTarget(null)}>Bekor</button></div></form></div>}
    </main>
  );
}
