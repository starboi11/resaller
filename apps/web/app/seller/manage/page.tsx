'use client';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { StatePanel } from '@resaller/ui';
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
function DraftImage({ file, name }: { file: File; name: string }) {
  const [source, setSource] = useState('');
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSource(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return source ? (
    <img
      className="product-preview__image"
      src={source}
      alt={`${name || 'Draft mahsulot'} preview`}
    />
  ) : null;
}
type Store = {
  publicId: string;
  username: string;
  nameUz: string;
  status: string;
  vacationMode: boolean;
  logoStorageKey?: string | null;
  bannerStorageKey?: string | null;
  premiumUntil?: string | null;
  collections?: {
    publicId: string;
    nameUz: string;
    items: { listing: { publicId: string; nameUz: string } }[];
  }[];
  members: { role: string; user: { username: string } }[];
  questions: {
    id: string;
    body: string;
    createdAt: string;
    answer?: { id: string; body: string } | null;
    listing?: { nameUz: string } | null;
  }[];
  importedTestimonials: {
    id: string;
    sourceLabel: string;
    authorLabel: string;
    body: string;
    createdAt: string;
  }[];
  listings: {
    publicId: string;
    nameUz: string;
    status: string;
    priceMinor: string;
    currency: string;
    salePriceMinor?: string | null;
    videoStorageKey?: string | null;
    isResale?: boolean;
    markupBps?: number | null;
    resale?: { wholesalePriceMinor: string; sourceStatus: string; minMarkupBps: number; maxMarkupBps: number } | null;
    variants: {
      id: string;
      sku: string;
      inventory: { available: number } | null;
    }[];
    media: {
      id: string;
      storageKey: string;
      thumbnailStorageKey?: string | null;
      position: number;
      variantId?: string | null;
    }[];
  }[];
};
const storeStatusLabel: Record<string, string> = {
  DRAFT: 'Qoralama — xaridorlarga ko‘rinmaydi',
  PENDING_REVIEW: 'Eski tekshiruv holati — yordamga murojaat qiling',
  ACTIVE: 'Faol do‘kon',
  RESTRICTED: 'Cheklangan do‘kon',
  BLOCKED: 'Bloklangan do‘kon',
};
const listingStatusLabel: Record<string, string> = {
  DRAFT: 'Qoralama — xaridorlarga ko‘rinmaydi',
  PENDING_REVIEW: 'Eski tekshiruv holati — yordamga murojaat qiling',
  ACTIVE: 'Katalogda ko‘rinadi',
  REJECTED: 'Rad etilgan — tahrirlash kerak',
  PAUSED: 'To‘xtatilgan — xaridorlarga ko‘rinmaydi',
  ARCHIVED: 'Arxivda — xaridorlarga ko‘rinmaydi',
};
export default function SellerManage() {
  const [stores, setStores] = useState<Store[] | null>(null);
  const [message, setMessage] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [storeError, setStoreError] = useState('');
  const [login, setLogin] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [listingError, setListingError] = useState('');
  const [creatingListing, setCreatingListing] = useState(false);
  const [editTarget, setEditTarget] = useState<
    Store['listings'][number] | null
  >(null);
  const [answerTarget, setAnswerTarget] = useState<string | null>(null);
  const [mediaVariant, setMediaVariant] = useState<Record<string, string>>({});
  const [draftPreview, setDraftPreview] = useState<Record<string, string>>({});
  const [draftFiles, setDraftFiles] = useState<Record<string, File[]>>({});
  const load = useCallback(async () => {
    try {
      // The server decides who the owner is; no seller application or ID
      // verification is involved any more (only the owner sells).
      const statusResponse = await fetch(`${API}/seller/owner-status`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (statusResponse.status === 401) {
        setLogin(true);
        return;
      }
      if (!statusResponse.ok) throw new Error('Owner status unavailable');
      const status = (await statusResponse.json()) as { isOwner: boolean; store: { publicId: string } | null };
      if (!status.isOwner || !status.store) {
        setStores([]);
        setLoadFailed(false);
        return;
      }
      const response = await fetch(`${API}/seller/stores`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (response.status === 401) {
        setLogin(true);
        return;
      }
      if (!response.ok) throw new Error('Seller data unavailable');
      const ownerStoreId = status.store.publicId;
      setStores(((await response.json()) as Store[]).filter((store) => store.publicId === ownerStoreId));
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
      setMessage(
        'Seller ma’lumotlari ochilmadi. Aloqani tekshirib, qayta urining.',
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    for (const store of stores ?? []) {
      const raw = localStorage.getItem(`resaller-draft-${store.publicId}`);
      if (!raw) continue;
      try {
        const values = JSON.parse(raw) as Record<string, string>;
        setDraftPreview((current) => ({ ...current, ...values }));
        const form = document.querySelector<HTMLFormElement>(
          `form[data-draft="${store.publicId}"]`,
        );
        if (form)
          for (const [key, value] of Object.entries(values)) {
            const field = form.elements.namedItem(key) as
              HTMLInputElement | HTMLTextAreaElement | null;
            if (field) field.value = value;
          }
      } catch {
        localStorage.removeItem(`resaller-draft-${store.publicId}`);
      }
    }
  }, [stores]);
  async function post(path: string, body: unknown, method = 'POST') {
    try {
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
    } catch {
      setMessage(
        'Server bilan aloqa uzildi. Ma’lumot saqlanmadi, qayta urining.',
      );
      return false;
    }
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
      phone: data.get('phone'),
      residenceAddress: data.get('residenceAddress'),
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
    if (response.ok) await load();
  }
  async function submitStore(publicId: string) {
    await post(`stores/${publicId}/submit`, {});
  }
  async function createStore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const nameUz = String(data.get('nameUz') ?? '').trim();
    const username = String(data.get('username') ?? '')
      .trim()
      .toLowerCase();
    const orderPrefix = String(data.get('orderPrefix') ?? '')
      .trim()
      .toUpperCase();
    const error =
      nameUz.length < 2 || nameUz.length > 80
        ? 'Do‘kon nomi 2–80 belgidan iborat bo‘lishi kerak.'
        : !/^[a-z0-9_]{3,30}$/.test(username)
          ? 'Do‘kon manzili 3–30 ta kichik lotin harfi, raqam yoki _ belgisidan iborat bo‘lishi kerak.'
          : !/^[A-Z0-9]{2,8}$/.test(orderPrefix)
            ? 'Buyurtma kodi 2–8 ta katta lotin harfi yoki raqamdan iborat bo‘lishi kerak. Masalan: XON.'
            : '';
    setStoreError(error);
    if (error) return;
    await post('stores', {
      username,
      nameUz,
      orderPrefix,
    });
  }
  async function createListing(
    event: FormEvent<HTMLFormElement>,
    storeId: string,
  ) {
    event.preventDefault();
    if (creatingListing) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const nameUz = String(data.get('nameUz') ?? '').trim();
    const descriptionUz = String(data.get('descriptionUz') ?? '').trim();
    const sku = String(data.get('sku') ?? '').trim();
    const priceMinor = Number(data.get('priceMinor'));
    const stock = Number(data.get('stock'));
    const invalid =
      nameUz.length < 2 || nameUz.length > 160
        ? { step: 1, text: 'Mahsulot nomini kiriting (2–160 belgi).' }
        : descriptionUz.length < 10 || descriptionUz.length > 5000
          ? {
              step: 1,
              text: 'Tavsif kamida 10 belgidan iborat bo‘lishi kerak.',
            }
          : !String(data.get('priceMinor') ?? '').trim() ||
              !Number.isInteger(priceMinor) ||
              priceMinor < 0
            ? { step: 3, text: 'Narxni to‘g‘ri kiriting.' }
            : !String(data.get('stock') ?? '').trim() ||
                !Number.isInteger(stock) ||
                stock < 0
              ? { step: 3, text: 'Ombordagi sonni to‘g‘ri kiriting.' }
              : sku.length < 2 || sku.length > 40
                ? {
                    step: 3,
                    text: 'SKU kodini kiriting (2–40 belgi). Masalan: XON-001.',
                  }
                : null;
    if (invalid) {
      setListingError(invalid.text);
      setWizardStep(invalid.step);
      return;
    }
    setListingError('');
    setCreatingListing(true);
    try {
      const response = await fetch(`${API}/stores/${storeId}/listings`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nameUz,
          nameRu: data.get('nameRu') || undefined,
          descriptionUz,
          descriptionRu: data.get('descriptionRu') || undefined,
          priceMinor,
          salePriceMinor: data.get('salePriceMinor')
            ? Number(data.get('salePriceMinor'))
            : undefined,
          sku,
          stock,
          categorySlug: data.get('categorySlug') || 'other',
        }),
      });
      if (response.ok) {
        const listing = (await response.json()) as { publicId: string };
        let mediaFailed = false;
        for (const file of draftFiles[storeId] ?? [])
          if (!(await image(listing.publicId, file))) mediaFailed = true;
        localStorage.removeItem(`resaller-draft-${storeId}`);
        setDraftFiles((current) => ({ ...current, [storeId]: [] }));
        setMessage(
          mediaFailed
            ? 'Draft yaratildi, ammo ayrim rasmlar yuklanmadi. Mahsulotlar bo‘limidan qayta yuklang.'
            : 'Draft va media saqlandi.',
        );
        form.reset();
        setWizardStep(1);
        await load();
      } else {
        const error = (await response.json().catch(() => null)) as {
          message?: string | string[];
        } | null;
        setListingError(
          Array.isArray(error?.message)
            ? error.message.join(' ')
            : (error?.message ?? 'Draft yaratilmadi. Maydonlarni tekshiring.'),
        );
      }
    } catch {
      setListingError('Server bilan aloqa uzildi. Qayta urinib ko‘ring.');
    } finally {
      setCreatingListing(false);
    }
  }
  async function storeAsset(
    storeId: string,
    kind: 'logo' | 'banner',
    file: File,
  ) {
    const data = new FormData();
    data.set('file', file);
    const response = await fetch(`${API}/media/stores/${storeId}/${kind}`, {
      method: 'POST',
      credentials: 'include',
      body: data,
    });
    setMessage(response.ok ? `${kind} saqlandi.` : `${kind} yuklanmadi.`);
    if (response.ok) await load();
  }
  async function video(listingId: string, file: File) {
    const data = new FormData();
    data.set('file', file);
    const response = await fetch(`${API}/media/listings/${listingId}/video`, {
      method: 'POST',
      credentials: 'include',
      body: data,
    });
    setMessage(
      response.ok ? 'Video saqlandi.' : 'Video yuklanmadi (MP4/WebM, 50 MB).',
    );
    if (response.ok) await load();
  }
  async function reorder(listingId: string, ids: string[]) {
    await post(`listings/${listingId}/media-order`, { ids }, 'PATCH');
  }
  async function image(listingId: string, file: File, variantId?: string) {
    const data = new FormData();
    data.set('file', file);
    if (variantId) data.set('variantId', variantId);
    const response = await fetch(`${API}/media/listings/${listingId}/images`, {
      method: 'POST',
      credentials: 'include',
      body: data,
    });
    setMessage(
      response.ok ? 'Rasm siqildi va thumbnail yaratildi.' : 'Rasm yuklanmadi.',
    );
    if (response.ok) await load();
    return response.ok;
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
  async function addTestimonial(
    event: FormEvent<HTMLFormElement>,
    storeId: string,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (
      await post(`stores/${storeId}/testimonials`, {
        sourceLabel: data.get('sourceLabel'),
        authorLabel: data.get('authorLabel'),
        body: data.get('body'),
      })
    )
      form.reset();
  }
  async function createCollection(
    event: FormEvent<HTMLFormElement>,
    storeId: string,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const listingPublicIds = data.getAll('listings').map(String);
    if (
      await post(`stores/${storeId}/collections`, {
        nameUz: data.get('nameUz'),
        listingPublicIds,
      })
    )
      form.reset();
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
    const body = String(
      new FormData(event.currentTarget).get('body') ?? '',
    ).trim();
    if (!body) return;
    await post(`questions/${answerTarget}/answer`, { body });
    setAnswerTarget(null);
  }
  if (login)
    return (
      <main className="shell py-10">
        <StatePanel
          tone="warning"
            title="Do‘kon boshqaruviga kirish"
            description="Bu bo‘lim faqat do‘kon egasi uchun ochiq."
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
            <p className="eyebrow">Do‘kon boshqaruvi</p>
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
      {!loadFailed && (
        <p
          className="mt-4 rounded-xl bg-[var(--surface-2)] p-3 text-sm"
          aria-live="polite"
        >
          {message || 'Mahsulotlar, buyurtmalar va do‘kon sozlamalarini boshqaring.'}
        </p>
      )}
      {loading && (
        <StatePanel
          title="Do‘kon yuklanmoqda"
          description="Ma’lumotlaringiz tekshirilmoqda."
        />
      )}
      {loadFailed && !loading && (
        <StatePanel
          tone="danger"
          title="Do‘kon ma’lumotlari ochilmadi"
          description="API yoki internet aloqasini tekshirib, qayta urining. Saqlangan ma’lumotlar o‘chirilmaydi."
          action={
            <button
              className="rs-button"
              type="button"
              onClick={() => {
                setLoading(true);
                void load();
              }}
            >
              Qayta urinish
            </button>
          }
        />
      )}
      {(stores?.length ?? 0) > 0 && (
        <nav className="seller-section-nav" aria-label="Seller bo‘limlari">
          <a href="#store">Do‘kon</a>
          <a href="#products">Mahsulotlar</a>
          <Link href="/seller">Buyurtma va chat</Link>
          <a href="#questions">Savollar</a>
          <a href="#marketing">Marketing va tahlil</a>
          <a href="#settings">Sozlamalar</a>
        </nav>
      )}
      {stores !== null && stores.length === 0 && !loading && !loadFailed && (
        // Seller signup is closed (only the owner sells); anyone without a
        // store just gets a clear answer instead of an application form.
        <StatePanel
          title="Bu bo‘lim faqat do‘kon egasi uchun"
          description="Resaller’da faqat do‘kon egasi sotadi. Xarid qilish uchun katalogga o‘ting."
          action={<Link className="rs-button" href="/marketplace">Mahsulotlarni ko‘rish</Link>}
        />
      )}
      {stores?.map((store) => (
        <section
          id="store"
          className="surface mt-7 p-5 sm:p-7"
          key={store.publicId}
        >
          <div className="flex flex-wrap justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">{store.nameUz}</h2>
              <p className="muted">
                @{store.username} · {storeStatusLabel[store.status] ?? store.status}
              </p>
              {store.status === 'DRAFT' && (
                <div className="mt-3 grid gap-2 text-sm">
                  <p className="muted">
                    Do‘kon hali ommaga ko‘rinmaydi. Faollashtirgach xaridorlarga ko‘rinadi.
                  </p>
                  <button
                    type="button"
                    className="rs-button justify-self-start"
                    onClick={() => void submitStore(store.publicId)}
                  >
                    Do‘konni faollashtirish
                  </button>
                </div>
              )}
              {store.status === 'PENDING_REVIEW' && (
                <p className="muted mt-3 text-sm">
                  Bu eski tekshiruv holati. Yordam xizmatiga murojaat qiling.
                </p>
              )}
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
            <div className="flex flex-wrap gap-2">
              <label className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-bold">
                Logo
                <input
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void storeAsset(store.publicId, 'logo', file);
                  }}
                />
              </label>
              <label className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-bold">
                Banner
                <input
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void storeAsset(store.publicId, 'banner', file);
                  }}
                />
              </label>
              {store.premiumUntil && new Date(store.premiumUntil) > new Date() && (
                <span className="premium-pill">
                  PREMIUM ·{' '}
                  {new Date(store.premiumUntil).toLocaleDateString('uz-UZ')}
                </span>
              )}
            </div>
            <Link
              id="marketing"
              className="rs-button"
              href={`/seller/marketing/${store.publicId}`}
            >
              Marketing va analytics
            </Link>
            <Link className="rs-button" href={`/seller/center/${store.publicId}`}>
              Seller Center · barcha savdolar
            </Link>
            <p className="muted mt-2 text-xs">Premium hozir yopiq beta huquqi: faqat admin muddat belgilaydi. VIP alohida tarif sifatida rejalashtirilgan, lekin narx va afzalliklari tasdiqlanmagan. Pullik obuna va avtomatik to‘lov hali yo‘q; hech bir tarif shaxsni tekshirishni chetlab o‘tmaydi.</p>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <form
              id="products"
              data-draft={store.publicId}
              className="product-wizard grid gap-3 rounded-2xl bg-[var(--surface-2)] p-4"
              noValidate
              onSubmit={(event) => void createListing(event, store.publicId)}
              onChange={(event) => {
                setListingError('');
                const form = event.currentTarget;
                const values = Object.fromEntries(
                  new FormData(form).entries(),
                ) as Record<string, string>;
                localStorage.setItem(
                  `resaller-draft-${store.publicId}`,
                  JSON.stringify(values),
                );
                setDraftPreview(values);
                setMessage('Draft avtomatik saqlandi.');
              }}
            >
              <div>
                <h3 className="font-black">Yangi mahsulot</h3>
                <p className="muted text-xs">
                  4 bosqich · draft avtomatik saqlanadi
                </p>
              </div>
              {listingError && (
                <p
                  className="rounded-xl border border-[var(--danger)] p-3 text-sm text-[var(--danger)]"
                  role="alert"
                >
                  {listingError}
                </p>
              )}
              <ol className="wizard-steps">
                {[
                  'Tafsilotlar',
                  'Media',
                  'Narx va variant',
                  'Ko‘rish/publish',
                ].map((label, index) => (
                  <li
                    key={label}
                    className={
                      wizardStep === index + 1
                        ? 'is-active'
                        : wizardStep > index + 1
                          ? 'is-done'
                          : ''
                    }
                  >
                    <button
                      type="button"
                      onClick={() => setWizardStep(index + 1)}
                    >
                      {index + 1}. {label}
                    </button>
                  </li>
                ))}
              </ol>
              <fieldset hidden={wizardStep !== 1} className="grid gap-3">
                <legend className="sr-only">Tafsilotlar</legend>
                <label className="wizard-field">
                  <span>Mahsulot nomi *</span>
                  <input
                    className="field"
                    name="nameUz"
                    required
                    minLength={2}
                    placeholder="Mahsulot nomi"
                  />
                </label>
                <label className="wizard-field">
                  <span>
                    Ruscha nomi <small>(ixtiyoriy)</small>
                  </span>
                  <input
                    className="field"
                    name="nameRu"
                    placeholder="Название на русском (ixtiyoriy)"
                  />
                </label>
                <label className="wizard-field">
                  <span>Batafsil tavsif *</span>
                  <textarea
                    className="field min-h-24"
                    name="descriptionUz"
                    required
                    minLength={10}
                    placeholder="Batafsil tavsif"
                  />
                </label>
                <label className="wizard-field">
                  <span>
                    Ruscha tavsif <small>(ixtiyoriy)</small>
                  </span>
                  <textarea
                    className="field min-h-20"
                    name="descriptionRu"
                    minLength={10}
                    placeholder="Описание на русском (ixtiyoriy)"
                  />
                </label>
                <label className="wizard-field">
                  <span>Kategoriya kodi</span>
                  <input
                    className="field"
                    name="categorySlug"
                    placeholder="Kategoriya slug"
                  />
                </label>
                <button
                  type="button"
                  className="rs-button"
                  onClick={() => setWizardStep(2)}
                >
                  Media bosqichi →
                </button>
              </fieldset>
              <fieldset hidden={wizardStep !== 2} className="grid gap-3">
                <legend className="sr-only">Media</legend>
                <label className="media-dropzone">
                  <b>Rasmlarni tanlang yoki shu yerga tashlang</b>
                  <p className="muted text-sm">
                    JPG, PNG yoki WebP · maksimum 10 ta. Kartalarni sudrab
                    tartiblang.
                  </p>
                  <input
                    className="sr-only"
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) =>
                      setDraftFiles((current) => ({
                        ...current,
                        [store.publicId]: [...(event.target.files ?? [])].slice(
                          0,
                          10,
                        ),
                      }))
                    }
                  />
                </label>
                <div className="draft-media-list">
                  {(draftFiles[store.publicId] ?? []).map((file, index) => (
                    <div
                      draggable
                      key={`${file.name}-${file.lastModified}`}
                      onDragStart={(event) =>
                        event.dataTransfer.setData('text/plain', String(index))
                      }
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const from = Number(
                          event.dataTransfer.getData('text/plain'),
                        );
                        setDraftFiles((current) => {
                          const next = [...(current[store.publicId] ?? [])];
                          const [moved] = next.splice(from, 1);
                          if (moved) next.splice(index, 0, moved);
                          return { ...current, [store.publicId]: next };
                        });
                      }}
                    >
                      <b>{index + 1}</b>
                      <span>{file.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setDraftFiles((current) => ({
                            ...current,
                            [store.publicId]: (
                              current[store.publicId] ?? []
                            ).filter((_, i) => i !== index),
                          }))
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between">
                  <button type="button" onClick={() => setWizardStep(1)}>
                    ← Orqaga
                  </button>
                  <button
                    type="button"
                    className="rs-button"
                    onClick={() => setWizardStep(3)}
                  >
                    Narx va variant →
                  </button>
                </div>
              </fieldset>
              <fieldset hidden={wizardStep !== 3} className="grid gap-3">
                <legend className="sr-only">Narx, stock va variant</legend>
                <div className="grid grid-cols-2 gap-3">
                  <label className="wizard-field">
                    <span>Narx, so‘m *</span>
                    <input
                      className="field"
                      name="priceMinor"
                      type="number"
                      min="0"
                      required
                      placeholder="Narx"
                    />
                  </label>
                  <label className="wizard-field">
                    <span>Chegirma narxi</span>
                    <input
                      className="field"
                      name="salePriceMinor"
                      type="number"
                      min="0"
                      placeholder="Chegirma narxi"
                    />
                  </label>
                  <label className="wizard-field">
                    <span>Ombordagi soni *</span>
                    <input
                      className="field"
                      name="stock"
                      type="number"
                      min="0"
                      required
                      placeholder="Soni"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="wizard-field">
                    <span>SKU (mahsulot kodi) *</span>
                    <input
                      className="field"
                      name="sku"
                      required
                      placeholder="SKU"
                    />
                    <small className="muted">
                      Har bir variant uchun alohida kod. Masalan: XON-001.
                    </small>
                  </label>
                  <label className="wizard-field">
                    <span>Yetkazib berish istisnosi</span>
                    <input
                      className="field"
                      name="deliveryOverride"
                      placeholder="Delivery override (ixtiyoriy)"
                    />
                  </label>
                </div>
                <div className="flex justify-between">
                  <button type="button" onClick={() => setWizardStep(2)}>
                    ← Orqaga
                  </button>
                  <button
                    type="button"
                    className="rs-button"
                    onClick={() => setWizardStep(4)}
                  >
                    Preview →
                  </button>
                </div>
              </fieldset>
              <fieldset hidden={wizardStep !== 4} className="grid gap-3">
                <legend className="sr-only">Preview va publish</legend>
                <div className="product-preview">
                  <span>DESKTOP / MOBILE PREVIEW</span>
                  {(draftFiles[store.publicId] ?? [])[0] && (
                    <DraftImage
                      file={(draftFiles[store.publicId] ?? [])[0]!}
                      name={draftPreview.nameUz}
                    />
                  )}
                  <b>{draftPreview.nameUz || 'Draftdagi mahsulot'}</b>
                  <p className="muted text-sm">
                    {draftPreview.descriptionUz ||
                      'Tavsif shu yerda ko‘rinadi.'}
                  </p>
                  <strong>
                    {draftPreview.salePriceMinor ||
                      draftPreview.priceMinor ||
                      '0'}{' '}
                    so‘m
                  </strong>
                  <small>
                    {(draftFiles[store.publicId] ?? []).length} ta rasm · SKU{' '}
                    {draftPreview.sku || '—'}
                  </small>
                </div>
                <div className="flex justify-between">
                  <button type="button" onClick={() => setWizardStep(3)}>
                    ← Orqaga
                  </button>
                  <button className="rs-button" disabled={creatingListing}>
                    {creatingListing
                      ? 'Saqlanmoqda…'
                      : 'Draft va mediani yaratish'}
                  </button>
                </div>
              </fieldset>
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
                          {listingStatusLabel[item.status] ?? item.status} ·{' '}
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
                            if (file)
                              void image(
                                item.publicId,
                                file,
                                mediaVariant[item.publicId],
                              );
                          }}
                        />
                      </label>
                    </div>
                    <label className="muted mt-3 block text-xs">
                      Rasm qaysi variantga tegishli?
                      <select
                        className="field mt-1"
                        value={mediaVariant[item.publicId] ?? ''}
                        onChange={(event) =>
                          setMediaVariant((current) => ({
                            ...current,
                            [item.publicId]: event.target.value,
                          }))
                        }
                      >
                        <option value="">Barcha variantlar</option>
                        {item.variants.map((variant) => (
                          <option key={variant.id} value={variant.id}>
                            {variant.sku}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="media-reorder mt-3">
                      {item.media.map((media, index) => (
                        <div
                          draggable
                          key={media.id}
                          onDragStart={(event) =>
                            event.dataTransfer.setData(
                              'text/plain',
                              String(index),
                            )
                          }
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.preventDefault();
                            const from = Number(
                              event.dataTransfer.getData('text/plain'),
                            );
                            const ids = item.media.map((value) => value.id);
                            const [moved] = ids.splice(from, 1);
                            if (moved) {
                              ids.splice(index, 0, moved);
                              void reorder(item.publicId, ids);
                            }
                          }}
                        >
                          <img
                            src={`${API}/media/private/listings/${item.publicId}/${media.thumbnailStorageKey ?? media.storageKey}`}
                            alt={`${item.nameUz} ${index + 1}`}
                          />
                          <small>
                            {media.variantId ? 'Variant' : 'Umumiy'}
                          </small>
                        </div>
                      ))}
                    </div>
                    <label className="mt-3 inline-block cursor-pointer text-sm font-bold text-[var(--brand-strong)]">
                      Mahsulot videosi
                      <input
                        className="sr-only"
                        type="file"
                        accept="video/mp4,video/webm"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void video(item.publicId, file);
                        }}
                      />
                    </label>
                    <button
                      className="mt-3 text-sm font-black text-[var(--brand-strong)]"
                      disabled={store.status !== 'ACTIVE'}
                      onClick={() =>
                        void post(`listings/${item.publicId}/submit`, {})
                      }
                    >
                      {store.status === 'ACTIVE'
                        ? 'Mahsulotni e’lon qilish'
                        : 'Avval do‘kon faollashsin'}
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
              <form
                className="mt-5 grid gap-3 rounded-2xl border border-[var(--line)] p-4"
                onSubmit={(event) =>
                  void createCollection(event, store.publicId)
                }
              >
                <h3 className="font-black">Collection yaratish</h3>
                <input
                  className="field"
                  name="nameUz"
                  minLength={2}
                  required
                  placeholder="Masalan: Kuzgi chegirmalar"
                />
                <div className="grid gap-2">
                  {store.listings.map((listing) => (
                    <label
                      className="flex gap-2 text-sm"
                      key={listing.publicId}
                    >
                      <input
                        type="checkbox"
                        name="listings"
                        value={listing.publicId}
                      />
                      {listing.nameUz}
                    </label>
                  ))}
                </div>
                <button className="rs-button">Collection saqlash</button>
                {store.collections?.map((collection) => (
                  <p className="muted text-sm" key={collection.publicId}>
                    <b>{collection.nameUz}</b> · {collection.items.length}{' '}
                    mahsulot
                  </p>
                ))}
              </form>
            </div>
          </div>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <form
              id="settings"
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
          </div>
          <div className="mt-6">
            <h3 id="questions" className="font-black">
              Xaridor savollari
            </h3>
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
            <form
              className="grid gap-3 rounded-2xl bg-[var(--surface-2)] p-4"
              onSubmit={(event) => void addTestimonial(event, store.publicId)}
            >
              <h3 className="font-black">Import qilingan fikr</h3>
              <p className="muted text-sm">
                Faqat ruxsat bilan olingan fikrni manbasi bilan kiriting. U
                verified review sifatida ko‘rsatilmaydi.
              </p>
              <input
                className="field"
                name="sourceLabel"
                minLength={2}
                required
                placeholder="Manba, masalan Telegram"
              />
              <input
                className="field"
                name="authorLabel"
                minLength={2}
                required
                placeholder="Muallif nomi"
              />
              <textarea
                className="field min-h-24"
                name="body"
                minLength={3}
                maxLength={1000}
                required
                placeholder="Fikr matni"
              />
              <button className="rs-button">Import fikrni saqlash</button>
            </form>
            <section>
              <h3 className="font-black">
                Saqlangan import fikrlar ({store.importedTestimonials.length})
              </h3>
              <div className="mt-3 grid gap-3">
                {store.importedTestimonials.map((item) => (
                  <article
                    className="rounded-2xl border border-[var(--line)] p-4"
                    key={item.id}
                  >
                    <span className="testimonial-source">
                      IMPORT · {item.sourceLabel}
                    </span>
                    <p className="mt-2 text-sm">{item.body}</p>
                    <div className="mt-3 flex justify-between">
                      <b className="text-sm">{item.authorLabel}</b>
                      <button
                        className="text-sm font-black text-[var(--danger)]"
                        onClick={() =>
                          void post(
                            `stores/${store.publicId}/testimonials/${item.id}`,
                            {},
                            'DELETE',
                          )
                        }
                      >
                        O‘chirish
                      </button>
                    </div>
                  </article>
                ))}
                {!store.importedTestimonials.length && (
                  <p className="muted text-sm">Import fikr yo‘q.</p>
                )}
              </div>
            </section>
          </div>
        </section>
      ))}
      {editTarget && (
        <div className="dialog-backdrop" role="presentation">
          <form
            className="surface app-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Mahsulotni tahrirlash"
            onSubmit={editListing}
          >
            <h2 className="text-xl font-black">Mahsulotni tahrirlash</h2>
            <label>
              Mahsulot nomi
              <input
                className="field"
                name="nameUz"
                defaultValue={editTarget.nameUz}
                minLength={2}
                required
              />
            </label>
            <label>
              Narx
              <input
                className="field"
                name="priceMinor"
                type="number"
                min="0"
                defaultValue={editTarget.priceMinor}
                required
              />
            </label>
            <div className="flex gap-2">
              <button className="rs-button">Saqlash</button>
              <button type="button" onClick={() => setEditTarget(null)}>
                Bekor
              </button>
            </div>
          </form>
        </div>
      )}
      {answerTarget && (
        <div className="dialog-backdrop" role="presentation">
          <form
            className="surface app-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Savolga javob"
            onSubmit={answerQuestion}
          >
            <h2 className="text-xl font-black">Savolga javob</h2>
            <textarea
              className="field min-h-28"
              name="body"
              minLength={2}
              maxLength={2000}
              required
              autoFocus
            />
            <div className="flex gap-2">
              <button className="rs-button">Javobni yuborish</button>
              <button type="button" onClick={() => setAnswerTarget(null)}>
                Bekor
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
