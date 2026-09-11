# Resaller layered execution plan

This is the enforced recovery order. A later layer may use an earlier layer only through its documented contract. A layer is never marked complete from documentation alone.

## Status vocabulary

- `LOCKED`: approved requirement, not implementation evidence.
- `BASELINE`: core implementation exists but the full acceptance matrix does not pass.
- `COMPLETE`: code, migration, authorization, automated tests, build, and integration evidence all pass.
- `EXTERNAL`: requires owner credentials, legal approval, infrastructure, providers, or beta participants.

## Layer A — Product and business contract

Status: `LOCKED`, with launch documents still external.

Gate into B:

- Roles and ownership rules are explicit.
- Zero-commission and deferred settlement are explicit.
- Multi-seller checkout and 60-minute acceptance are explicit.
- Cancellation, review, trust, moderation, and legal boundaries are versioned.
- Every critical rule has a requirement identifier used by B, C, and D evidence.

Remaining: owner-approved privacy, buyer terms, seller terms, prohibited-listing policy, returns/dispute policy, and operating procedures.

## Layer B — Architecture and security contract

Status: `BASELINE`.

Gate into final C implementation:

- Database integrity, authorization, session security, audit, and immutable snapshots pass.
- Private-file boundary, background-job boundary, and production media adapter exist.
- Last-stock and duplicate-checkout concurrency tests pass.
- Backup/restore and observability design are executable, not notes only.

Remaining: private verification files, thumbnails/compression, S3 adapter, Redis queue, concurrency tests, monitoring/backup evidence, and secret scanning.

## Layer C — Approved UI/UX system

Status: `BASELINE`; the earlier visual board is the canonical appearance reference.

Visual contract:

- Black/deep-green surfaces with neon mint primary actions.
- Resaller `R` identity, “BUY · SELL · GROW”, and the “Sotib ol. Sot. O‘s.” message.
- Dense desktop marketplace and compact mobile commerce layout.
- Buyer navigation: home, search, cart, chat, profile.
- Product, filter, order tracking, and order-chat mobile patterns follow the reference board.
- Light, dark, and system modes preserve the same brand identity.

Gate into D frontend completion:

- Tokens and reusable components match the visual reference.
- Desktop and mobile reference routes have screenshot evidence.
- Keyboard, reduced-motion, contrast, loading, empty, error, and offline states pass.

## Layer D — Implementation and integration

Status: mixed baselines; see `implementation-status.md`.

Execution order:

1. D1–D3 repository, database, identity, and security gaps.
2. D4–D5 seller, store, catalog, variants, and media.
3. D6 buyer discovery, categories, store, favorites, and recent history.
4. D7 cart, checkout, order detail, immutable timeline, and cancellation/returns.
5. D8 order chat, attachments, real-time delivery, and Q&A moderation.
6. D9 trust jobs, badges, reviews, and risk review.
7. D10 seller operational screens.
8. D11 complete permission-scoped admin modules.
9. D12 providers, queue, storage, search, and operations.
10. D13 final responsive integration using Layer C.
11. D14 security verification.
12. D15 unit, DB integration, concurrency, Playwright, accessibility, performance, and device QA.
13. D16 staging then production deployment, restore, and rollback evidence.
14. D17 legal publication and closed beta before public launch.

## Cross-layer traceability

Every finished feature must record:

```text
A requirement → B enforcement → C user state → D implementation → automated evidence
```

Example:

```text
60-minute acceptance
→ server-owned UTC deadline and stock transaction
→ visible urgent timer and timeout state
→ order service plus seller workspace
→ policy, DB concurrency, API, and browser tests
```

## Immediate recovery sequence

- [x] Create tested recovery baseline commit.
- [x] Create a dedicated correction branch.
- [x] Replace ambiguous phase language with status vocabulary and gates.
- [ ] Complete Layer B foundation gaps that can affect data/security contracts.
- [ ] Rebuild Layer C tokens, logo, homepage, mobile navigation, search/filter, and product page from the approved board.
- [ ] Continue D feature screens only through the shared C system.
- [ ] Add browser screenshots and Playwright evidence before calling a UI route complete.
