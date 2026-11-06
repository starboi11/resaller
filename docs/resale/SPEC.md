> **SUPERSEDED on 2026-11-03.** The owner decided that only they sell. The
> reseller model below is retired: its API module and screens were removed, and
> old links show "Bu bo‘lim endi ishlatilmaydi". The database tables remain for
> history and audit. Do not design or build against this document.

# Resaller — Supplier → Reseller → Buyer (resale) specification

Status: IMPLEMENTED (API + web + admin) on 2026-10-30, verified by `pnpm check` and a
PostgreSQL integration test (`apps/api/src/resale/resale.integration.test.ts`). Section 7 lists
the decisions taken during implementation that refine the original contract.

## 1. Business model

- The platform owner runs a **supplier store** (`Store.kind = SUPPLIER`). He imports goods
  (mainly from China), holds stock in Tashkent and ships every resale order himself.
- **Resellers** are normal seller stores (`Store.kind = SELLER`). They browse the supplier
  catalogue, add a product to their own store with a markup, and promote it on
  Instagram/Telegram. They never hold stock for resale products.
- **Buyers** buy from the reseller's store exactly like today. The buyer pays on delivery;
  the platform collects the money and later pays the reseller his margin.
- The owner may also sell directly: he opens his own SELLER store and resells his own
  catalogue like any reseller.
- Online payment gateways (Click/Payme), escrow and automatic payouts are OUT OF SCOPE.

## 2. Glossary and money rules

- All money is `BigInt` minor units (`*Minor`), currency `UZS`. Never use floats.
- Markup is basis points: `markupBps = 1000` means 10 %, `2500` means 25 %.
- Supplier unit price `W` = supplier `variant.priceOverrideMinor ?? listing.priceMinor`
  (the same rule `operations.service.ts` checkout uses today).
- Reseller unit price `R = ceil(W * (10000 + markupBps) / 10000)` using BigInt arithmetic:
  `(W * BigInt(10000 + m) + 9999n) / 10000n`.
- Margin per unit `M = R - W` (always >= 0).

## 3. Data model (already migrated)

| Model | New fields | Meaning |
| --- | --- | --- |
| Store | `kind` (SELLER/SUPPLIER) | Only SUPER_ADMIN may set SUPPLIER. |
| Listing (supplier) | `minMarkupBps`, `maxMarkupBps`, `recommendedRetailMinor` | Allowed markup window (default 1000–2500 when null) and suggested retail price. |
| Listing (reseller) | `sourceListingId`, `markupBps` | DB check: both null or both set. Unique per (storeId, sourceListingId). |
| ListingVariant (reseller) | `sourceVariantId` | Mirrors one supplier variant. Reseller variants have NO Inventory row. |
| Order | `fulfillmentStoreId` | Supplier store that ships the order; null for normal orders. |
| OrderItem | `supplierVariantId`, `supplierUnitPriceMinor`, `resellerMarginMinor` | Snapshot at order time (per unit). DB check: all null or all set. |
| ResellerEarning | one per resale order | `amountMinor` = order margin minus reseller coupon discount. |
| ResellerPayout | payout request/decision | Manual payout recorded by admin. |

## 4. Rules

### 4.1 Supplier catalogue
- Supplier listings are managed with the existing listing/variant/media/inventory APIs,
  because the supplier is a normal Store. Add the three supplier fields to the listing
  create/update DTOs; reject them (400) on SELLER stores.
- Supplier listings must NOT appear in the buyer marketplace, search, category pages,
  or store pages for buyers. They appear only in the reseller catalogue endpoint.
- Validation: `0 <= minMarkupBps <= maxMarkupBps <= 10000`.

### 4.2 Adding a product to a reseller store
- Only ACTIVE SELLER stores of identity-verified sellers; caller needs the same store
  permission that creating a listing needs today.
- Source must be an ACTIVE, non-deleted listing of an ACTIVE SUPPLIER store.
- `markupBps` must be inside the source window.
- Creates in one transaction: a Listing in the reseller store (copy category, names,
  descriptions, attributeValues, type, condition; `sourceListingId`, `markupBps`;
  `priceMinor` = R of the listing base price; status ACTIVE) and one ListingVariant per
  source variant (copy `sku`, `options`; `sourceVariantId`; `priceOverrideMinor` = R of the
  variant price when the source variant has an override, else null). No Inventory rows.
- Duplicate add returns 409.
- `priceMinor`/`priceOverrideMinor` on reseller rows are a **display cache**. Recompute them
  whenever the reseller changes markup or the supplier changes a price (same transaction
  as the supplier price change). Checkout never trusts the cache (see 4.4).
- Media is NOT copied (`ListingMedia.storageKey` is unique). Every read that returns
  listing media/video must use the source listing's media when `sourceListingId` is set.
- Reseller may change only `markupBps`, status ACTIVE/PAUSED, and soft-delete.
  Name/description/category/variants/media of resale listings are read-only (400).
- If the source listing becomes non-ACTIVE or deleted, resale listings stay but are
  not purchasable (`purchasable = false`, add-to-cart and checkout return 409).
- If the supplier narrows the markup window so a reseller's markup is outside it,
  the resale listing becomes non-purchasable until the reseller fixes the markup.

### 4.3 Stock
- Effective inventory variant: `inventoryVariantId = variant.sourceVariantId ?? variant.id`.
- EVERY inventory read/write must use it: add-to-cart availability, checkout reservation,
  release, finalize, order-timeout release, seller-center external orders
  (`seller-center.service.ts` lines ~114, ~167), and display availability.
- `StockReservation.variantId` and `StockMovement.variantId` store the inventory variant.
- Manual stock adjustment on a reseller variant returns 400.
- Supplier stock is shared by all resellers; the existing serializable/guarded
  `updateMany` pattern already prevents overselling — keep it.

### 4.4 Checkout
- Group cart items into orders by `(storeId, fulfillmentStoreId)`, so one order is either
  fully own-stock or fully supplier-fulfilled.
- Inside the existing serializable transaction, for each resale item re-read the source
  variant, source listing and supplier store; require all purchasable; recompute W and R
  from current data; require markup inside the current window.
- `OrderItem.unitPriceMinor = R`, `supplierVariantId`, `supplierUnitPriceMinor = W`,
  `resellerMarginMinor = R - W`; include them in the item snapshot.
- `Order.fulfillmentStoreId = supplier store id`.
- Coupons: a reseller coupon on a resale order is paid from the margin. If
  `discountMinor > Σ(margin × qty)` reject with 409 "Kupon chegirmasi ustamadan oshib ketdi".
- Create `ResellerEarning { storeId: reseller, orderId, amountMinor: Σ(margin×qty) − discount, status: PENDING }`.
- Keep idempotency, P2002 replay and P2034 → 409 handling exactly as today.

### 4.5 Fulfilment and order status
- For orders with `fulfillmentStoreId`, the status transitions that today belong to the
  seller (accept, reject, preparing, ready, shipped, delivered) are performed by members of
  the **fulfilment store**. Reseller store members can view the order and use order chat,
  but transition endpoints return 403 for them.
- Supplier staff see these orders in their store order list (query by
  `storeId = X OR fulfillmentStoreId = X`).
- The 60-minute accept timeout applies to the supplier.
- Reviews and trust metrics still belong to the reseller store (buyer-facing).

### 4.6 Earnings lifecycle
- Order COMPLETED → earning `AVAILABLE`, `availableAt = completedAt + 7 days`.
- Order REJECTED, TIMEOUT, CANCELLED, or refunded/returned → earning `CANCELLED`.
- While a dispute is open the earning is not payable.
- Payable = `status AVAILABLE AND availableAt <= now AND payoutId IS NULL`.

### 4.7 Payouts
- Reseller requests a payout of all payable earnings (minimum 50 000 UZS total).
  `method` is `CARD` or `CASH`; `reference` stores only card last 4 digits + holder name,
  never a full card number. One open REQUESTED payout per store (409 otherwise).
  Earnings are attached (`payoutId`) at request time.
- SUPER_ADMIN marks payout `PAID` (with external transfer reference) → earnings `PAID`,
  or `REJECTED` (reason required) → earnings detached (`payoutId = null`, stay AVAILABLE).
- Every payout and supplier-kind change writes an AuditLog entry.

## 5. API (all under `/api/v1`, same auth/guards/DTO style as existing code)

Reseller (store member):
- `GET  /seller-center/stores/:storeId/supplier-catalog?q=&categoryId=&cursor=` — supplier listings with W, window, recommended price, available stock, media.
- `POST /seller-center/stores/:storeId/resale-listings` `{ sourceListingId, markupBps }`
- `PATCH /seller-center/stores/:storeId/resale-listings/:listingId` `{ markupBps?, status? }`
- `GET  /seller-center/stores/:storeId/earnings` — totals (pending, available, payable, paid) + list.
- `POST /seller-center/stores/:storeId/payouts` `{ method, reference }`
- `GET  /seller-center/stores/:storeId/payouts`

Admin (SUPER_ADMIN):
- `PATCH /admin/stores/:storeId/kind` `{ kind }`
- `GET  /admin/payouts?status=`
- `POST /admin/payouts/:payoutId/decision` `{ decision: 'PAID'|'REJECTED', reference?, reason? }`

Existing public listing responses gain: `isResale: boolean`, and for buyers nothing about
W or margin is ever exposed. Supplier fields are only returned to resellers and admins.

## 6. Security checklist (reviewer will check each line)
- A reseller can never read W/margin of another reseller's orders or earnings (IDOR).
- Buyers never see W, margin, markup or the supplier relationship.
- Payout endpoints are store-scoped and permission-checked; admin decisions require SUPER_ADMIN.
- No float money; all comparisons in BigInt.
- All writes that touch inventory or earnings run inside serializable transactions.

## 7. Implementation decisions (2026-10-30)

- **Supplier pricing endpoint.** Existing listing edits only work on DRAFT/PAUSED listings, so the
  supplier changes price and markup window through
  `PATCH /seller-center/stores/:storeId/supplier-listings/:listingId`
  `{ priceMinor?, minMarkupBps?, maxMarkupBps?, recommendedRetailMinor?, variantPrices? }`,
  which works in any status and re-syncs reseller price caches in the same transaction.
- **Narrowed window.** Reseller listings whose markup falls outside a new window are PAUSED
  automatically and their owners get a `RESALE_MARKUP_OUT_OF_RANGE` notification. Re-activation
  requires a markup inside the window.
- **Remove.** `DELETE /seller-center/stores/:storeId/resale-listings/:listingId` soft-deletes the
  reseller listing and removes it from carts.
- **Coupons with mixed carts.** A store coupon is computed on the store subtotal, charged to the
  own-stock order first, and the remainder to resale orders, where it must not exceed the margin
  (409 otherwise). One redemption row is written per checkout.
- **External (Instagram/Telegram) orders cannot contain resale variants** (400). Otherwise supplier
  stock would be reserved without the supplier ever receiving an order to ship. Resellers send the
  customer their store link instead.
- **Chat** stays between buyer and reseller; the supplier uses the order's delivery snapshot.
- **Payout request is owner-only**; earnings/catalogue are owner or STORE_MANAGER.
- **Dispute decisions:** BUYER → earning CANCELLED; SELLER/NO_ACTION → released only if the order
  was delivered; PARTIAL → held for manual handling.
- **Admin PAID check:** a payout can be marked PAID only while every attached earning is still
  AVAILABLE and the sum matches; otherwise the admin rejects and the reseller re-requests.
- **Seller Center finance** still counts resale orders at full sale value for the reseller;
  the margin is shown on the Earnings page. Refine in beta if confusing.
