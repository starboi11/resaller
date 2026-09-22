# Resaller completion roadmap

Updated: 2026-09-22

This is the delivery order for closing the approved visual and product contract. A checkbox is complete only when the UI, API authorization, database behavior, error states, and browser evidence all pass.

## Product acceptance target

The primary release journey is:

```text
seller registers → verifies identity → creates store → creates product
→ admin reviews product → buyer finds and selects product → checkout splits orders
→ seller accepts within 60 minutes → seller fulfills order → buyer completes and reviews
```

Every screen must answer one primary user question and expose one obvious next action. The approved cinematic black/deep-green, neon-mint and metallic Resaller identity remains the visual reference on desktop and mobile.

### Local acceptance evidence

- [x] The primary release journey passes through the real browser UI on desktop Chromium and a Pixel 7 viewport: seller creates a product and uploads media → moderator approves it → buyer finds it, adds it to cart and checks out → seller accepts within the visible 60-minute window and fulfills it → buyer leaves a verified review.
- [x] Home/empty-marketplace snapshots and responsive buyer/seller/admin entry checks run on Chromium, Firefox, WebKit, Pixel 7, and iPhone 13. This is technical coverage, not owner visual sign-off.

## C — Final UI/UX acceptance

- [ ] Match home, search, filter, product, order tracking and order chat to the approved reference at desktop and mobile viewports.
- [x] Keep cinematic/3D work concentrated in the entry experience, lazy-loaded with static and reduced-motion fallbacks.
- [ ] Complete shared Dialog, Drawer, Toast, FormField, Tabs, FileUploader, Countdown, Timeline and Pagination components.
- [x] Capture and review reference screenshots for light, dark and system themes.
- [ ] Pass keyboard, contrast, screen-reader labels, reduced-motion, loading, empty, error, offline and restricted-state checks. Automated WCAG A/AA scans report no serious or critical violations on the five primary public routes across Chromium, Firefox, WebKit, Pixel 7 and iPhone 13; authenticated workspaces and manual screen-reader review remain.

## D6–D13 — Complete the real workflows

- [x] Replace homepage hardcoded products, ratings and store claims with live API data and honest empty/error states.
- [x] Complete Uzbek/Russian, Latin/Cyrillic, synonym and typo-tolerant search with pagination.
- [x] Complete product media zoom, variant media, delivery override, review distribution and Q&A reporting.
- [x] Complete checkout confirmation, success screen, saved addresses and multi-seller explanation.
- [x] Complete the full buyer order lifecycle, change requests, returns, disputes and review flow.
- [x] Complete unread chat, reconnect status, attachment progress/retry, location and change-request cards.
- [x] Complete the seller four-step wizard with autosave, drag/reorder media, variant media and real preview.
- [x] Connect Store, Products, Orders, Chat, Q&A, Marketing, Analytics, Team and Settings through a consistent seller workspace navigation.
- [x] Provide task-specific verification/listing queues and role-filtered order, dispute, risk, review, security and audit admin workspaces.
- [x] Reconcile store logo/banner, product video/sale price, collections and premium/subscription scope with the approved specification.

## AI assistant

- [x] Add a clearly labeled assistant UI for product discovery, comparison, order guidance and seller form help.
- [x] Ground answers in public catalog data and the signed-in user's authorized order/store data only.
- [x] Require server-side authorization; the assistant cannot change orders, stock, roles or moderation decisions.
- [x] Add data minimization, prompt-injection protection, distributed rate limits, audit events and refusal/fallback states.
- [ ] Select and connect the production model/provider only after the owner approves cost, retention and privacy terms.

## D14–D15 — Security and evidence

- [x] Add complete browser tests for buyer checkout-to-review, seller product-to-fulfillment and admin verification/moderation/dispute flows.
- [ ] Test every actionable control for success, validation, denied permission, expired session, duplicate request and API outage. Core auth and public resilience cases pass; exhaustive per-control coverage remains.
- [x] Add Chromium, Firefox and WebKit coverage plus representative small Android and iPhone viewports.
- [ ] Add visual regression baselines for the approved screens and themes.
- [ ] Run accessibility, performance, SSE load, upload-malware and staging penetration tests. Local WCAG automation, keyboard/reduced-motion/performance budgets, the full five-project browser matrix, 25 concurrent authenticated SSE connections, and EICAR/ClamAV rejection passed on 2026-09-22; manual assistive-technology review and a deployed-host penetration test remain.

## D16–D17 — Staging, production and launch

- [ ] Connect real S3-compatible storage and notification provider credentials.
- [ ] Deploy staging, apply migrations and run the complete browser suite against it.
- [ ] Verify HTTPS, firewall, private DB/Redis, monitoring, alerts, off-host backup, restore and rollback.
- [ ] Publish owner/legal-approved privacy, buyer, seller, prohibited-listing, return and dispute policies.
- [ ] Approve support and moderation procedures.
- [ ] Run a closed beta with 20–50 sellers; fix blocking workflow and usability findings.
- [ ] Deploy production and connect `resaller.uz` only after every launch gate has evidence.

Payment collection, escrow and settlement remain deferred by the approved MVP scope.
