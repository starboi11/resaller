# Resaller completion roadmap

Updated: 2026-10-02

Current deployment evidence and limitations are recorded in `release-audit-2026-10-02.md`; use `SERVER-HANDOFF-2026-10-02.md` for server preparation. Older totals below are historical evidence, not a release approval.

This is the delivery order for closing the approved visual and product contract. A checkbox is complete only when the UI, API authorization, database behavior, error states, and browser evidence all pass.

## Product acceptance target

The primary release journey is:

```text
seller registers → submits identity document → admin verifies seller once
→ seller activates store → creates and publishes product → buyer finds and selects product → checkout splits orders
→ seller accepts within 60 minutes → seller fulfills order → buyer completes and reviews
```

Every screen must answer one primary user question and expose one obvious next action. The latest approved cinematic black, soft-white and red Resaller identity supersedes the older green/mint reference on desktop and mobile.

### Local acceptance evidence

- [x] Rerun the revised primary release journey through a real browser against isolated local PostgreSQL. Identity document submission, one admin seller verification, self-service store activation/product publication, checkout, fulfillment and review passed in desktop Chromium, Firefox, WebKit and Android on 2026-09-29. The long iPhone journey remains skipped on Windows; owner/admin iPhone checks passed. Staging still needs its own run.
- [ ] Approve new home/empty-marketplace visual baselines. The 2026-09-27 full browser run had 130 passes, 7 visual failures and 3 skips: five home snapshots and two empty-marketplace snapshots still expect the earlier green palette, while the current UI uses the later black/white/red direction. Do not silently replace baselines without owner visual review.

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
- [x] Provide seller verification queue, post-publication listing oversight and role-filtered order, dispute, risk, review, security and audit admin workspaces. Individual product approval is no longer required; prohibited products can still be restricted with an audited reason.
- [x] Reconcile store logo/banner, product video/sale price, collections and premium/subscription scope with the approved specification.

## AI assistant

- [x] Add a clearly labeled assistant UI for product discovery, comparison, order guidance and seller form help.
- [x] Ground answers in public catalog data and the signed-in user's authorized order/store data only.
- [x] Require server-side authorization; the assistant cannot change orders, stock, roles or moderation decisions.
- [x] Add data minimization, prompt-injection protection, distributed rate limits, audit events and refusal/fallback states.
- [ ] Select and connect the production model/provider only after the owner approves cost, retention and privacy terms.

## D14–D15 — Security and evidence

- [ ] Pass the revised complete browser journey for buyer checkout-to-review, seller onboarding/product-to-fulfillment and admin verification/post-publication restriction/dispute flows against staging. Local changed-feature matrix on 2026-09-29: 29 passed across Chromium/Firefox/WebKit/Android/iPhone, with one intentional long iPhone journey skip on Windows.
- [ ] Test every actionable control for success, validation, denied permission, expired session, duplicate request and API outage. Core auth and public resilience cases pass; exhaustive per-control coverage remains.
- [x] Add Chromium, Firefox and WebKit coverage plus representative small Android and iPhone viewports.
- [ ] Add visual regression baselines for the approved screens and themes.
- [ ] Run accessibility, performance, SSE load, upload-malware and staging penetration tests. Local WCAG automation, keyboard/reduced-motion/performance budgets, the full five-project browser matrix, 25 concurrent authenticated SSE connections, and EICAR/ClamAV rejection passed on 2026-09-22; manual assistive-technology review and a deployed-host penetration test remain.

## D16–D17 — Staging, production and launch

- [ ] Connect real S3-compatible storage and notification provider credentials.
- [ ] Deploy staging, apply migrations and run the complete browser suite against it.
- [ ] Verify HTTPS, firewall, private DB/Redis, monitoring, alerts, off-host backup, restore and rollback.
- [ ] Fix the production TLS gate before launch: read-only live smoke on 2026-09-27 found that plain HTTP still returned 200 instead of redirecting to HTTPS, and neither web nor admin sent HSTS. Confirm valid origin HTTPS and Cloudflare zone ownership before enabling edge redirect and HSTS.
- [ ] Publish owner/legal-approved privacy, buyer, seller, prohibited-listing, return and dispute policies.
- [ ] Approve support and moderation procedures.
- [ ] Run a closed beta with 20–50 sellers; fix blocking workflow and usability findings.
- [ ] Deploy production and connect `resaller.uz` only after every launch gate has evidence.

Payment collection, escrow and settlement remain deferred by the approved MVP scope.
