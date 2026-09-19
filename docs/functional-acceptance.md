# Functional acceptance record

Updated: 2026-09-19

This record distinguishes implemented behavior from production launch gates.

## Marketplace and commerce

| Capability | Current evidence |
| --- | --- |
| Uzbek/Russian, Latin/Cyrillic, synonyms and typo tolerance | Shared normalization/scoring is used by marketplace and the local assistant; unit tests cover Cyrillic, synonyms and typo matching. Non-search catalogue pagination runs in PostgreSQL instead of truncating at 500 records. |
| Product | Zoom dialog, thumbnails, variant-linked media, variant stock/price, delivery override and rating distribution are connected to live listing data. |
| Checkout | Saved-address selection/save and an explicit per-store order explanation are connected to the checkout API. Payment collection remains out of scope. |
| Order and chat | Unread count, SSE connection/reconnect state, attachment progress/retry, location cards, change requests, returns, disputes, evidence and verified reviews are connected to authorized order endpoints. |
| Seller creator | Four steps, local autosave, file drag/reorder, persisted media reorder, variant media selection, delivery override and an image-backed preview are present. |
| Seller navigation | Store, Products, Orders, Chat, Q&A, Marketing, Analytics, Team and Settings have a consistent workspace navigation. Orders/chat share the order workspace rather than duplicating order state. |
| Admin | Verification and listing queues plus role-filtered order, dispute, risk, review, security and audit modules are available. Every decision endpoint remains server-authorized and audited. |
| Collections and premium | Collections are real store-owned merchandising groups. Premium is a manually audited beta entitlement only; subscription billing, renewal and settlement are deferred. |

## AI assistant

The shipped MVP assistant is deliberately read-only and provider-neutral. It
supports catalogue discovery/comparison, authorized order guidance and
authorized seller-form guidance. It stores a prompt hash instead of raw prompt
text in audit metadata, rejects common prompt-injection/secret-extraction
attempts, and cannot mutate orders, stock, roles, moderation or payment state.

Rate limits use Redis when available so they apply across API instances; local
development falls back to an in-process window if Redis is temporarily offline.

## Production decision still required

A generative model is not silently enabled. Before connecting one, the owner
must approve the provider, hard monthly budget, per-request ceiling, processing
region, retention period, training opt-out, DPA/incident terms and Uzbek/Russian
quality. The deterministic local assistant remains the safe fallback.

## Cross-browser and malware evidence

- The complete seller → moderation → buyer → checkout → fulfillment → review
  journey passes in Chromium, Firefox, desktop WebKit/Safari emulation and the
  Pixel 7 profile. The Windows WebKit iPhone runner has passed previously but
  later stalled in the long multi-context test; it is excluded from that one
  test on Windows until it can run on macOS/iOS infrastructure. iPhone layout,
  authentication, admin modules and visual baselines remain covered.
- The production ClamAV image detected the standard harmless EICAR stream as
  `Eicar-Test-Signature FOUND` on 2026-09-19. The temporary scanner container
  was stopped after the test.
- A real Chrome Core Web Vitals trace is not recorded because the required
  Chrome DevTools MCP is not configured in this task. Existing Playwright
  resource-budget checks are not represented as a substitute for that trace.
