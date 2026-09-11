# Resaller A–D master roadmap

This roadmap is the single delivery order. Earlier approvals remain locked unless a major business, legal, cost, or security issue requires a change.

## A — Product and business

Goal: define what Resaller is, who it serves, and the rules that must never be improvised by the UI or implementation.

- [x] Multi-seller marketplace scope
- [x] Buyer, seller, store-team, and admin roles
- [x] Zero-commission MVP; payment/escrow/settlement deferred
- [x] One checkout split into one child order per store
- [x] Seller has 60 minutes to accept
- [x] Stock reserve/release/finalize rules
- [x] Immutable product, price, policy, delivery, and legal order snapshots
- [x] Verified reviews only after completed orders
- [x] Imported testimonials labeled and excluded from core rating
- [x] Trust badges cannot be purchased; risk signals are not fraud verdicts
- [x] Public Store Q&A and private Order Chat remain separate
- [ ] Publish final owner-approved legal and operating policies before launch

Canonical rules: `domain-rules.md`.
Requirement-to-code evidence: `phase-a-acceptance.md`.

## B — Technical architecture

Goal: turn product rules into system boundaries and enforceable data flows.

- [x] Modular monolith with separate web, admin, and API applications
- [x] Backend-authoritative REST API under `/api/v1`
- [x] PostgreSQL source of truth and migration-only production changes
- [x] Prisma relations, foreign keys, indexes, transactions, and DB checks
- [x] Opaque server sessions and backend role authorization
- [x] Redis-ready cache, temporary state, and queue boundary
- [x] Local media adapter with production-persistent volume
- [x] Structured/redacted logging and health/readiness endpoints
- [x] Production container and HTTPS reverse-proxy architecture
- [ ] S3-compatible production storage adapter
- [ ] Durable job queue, observability, backup, and disaster-recovery evidence

Canonical architecture: `architecture.md`, `security.md`, and `foundation-roadmap.md`.

## C — UI/UX system

Goal: implement the approved experience consistently across mobile, tablet, and desktop.

### Buyer

- C1 design system and application shell
- C2 homepage and discovery
- C3 marketplace search, category, and filters
- C4 product details
- C5 public store page, favorites, and follows
- C6 cart and checkout

### Seller

- C7 Seller Action Center
- C8 four-step product creation: details, media, price/stock/variants, preview/publish
- C9 Order Workspace: queue, 60-minute timer, status actions, timeline, chat, changes, and disputes

### Platform

- C10 Admin Control Center with permission-scoped modules and audited actions
- C11 mobile-first responsive behavior and touch-safe controls
- C12 loading, skeleton, empty, offline, error, restricted, session-expired, and maintenance states

Cross-cutting requirements: Light/Dark/System themes, reduced motion, accessible focus/labels, reusable components, image optimization, lazy loading, and performance budgets.

The approved C specification is complete; its full implementation starts only after foundation stages F1–F6 pass.

## D — Real development

Goal: implement A using B and C, with evidence rather than checklist-only completion.

- D1 foundation/repository
- D2 database/migrations
- D3 authentication/permissions
- D4 seller/store
- D5 products/media
- D6 buyer marketplace
- D7 cart/orders
- D8 chat/Q&A
- D9 reviews/trust/risk
- D10 seller dashboard
- D11 admin control center
- D12 notifications/search/infrastructure
- D13 frontend integration
- D14 security hardening
- D15 testing/QA
- D16 deployment
- D17 launch readiness

Current code coverage: `implementation-status.md`. Detailed foundation order: `foundation-roadmap.md`. Launch gates: `launch-checklist.md`.

## Execution order from now

1. Audit and freeze A documentation.
2. Finish and verify B/F1–F6 backend foundation.
3. Convert approved C flows into reusable frontend components and complete pages in Buyer → Commerce → Seller → Admin order.
4. Close D14–D17 with automated evidence, staging, security, operations, legal approval, and beta results.

No phase is considered production-complete because its document exists; implementation and verification evidence are required.
