# Phase D implementation status

Updated: 2026-09-11

This file records implemented code, not planning completion. A phase is marked partial when its production or full workflow requirements still depend on missing integrations, staging evidence, or owner/legal input.

| Phase | Status | Implemented | Remaining evidence/work |
| --- | --- | --- | --- |
| D1 Foundation | Implemented | pnpm/Turborepo, web/admin/API, shared packages, env validation, Docker Compose, CI | Production environment values |
| D2 Database | Implemented baseline | PostgreSQL, Prisma schema, eleven applied migrations, relations, indexes, foreign keys and domain check constraints | Staging migration rehearsal and backup restore |
| D3 Auth & permissions | Implemented baseline | Password hashing, opaque sessions, logout, session inventory/revocation/rotation, hashed 15-minute single-use password recovery, keyed IP fingerprints, login security events/alerts, mandatory encrypted TOTP for privileged admins, multi-role API guards and rate limit | Optional seller 2FA and formal privileged-account recovery procedure |
| D4 Seller/store | Implemented baseline | Application, masked verification submission/review, private signature-checked verification upload, admin-only audited document retrieval, verified activation gate, store creation, team roles, settings, hours/delivery data and vacation API | Complete seller management UI |
| D5 Products | Implemented baseline | Listing create/edit/submit, category-defined validated attributes, protected variant/SKU/options/price/stock CRUD, inventory guards, moderation status, safe image decode, WebP optimization, thumbnails, local/S3-compatible storage adapter and marketplace thumbnail delivery | External object-storage credential smoke test and complete seller catalog UI |
| D6 Buyer marketplace | Implemented baseline | Search/filter, listing details, favorites, follows, mobile-first pages | Store/category/recently-viewed/recommendation pages and ranking iteration |
| D7 Cart/orders | Core implemented | Multi-seller checkout, atomic coupon redemption, subtotal/discount invariants, reservations, immutable snapshots, idempotency, concurrency-tested last-stock protection, cancellation decisions, return requests, transitions and 60-minute timeout | Delivery-provider integration and full buyer/seller screens |
| D8 Chat/Q&A | Core implemented | Order messages, participant-authorized private attachments with audited reads, public questions/answers, duplicate-safe reports and moderator decisions | Real-time delivery and complete conversation UI |
| D9 Reviews/trust/risk | Baseline implemented | Completed-order reviews, scheduled 90-day metrics, earned badge automation, advisory-lock job safety and deduplicated review-only timeout risk signals | Imported-testimonial UI and review moderation workflows |
| D10 Seller dashboard | Baseline implemented | Action counts and seller API/page shell | Full product/order/chat/coupon/analytics/team screens |
| D11 Admin | Baseline implemented | Role-protected seller verification/store/listing/Q&A queues, dispute evidence and immutable decisions, identity activation gate, audit log, connected admin UI and mandatory TOTP enrollment/login | Users/security/review modules, high-risk confirmations and admin management |
| D12 Notifications/search/infra | Partial | In-app notification API, preferences, critical-event protection, order events, PostgreSQL filters, Redis readiness, persistent local media and health endpoints | External push/Telegram/email and S3 providers, durable queues, disk/storage/job health |
| D13 Frontend integration | Partial | Phase C token-based responsive design system, persistent light/dark/system theme, desktop/mobile navigation, accessibility baseline, route loading/error/404/offline states, login/register, marketplace/product/cart feedback, orders, seller Action Center and admin queues connected to real APIs | Complete cart/checkout/order workspace, store/category/favorites, seller management and remaining admin modules; formal accessibility and performance QA |
| D14 Security hardening | Partial | Server authorization, validation, secure cookies, CSP/headers, CORS, origin/CSRF protection, redacted logs, rate limit, private-file authorization, tracked-file secret scanning and high-severity dependency gate | Broader upload malware scanning and staging pentest |
| D15 Testing | Partial | Domain/auth/role/origin/notification/unit tests, PostgreSQL last-stock concurrency integration test, runtime authorization checks and full lint/typecheck/test/build gate | Broader database integration, browser E2E and device coverage |
| D16 Deployment | Ready for a server, not deployed | Local Compose, CI, production containers, private DB/Redis network, automatic migrations and Caddy HTTPS routing | Server/DNS credentials, object storage, monitoring, backups and rollback rehearsal |
| D17 Launch readiness | Blocked by launch inputs | Checklist documented | Legal publication, operating procedures, closed beta and production evidence |

Payment collection, escrow, commission, and settlement remain intentionally deferred.
