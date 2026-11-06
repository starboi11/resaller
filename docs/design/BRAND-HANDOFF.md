# Brand introduction design — 2026-11-02

## Latest owner correction
Homepage is buyer-only: removed seller signup CTA, store-opening invitations,
reseller explanatory section and payout FAQ. Replaced these with catalog and
order-tracking entry points. This supersedes the buyer/seller homepage layout
described below. Backend seller permissions and existing account data are unchanged.

Base: resaller-server-2026-10-31-design-v2.zip. Local implementation only.

## Delivered
- `/` is a brand introduction with black/ivory/red styling, the existing bag handoff artwork, a lightweight entrance animation and immediate shopping CTA.
- Buyer and seller entry points, three reseller onboarding explanation steps, native accessible FAQ, responsive header and footer.
- `/marketplace` retains its real data/filter behavior; product cards have scoped visual refinements.
- Reduced-motion fallback; visible keyboard focus; 360px layout and desktop spacing.
- `docs/design/DESIGN-2.md` restored to the project.
- No changes to supplier/reseller authorization, pricing, payouts, stock or order behavior.

## Verification
- `corepack.cmd pnpm check`: exit 0; schema validation, secret scan, six deployment-tool tests, lint, types and web/admin/API builds passed.
- API suite: 117 passed, 18 skipped. This is NOT proof that all database integration tests passed. Several shared package tests also discover compiled copies; do not sum them as unique scenarios.
- `node scripts/preview-brand.mjs`: Edge/Chromium, desktop 1440x1000 and mobile viewport 360x800. No horizontal overflow, no page JavaScript exceptions, FAQ and shopping navigation passed. Axe returned no violations on the introduction page.
- Screenshots and JSON results: `artifacts/brand-preview/` in the local working folder.
- The marketplace screenshot currently records its honest API-unavailable state: the local API/database was not running during this visual check. Product-filled, authenticated buyer/reseller/supplier/admin flows have NOT been revalidated in this design pass.
- These are simulated viewport checks, not physical Android/iPhone or Safari/Firefox tests.

## Preview and boundaries
Local preview: http://localhost:3100/ . Run `corepack.cmd pnpm --filter @resaller/web exec next start --port 3100` after building if stopped.
For authenticated testing on port 3100, add that local origin to the local API CORS configuration, start the local database/Redis/API and keep its API URL aligned. Do not change production origins for this preview.
The hero is a static image with CSS animation, not an interactive 3D model or video. No artificial loading gate, automatic redirect, fake catalog data or forced intro replay.
Existing seller/admin screens retain DESIGN-2 behavior; this pass is not a redesign of every authenticated screen.
No deployment, production server or credentials were changed.
