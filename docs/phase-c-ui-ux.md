# Phase C — UI/UX implementation contract

## Principles

- Mobile-first commerce with fast primary actions and minimum 44px touch targets.
- Buyer UI is clear and product-led; seller UI is operational; admin UI is dense, permission-aware, and audit-oriented.
- The API remains authoritative. Hidden buttons are convenience, never security.
- Light, Dark, and System themes share tokens and accessible contrast.
- Motion uses CSS first, respects reduced-motion, and never delays checkout or order actions.

## Buyer journeys

- Home → discovery/category/search → product → store → cart → checkout → order → chat → completion → review.
- Every list provides loading, empty, error, retry, and unavailable states.
- Product pages show real media, price, stock, seller trust context, variants, delivery, policy summary, Q&A, and verified reviews.

## Seller journeys

- Apply → verification → store setup → product creation → review → active catalog.
- Product creation is organized into details, media, price/stock/variants, and preview/publish.
- Action Center prioritizes expiring orders, low stock, unread chat, unanswered Q&A, and moderation warnings.
- Order Workspace combines order facts, acceptance timer, valid next actions, timeline, chat, problems, changes, and dispute state.

## Admin journeys

- Dashboard and queues lead to verification, stores, listings, users, orders, disputes, reviews, Q&A, risk, security, and audit.
- High-risk actions require explicit confirmation and a reason.
- Mobile admin prioritizes monitoring and urgent actions; full investigation is desktop-first.

## System states

Required states include 404, 500, offline, maintenance, empty cart, no results, no orders, product unavailable, restricted/suspended store, upload failure, permission denied, session expired, action success, and retryable background failure.
