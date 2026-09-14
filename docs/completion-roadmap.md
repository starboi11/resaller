# Resaller completion roadmap

Updated: 2026-09-14

This is the delivery order for closing the approved visual and product contract. A checkbox is complete only when the UI, API authorization, database behavior, error states, and browser evidence all pass.

## Product acceptance target

The primary release journey is:

```text
seller registers → verifies identity → creates store → creates product
→ admin reviews product → buyer finds and selects product → checkout splits orders
→ seller accepts within 60 minutes → seller fulfills order → buyer completes and reviews
```

Every screen must answer one primary user question and expose one obvious next action. The approved cinematic black/deep-green, neon-mint and metallic Resaller identity remains the visual reference on desktop and mobile.

## C — Final UI/UX acceptance

- [ ] Match home, search, filter, product, order tracking and order chat to the approved reference at desktop and mobile viewports.
- [ ] Keep cinematic/3D work concentrated in the entry experience, lazy-loaded with static and reduced-motion fallbacks.
- [ ] Complete shared Dialog, Drawer, Toast, FormField, Tabs, FileUploader, Countdown, Timeline and Pagination components.
- [ ] Capture and review reference screenshots for light, dark and system themes.
- [ ] Pass keyboard, contrast, screen-reader labels, reduced-motion, loading, empty, error, offline and restricted-state checks.

## D6–D13 — Complete the real workflows

- [x] Replace homepage hardcoded products, ratings and store claims with live API data and honest empty/error states.
- [ ] Complete Uzbek/Russian, Latin/Cyrillic, synonym and typo-tolerant search with pagination.
- [ ] Complete product media zoom, variant media, delivery override, review distribution and Q&A reporting.
- [ ] Complete checkout confirmation, success screen, saved addresses and multi-seller explanation.
- [ ] Complete the full buyer order lifecycle, change requests, returns, disputes and review flow.
- [ ] Complete unread chat, reconnect status, attachment progress/retry, location and change-request cards.
- [ ] Complete the seller four-step wizard with autosave, drag/reorder media, variant media and real preview.
- [ ] Split seller operations into clear Store, Products, Orders, Chat, Q&A, Marketing, Analytics, Team and Settings workspaces.
- [ ] Replace raw admin JSON detail with task-specific verification, listing, order, dispute, risk, review, security and audit workspaces.
- [ ] Reconcile store logo/banner, product video/sale price, collections and premium/subscription scope with the approved specification.

## AI assistant

- [ ] Add a clearly labeled assistant UI for product discovery, comparison, order guidance and seller form help.
- [ ] Ground answers in public catalog data and the signed-in user's authorized order/store data only.
- [ ] Require server-side tool authorization; never let the model directly change orders, stock, roles or moderation decisions.
- [ ] Add consent, data minimization, prompt-injection protection, rate limits, audit events, refusal/fallback states and cost budgets.
- [ ] Select and connect the production model/provider only after the owner approves cost, retention and privacy terms.

## D14–D15 — Security and evidence

- [ ] Add complete browser tests for buyer checkout-to-review, seller product-to-fulfillment and admin verification/moderation/dispute flows.
- [ ] Test every actionable control for success, validation, denied permission, expired session, duplicate request and API outage.
- [ ] Add Chromium, Firefox and WebKit coverage plus representative small Android and iPhone viewports.
- [ ] Add visual regression baselines for the approved screens and themes.
- [ ] Run accessibility, performance, SSE load, upload-malware and staging penetration tests.

## D16–D17 — Staging, production and launch

- [ ] Connect real S3-compatible storage and notification provider credentials.
- [ ] Deploy staging, apply migrations and run the complete browser suite against it.
- [ ] Verify HTTPS, firewall, private DB/Redis, monitoring, alerts, off-host backup, restore and rollback.
- [ ] Publish owner/legal-approved privacy, buyer, seller, prohibited-listing, return and dispute policies.
- [ ] Approve support and moderation procedures.
- [ ] Run a closed beta with 20–50 sellers; fix blocking workflow and usability findings.
- [ ] Deploy production and connect `resaller.uz` only after every launch gate has evidence.

Payment collection, escrow and settlement remain deferred by the approved MVP scope.
