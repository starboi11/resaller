# Resale pivot — handoff log

Every AI that works on this project MUST read this whole file first and MUST append its own
entry at the bottom when it finishes. Never delete earlier entries.

Entry format:
## <number>. <who> — <task> — <date>
- Files changed (full paths):
- What was implemented:
- API shapes added/changed (request + response examples):
- What is NOT done / known problems:
- Commands run and their result (tests, typecheck), or "not run":

---

## 0. Claude — foundation (schema + migration) — 2026-10-30
- Files changed:
  - `apps/api/prisma/schema.prisma`
  - `apps/api/prisma/migrations/20261030120000_supplier_resale/migration.sql` (new)
  - `docs/resale/SPEC.md`, `docs/resale/HANDOFF.md` (new)
- Implemented: enums StoreKind/EarningStatus/PayoutStatus; Store.kind; supplier and reseller
  fields on Listing; ListingVariant.sourceVariantId; Order.fulfillmentStoreId; resale snapshot
  fields on OrderItem; ResellerEarning and ResellerPayout tables, with DB check constraints.
- The Order↔Store relation is now named `"OrderStore"` (field names unchanged, no DB change).
- NOT done: Prisma client regeneration. Run `pnpm --filter @resaller/api db:generate` before
  compiling. No service, controller, DTO or UI code yet.
- Verified: schema validated with Prisma 7.10 schema engine; all 23 migrations applied in
  order to a clean PostgreSQL 16 database without errors.

## 1. Claude — full implementation (API, web, admin) — 2026-10-30
The owner chose to have Claude implement everything; tasks 1–3 for other AIs were not used.
- New: `apps/api/src/resale/` (pricing, sync, service, controller, DTOs, module, unit + PostgreSQL
  integration tests); web pages `seller/center/[storeId]/catalog` and `.../earnings`,
  `seller/center/[storeId]/resale-api.ts`, `app/resale.css`; admin page `app/payouts`.
- Changed: `operations.service.ts` (cart, checkout, order views, fulfilment permissions, earnings),
  `order-timeout.service.ts`, `commerce.service.ts` (buyer visibility, read-only resale listings,
  supplier price sync), `media.service.ts`, `seller-center.service.ts`, `admin.service.ts`
  (dispute → earning), `app.module.ts`, web `orders/[id]/page.tsx`, `seller/manage/page.tsx`,
  seller center client, admin navigation; two existing unit-test mocks gained the new fields.
- Regenerated `apps/api/src/generated/prisma`.
- Verified: `pnpm check` green (lint, typecheck, 130 API tests incl. PostgreSQL integration with
  `RUN_DB_TESTS=1`, builds of api/web/admin). Migration applied cleanly to PostgreSQL 16.
- NOT done: browser/E2E test of the new pages; staging deployment; legal review of the new
  supplier/reseller relationship (the platform now sells goods and pays resellers).

## 2. Claude — DESIGN.md implementation — 2026-10-30
Implemented all 9 items of `docs/design/DESIGN.md` plus its "Claude tekshiruvi" notes.
- API: `GET .../earnings` now returns disjoint server totals `holdMinor` (7-day wait),
  `requestedMinor` (in an open payout) and `canRequestPayout` (owner only). Integration test
  extended: hold → payable → requested buckets, and a STORE_MANAGER sees earnings but gets
  `canRequestPayout: false` and 403 on payout request.
- Fixed bugs found by the design review: "Sotuvni to‘xtatish" now sends only
  `{ status: 'PAUSED' }` (no unsaved markup); the "7 kun" amount is no longer derived as
  available − payable; managers no longer see a payout form that would fail.
- Catalogue: 3-step guide, Sotuvda/Pauzada status badges, out-of-window warning, shared-stock
  wording, refresh keeps cards, load-more has its own loading/error state, "Filtrlarni tozalash".
- Markup sheet: fixed header and action bar with scrolling body, buyer price + per-unit profit,
  per-variant profit, coupon note, corrected payout wording, in-sheet removal confirmation,
  focus returns to the opening button.
- Earnings: "To‘lov so‘rashga tayyor" balance, four bucket rows, explicit next step
  (minimum, open request, owner-only), payout form states, stacked history rows.
- Terminology: page name "Supplier katalogi"; body text uses "ta’minotchi".
- Verified: `pnpm check` green. NOT verified visually: no browser is available in this
  environment, so the 360px/desktop and light/dark acceptance checks in DESIGN.md are still open.

## 3. Claude — local demo seed — 2026-10-31
- New `apps/api/src/scripts/seed-resale-demo.ts`, run with
  `pnpm --filter @resaller/api seed:resale-demo`. Idempotent; refuses NODE_ENV=production.
  Creates taminotchi_demo (SUPPLIER store, 3 products incl. a two-price variant and a
  zero-stock item), reseller_demo (verified SELLER store) and xaridor_demo, all with
  password `Resaller-2026`, and prints the Seller Center links.
- Verified over real HTTP against a running API (compiled dist + PostgreSQL + Redis):
  health ready, all resale routes mapped, reseller login → catalogue → add at 15 % →
  out-of-window markup rejected with Uzbek message → earnings buckets → buyer marketplace
  and listing detail show 115 000 / 126 500 so'm with shared supplier stock and no
  supplier fields.

## 4. Claude — bug review — 2026-10-31
Fixed after a review of every buyer-facing listing query and every order path:
1. AI assistant (DISCOVER and COMPARE) returned supplier listings with wholesale prices to
   buyers, and counted resale items as out of stock. Now uses `buyerVisibleListing`
   (moved to `resale/resale-visibility.ts`) plus `store.kind = SELLER`, and supplier stock.
2. Trust metrics charged supplier rejections/timeouts/disputes to the reseller. Now the
   reseller gets completed-sale credit; cancellations, timeouts and disputes count against
   the store that ships (`Store.fulfilledOrders`). Integration test added.
3. The order page never showed the delivery address/phone (pre-existing; sellers used
   chat). The supplier has no chat, so it could not know where to ship. A "Yetkazish
   ma’lumotlari" block now shows the delivery snapshot to order parties.
4. The supplier's order page loaded a chat it cannot access (403 + endless SSE
   reconnects). API now returns `canChat`; the page skips messages/stream and explains
   that the reseller talks to the buyer.
5. Store questions accepted a listing from any store (pre-existing) and questions to a
   supplier store. Both now rejected.
6. Catalogue: a failed refresh hid all cards; it now keeps them with an inline retry.
- `pnpm check` green, 132 API tests.

## 5. Claude — DESIGN-2 implementation — 2026-10-31
All 7 items of DESIGN-2 (ChatGPT audit of the 2026-10-31-fixed build).
1. Markup sheet: when all variants share one wholesale price (incl. a single variant with
   its own price) that real price is the base for price/profit; with differing prices the
   label is "Asosiy narx bo‘yicha foyda" and the variant list opens by default.
2. Order page, fulfilling party: "Buyurtmani boshqarish" block at the top with the clock and
   one verb button (Buyurtmani qabul qilish, Tayyorlashni boshlash, …), busy state, server
   error text, no local status guess; after the deadline "Muddat tugadi. Holat
   tekshirilmoqda…" and a re-check every 15 s until the timeout worker closes the order.
3. Delivery card: 16px values, Qo‘ng‘iroq qilish + Manzilni nusxalash (44px, stacked on
   phones), explicit "ko‘rsatilmagan" texts, supplier note under the card; no chat panel.
4. Roles: review button BUYER-only (was shown to sellers); wholesale/markup lines only for
   SELLER viewers as "Ulgurji narx / dona" and "Ustama / dona"; "Sotuvchiga yozish" /
   "Xaridorga yozish" jumps to the chat and focuses the input; chat titles per role;
   read receipts not sent when canChat=false.
5–6. Admin payouts: native modal dialog (focus trap, Escape, focus return) showing store,
   @username, request ID, method/reference and amount; CARD/CASH-specific field;
   required "Pulni oldindan o‘tkazdim yoki topshirdim" checkbox for PAID; cannot be closed
   while saving; a lost response re-reads the server instead of inviting a second payment;
   list load errors show a retry instead of an empty list. Admin has no theme tokens, so
   `resale-admin.css` scopes the few it needs.
7. Store kind moved to its own admin page `/store-kind`: look up the store first
   (new `GET /admin/stores/:publicId/kind`), see name, @username, status, current kind and
   listing count, then change with a reason. Integration test added.
- `pnpm check` green, 133 API tests. Not verified in a browser.

## 6. Brand introduction implementation — 2026-11-02

New cinematic introduction at `/`, immediate `/marketplace` entry, buyer/seller paths,
reseller explanation, FAQ, mobile layout and scoped catalog card styling. Existing
business logic remains unchanged. DESIGN-2 document restored in docs/design.

This pass: `corepack.cmd pnpm check` exit 0; API 117 passed and 18 skipped,
web/admin/API builds passed. Edge browser checks at 1440px and 360px passed for
intro accessibility, overflow, FAQ and navigation. Marketplace was checked in its
API-unavailable state; authenticated commerce and database tests are not claimed.
See `docs/design/BRAND-HANDOFF.md` for exact scope and local preview instructions.
