# Seller Center / SellerOS (2026-10-04)

Seller Center is part of Resaller.uz, under `/seller/center/{storePublicId}`. It does not replace the marketplace checkout or order model.

## Existing systems reused

- `Store`, `SellerProfile` verification, and `StoreMember` roles for access control.
- `ListingVariant` and `Inventory` for one shared available/reserved stock balance.
- Marketplace `Order` is read in the combined seller order list; its 60-minute seller-acceptance, checkout, review, dispute, and buyer-protection rules stay unchanged.
- Existing session authentication, encryption service, and audit log.
- Existing product, team, settings, and storefront screens are linked rather than copied.

## New data and API

Migration: `apps/api/prisma/migrations/20261004090000_selleros_core/migration.sql` adds `StoreCustomer`, `ExternalOrder`, `ExternalOrderItem`, `ExternalOrderHistory`, `StockMovement`, and `SellerExpense`. External orders use an immutable item snapshot and idempotency key. Contact phone and delivery address are encrypted; phone lookup uses a store-scoped HMAC. All money is integer UZS, never floating point.

All routes require an authenticated, verified seller with the appropriate store role. Base path: `/api/v1/seller-center/stores/:storeId`.

| Route | Purpose |
| --- | --- |
| `GET dashboard`, `GET orders` | Seller overview and combined marketplace/external orders |
| `POST external-orders`, `GET external-orders/:id` | Create/read a manual, Instagram, Telegram, offline, or other order |
| `POST external-orders/:id/transition` | Guarded status transition and stock release/finalize |
| `PATCH external-orders/:id/delivery`, `PATCH external-orders/:id/payment-record` | Courier details and seller-recorded payment state |
| `GET inventory`, `POST inventory/adjust` | Shared stock and audited adjustment |
| `GET customers`, `GET customers/:id/orders`, `PATCH customers/:id` | Store-scoped CRM and order history |
| `GET finance?period=1\|7\|30`, `POST expenses` | Daily, seven-day, or thirty-day seller reporting and expense records |
| `GET assistant-context` | Read-only, PII-minimized analytics, stock, order-status and aggregate customer context for a future provider |

Owner and Store Manager can access every Seller Center module. Order Operator can view/edit orders and delivery, and view inventory/customers, but cannot adjust stock, edit CRM, or view finance/analytics. An external order is **not** a Resaller checkout: it cannot produce a verified marketplace review, dispute, or buyer protection. Payment status is a seller-entered record, not gateway confirmation or settlement.

## Stock and finance rules

Creating an external order reserves the variants atomically in a serializable transaction. Cancellation before shipment releases the reservation. Delivery consumes it. Once shipped, cancellation cannot automatically restock an item; a physical return requires a reasoned manual adjustment. Every stock mutation and order status change writes history and audit records. The same `Inventory` rows are used by marketplace checkout.

Finance distinguishes Resaller order revenue from external revenue. External gross/net profit is explicitly an estimate based on entered cost of goods, seller-paid delivery, refunds, and expenses; a refund reverses recorded revenue, while delivered product/courier costs remain until a physical return/restock is separately recorded. Marketplace profit is unknown because item costs are not captured. Neither report claims verified cash settlement. Daily dates use Asia/Tashkent. Current reporting has a 5,000-row safety limit and exposes `truncated` when hit.

## Verification and remaining gates

- On 2026-10-04, all 21 migrations applied to a disposable `selleros_e2e` PostgreSQL container. The API suite passed 87 tests, including Seller Center reserve → cancel → deliver and existing checkout concurrency. The disposable container was removed after the run. On 2026-10-09, refund accounting, dashboard status totals, and new marketplace category snapshots were corrected and passed API/web typecheck plus API unit tests; re-run the disposable PostgreSQL suite before deploying that revision.
- Prisma validation, API/web typecheck, and the project build passed locally. These checks must be repeated against the release commit.
- Authenticated browser end-to-end checks for Seller Center and marketplace checkout still need staging evidence. Do not use production data for those drills.
- The dashboard currently reports only known external profit and seller-recorded payment status. Marketplace stock movements predate this new ledger, so the ledger is not yet a full historical ledger for all sales. Marketplace category snapshots are now written for new checkout orders; older orders cannot be backfilled without changing historical records.
- Telegram/Instagram automatic ingestion, delivery-provider APIs, AI model/provider, real payment collection/settlement, tax/accounting exports, and legal approval of external CRM data handling are separate launch decisions, not silently enabled by this feature.
- Do not deploy this migration or source to production until staging and backup/restore evidence pass.
