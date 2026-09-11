# Resaller delivery roadmap

The backend foundation is completed before final UI implementation. A block is complete only when its migrations, authorization, tests, and build checks pass.

## Stage F — Foundation first

### F1 Repository and database integrity — active

- [x] Monorepo, environment validation, Docker and CI
- [x] PostgreSQL/Prisma migrations
- [x] Foreign keys for checkout, variants, reservations, legal records, preferences and security events
- [x] Database checks for money, stock, quantity, review rating and coupon schedules
- [x] Versioned baseline commit and recovery branch
- [ ] Migration rollback/restore rehearsal against disposable data

### F2 Identity and platform security

- [x] Password hashing and opaque server-side sessions
- [x] Role guards, CORS, CSP, origin/CSRF boundary and rate limiting
- [x] Session inventory/revocation and suspicious-login context events
- [x] Explicit session-token rotation with atomic old-token revocation
- [x] Password recovery with hashed, expiring, single-use tokens
- [x] Mandatory encrypted TOTP enrollment and login for privileged admin roles
- [x] Automated tracked-file secret scanning in local checks and CI

### F3 Seller, catalog and media domain

- [x] Seller application and masked verification review
- [x] Store, team roles, settings, hours, delivery and vacation data
- [x] Listings, variants, inventory, moderation and secure local images
- [x] Private verification-document upload, admin-only retrieval and access audit
- [x] Thumbnail/compression pipeline and S3-compatible storage adapter
- [x] Category attributes and protected variant/inventory management APIs

### F4 Cart, checkout and order engine

- [x] Multi-seller checkout and idempotency
- [x] Immutable snapshots and stock reservations
- [x] Seller 60-minute acceptance and automatic stock release
- [x] Coupon calculation/redemption transaction with DB amount invariants
- [x] Cancellation decision and return-request workflow
- [x] PostgreSQL concurrency test for last-stock checkout; idempotency is DB-unique

### F5 Communication, trust and operations

- [x] Order messages, public Q&A, reviews and in-app notifications
- [x] Authorized private order attachments and Q&A report moderation
- [ ] Durable Redis-backed notification/background queue
- [x] Scheduled trust metrics, earned badges and review-only risk signals
- [x] Dispute opening, private evidence and immutable admin decision workflow
- [ ] Admin users/reviews/security/disputes APIs

### F6 Operational readiness

- [x] Health/readiness, structured logs and production containers
- [x] HTTPS routing and private production DB/Redis network
- [ ] Metrics, monitoring and alert rules
- [ ] Automated encrypted backups and restore drill
- [ ] Browser E2E, accessibility, performance and staging penetration tests

## Stage UI — Frontend after foundation

1. Shared design system, themes, accessibility and application shell
2. Buyer: home, categories, store, search, favorites and recently viewed
3. Commerce: cart, checkout, order detail, timeline, chat and review
4. Seller: onboarding, store/team/settings, catalog/media, orders, Q&A and analytics
5. Admin: verification, moderation, users, disputes, reviews, security and audit
6. Loading, empty, error, offline, reduced-motion and responsive states
7. Playwright buyer/seller/admin journeys and device QA

## Stage Launch — External activation

- Provision staging and production infrastructure
- Configure DNS, TLS, object storage and notification providers
- Publish approved legal documents and operating procedures
- Complete penetration test, backup restore and rollback evidence
- Run a closed beta with 20–50 sellers before public launch

Payment collection, escrow, commission and settlement stay deferred.
