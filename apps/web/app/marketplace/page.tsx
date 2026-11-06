import Link from 'next/link';
import type { Metadata } from 'next';
import { StatePanel } from '@resaller/ui';
import { demoListings } from '../lib/demo-catalog';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Marketplace' };
type Query = {
  q?: string;
  category?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  page?: string;
  lang?: 'uz' | 'ru';
};
type Listing = {
  publicId: string;
  nameUz: string;
  nameRu?: string | null;
  priceMinor: string;
  salePriceMinor?: string | null;
  category: { nameUz: string };
  store: {
    nameUz: string;
    nameRu?: string | null;
    sellerProfile: { trustBadge: string };
  };
  variants: {
    options: Record<string, string>;
    inventory?: { available: number } | null;
  }[];
  media: { storageKey: string; thumbnailStorageKey?: string | null }[];
};
type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  pages: number;
};
const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const categories = [
  'Elektronika',
  'Moda',
  'Go‘zallik',
  'Uy jihozlari',
  'Bolalar',
];
const art: Record<string, string> = {
  'demo-1': 'phone',
  'demo-2': 'shoe',
  'demo-3': 'laptop',
  'demo-4': 'watch',
  'demo-5': 'headphones',
};

function FilterFields({ query, ru }: { query: Query; ru: boolean }) {
  return (
    <>
      <input type="hidden" name="lang" value={ru ? 'ru' : 'uz'} />
      <label className="filter-search">
        <span aria-hidden="true">⌕</span>
        <input
          name="q"
          defaultValue={query.q}
          aria-label={ru ? 'Поиск' : 'Natijadan qidirish'}
          placeholder={ru ? 'Поиск' : 'Natijadan qidirish'}
        />
      </label>
      <fieldset>
        <legend>{ru ? 'Категория' : 'Kategoriya'}</legend>
        {categories.map((name) => (
          <label key={name}>
            <input
              type="radio"
              name="category"
              value={name}
              defaultChecked={query.category === name}
            />
            <span>{name}</span>
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>{ru ? 'Цена' : 'Narx oralig‘i'}</legend>
        <div className="price-fields">
          <input
            name="minPrice"
            defaultValue={query.minPrice}
            inputMode="numeric"
            pattern="[0-9]*"
            aria-label={ru ? 'Минимальная цена' : 'Minimal narx'}
            placeholder={ru ? 'от' : 'dan'}
          />
          <input
            name="maxPrice"
            defaultValue={query.maxPrice}
            inputMode="numeric"
            pattern="[0-9]*"
            aria-label={ru ? 'Максимальная цена' : 'Maksimal narx'}
            placeholder={ru ? 'до' : 'gacha'}
          />
        </div>
      </fieldset>
      <button className="rs-button">
        {ru ? 'Показать' : 'Natijalarni ko‘rish'}
      </button>
    </>
  );
}

export default async function Marketplace({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const query = await searchParams;
  const ru = query.lang === 'ru';
  const sort = query.sort ?? 'relevance';
  const params = new URLSearchParams();
  for (const key of [
    'q',
    'category',
    'minPrice',
    'maxPrice',
    'sort',
    'page',
  ] as const)
    if (query[key]) params.set(key, query[key]!);
  params.set('pageSize', '12');
  let products: Listing[] = [];
  let pagination: Pagination = {
    page: Number(query.page) || 1,
    pageSize: 12,
    total: 0,
    pages: 1,
  };
  let unavailable = false;
  let demoMode = false;
  try {
    const response = await fetch(`${api}/marketplace/listings?${params}`, {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error();
    const result = (await response.json()) as
      { items: Listing[]; pagination: Pagination } | Listing[];
    products = Array.isArray(result) ? result : result.items;
    pagination = Array.isArray(result)
      ? { ...pagination, total: result.length }
      : result.pagination;
  } catch {
    if (process.env.NODE_ENV !== 'development' || process.env.DEMO_CATALOG_ENABLED !== 'true') unavailable = true;
    else {
      demoMode = true;
      const text = (query.q ?? '').toLocaleLowerCase('uz');
      products = demoListings.filter(
        (item) =>
          !text ||
          `${item.nameUz} ${item.store.nameUz}`
            .toLocaleLowerCase('uz')
            .includes(text),
      ) as unknown as Listing[];
      pagination = { page: 1, pageSize: 12, total: products.length, pages: 1 };
    }
  }
  const href = (page: number, lang = query.lang ?? 'uz') => {
    const next = new URLSearchParams(params);
    next.set('page', String(page));
    next.set('lang', lang);
    return `/marketplace?${next}`;
  };
  return (
    <main
      className="catalog-page shell"
      role="search"
      aria-label={
        ru ? 'Поиск по маркетплейсу' : 'Marketplace qidiruvi va filterlar'
      }
    >
      <nav className="catalog-breadcrumb">
        <Link href="/">{ru ? 'Главная' : 'Bosh sahifa'}</Link>
        <span>›</span>
        <b>Marketplace</b>
      </nav>
      <div className="catalog-title">
        <div>
          <p className="eyebrow">
            {ru ? 'Найдите нужное' : 'Mahsulotlarni kashf eting'}
          </p>
          <h1>{query.q ? `“${query.q}”` : ru ? 'Товары' : 'Mahsulotlar'}</h1>
          <p>
            {pagination.total} {ru ? 'товаров найдено' : 'ta mahsulot topildi'}
          </p>
          <div className="locale-switch">
            <Link className={!ru ? 'active' : ''} href={href(1, 'uz')}>
              UZ
            </Link>
            <Link className={ru ? 'active' : ''} href={href(1, 'ru')}>
              RU
            </Link>
          </div>
        </div>
        <form className="catalog-sort">
          <input type="hidden" name="lang" value={ru ? 'ru' : 'uz'} />
          {['q', 'category', 'minPrice', 'maxPrice'].map((key) => (
            <input
              key={key}
              type="hidden"
              name={key}
              value={query[key as keyof Query] ?? ''}
            />
          ))}
          <label htmlFor="sort">{ru ? 'Сортировка' : 'Saralash'}</label>
          <select id="sort" name="sort" defaultValue={sort}>
            <option value="relevance">
              {ru ? 'По релевантности' : 'Tavsiya etilgan'}
            </option>
            <option value="new">{ru ? 'Сначала новые' : 'Eng yangi'}</option>
            <option value="price-asc">
              {ru ? 'Сначала дешёвые' : 'Arzon narx'}
            </option>
            <option value="price-desc">
              {ru ? 'Сначала дорогие' : 'Qimmat narx'}
            </option>
          </select>
          <button>{ru ? 'Применить' : 'Qo‘llash'}</button>
        </form>
      </div>
      {demoMode && (
        <p className="demo-notice" role="status">
          Development demo katalogi
        </p>
      )}
      <details className="mobile-filter-panel">
        <summary>
          ☷ {ru ? 'Фильтры и сортировка' : 'Filter va saralash'}
        </summary>
        <form action="/marketplace">
          <FilterFields query={query} ru={ru} />
        </form>
      </details>
      <div className="catalog-layout">
        <aside className="filter-panel">
          <div className="filter-panel__heading">
            <h2>{ru ? 'Фильтры' : 'Filterlar'}</h2>
            <Link href={`/marketplace?lang=${ru ? 'ru' : 'uz'}`}>
              {ru ? 'Сбросить' : 'Tozalash'}
            </Link>
          </div>
          <form action="/marketplace">
            <FilterFields query={query} ru={ru} />
            <input type="hidden" name="sort" value={sort} />
          </form>
        </aside>
        <section
          className="catalog-results"
          aria-label={ru ? 'Товары' : 'Mahsulotlar'}
        >
          {unavailable ? (
            <StatePanel
              tone="danger"
              title={
                ru ? 'Сервис недоступен' : 'Mahsulotlarni yuklab bo‘lmadi'
              }
              description={
                ru ? 'Попробуйте позже.' : 'Keyinroq qayta urinib ko‘ring.'
              }
            />
          ) : products.length === 0 ? (
            <div className="catalog-empty">
              <span>⌕</span>
              <h2>{ru ? 'Ничего не найдено' : 'Hech narsa topilmadi'}</h2>
              <p>
                {ru
                  ? 'Измените запрос или фильтры.'
                  : 'Qidiruv yoki filtrlarni o‘zgartirib ko‘ring.'}
              </p>
            </div>
          ) : (
            <>
              <div className="catalog-grid">
                {products.map((product) => {
                  const stock = product.variants.reduce(
                    (sum, v) => sum + (v.inventory?.available ?? 0),
                    0,
                  );
                  const name =
                    ru && product.nameRu ? product.nameRu : product.nameUz;
                  return (
                    <Link
                      href={`/product/${product.publicId}?lang=${ru ? 'ru' : 'uz'}`}
                      key={product.publicId}
                      className="catalog-card"
                    >
                      <div className="catalog-card__image">
                        {product.media[0] ? (
                          <img
                            src={`${api}/media/${product.media[0].thumbnailStorageKey ?? product.media[0].storageKey}`}
                            alt={name}
                            loading="lazy"
                          />
                        ) : (
                          <div
                            className={`product-art product-art--${art[product.publicId] ?? 'phone'}`}
                          >
                            <span />
                          </div>
                        )}
                      </div>
                      <div className="catalog-card__body">
                        <h2>{name}</h2>
                        <p>
                          {Object.values(
                            product.variants[0]?.options ?? {},
                          ).join(' · ')}
                        </p>
                        <strong>
                          {Number(
                            product.salePriceMinor ?? product.priceMinor,
                          ).toLocaleString('uz-UZ')}{' '}
                          {ru ? 'сум' : 'so‘m'}
                        </strong>
                        {product.salePriceMinor && (
                          <del>
                            {Number(product.priceMinor).toLocaleString('uz-UZ')}
                          </del>
                        )}
                        <small className={stock ? 'in-stock' : 'out-stock'}>
                          {stock
                            ? ru
                              ? `В наличии · ${stock}`
                              : `Sotuvda · ${stock} dona`
                            : ru
                              ? 'Нет в наличии'
                              : 'Tugagan'}
                        </small>
                      </div>
                    </Link>
                  );
                })}
              </div>
              {pagination.pages > 1 && (
                <nav
                  className="pagination"
                  aria-label={ru ? 'Страницы' : 'Sahifalar'}
                >
                  <Link
                    aria-disabled={pagination.page === 1}
                    href={href(Math.max(1, pagination.page - 1))}
                  >
                    ←
                  </Link>
                  {Array.from({ length: pagination.pages }, (_, i) => i + 1)
                    .slice(
                      Math.max(0, pagination.page - 3),
                      pagination.page + 2,
                    )
                    .map((page) => (
                      <Link
                        key={page}
                        className={page === pagination.page ? 'active' : ''}
                        aria-current={
                          page === pagination.page ? 'page' : undefined
                        }
                        href={href(page)}
                      >
                        {page}
                      </Link>
                    ))}
                  <Link
                    aria-disabled={pagination.page === pagination.pages}
                    href={href(Math.min(pagination.pages, pagination.page + 1))}
                  >
                    →
                  </Link>
                </nav>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
