# Visual acceptance record

Updated: 2026-09-15

## Approved direction

The buyer experience follows the supplied Resaller references: cinematic black and
deep-green surfaces, neon-mint accents, metallic dimensional branding, restrained
content density, one clear action per screen, and mobile-first navigation.

The homepage hero uses the project-owned optimized asset at
`apps/web/public/brand/resaller-cinematic-hero.webp`. It is decorative, excluded
from the accessibility tree, lazy in effect through CSS background loading, and
has static and reduced-motion behavior.

## Captured baselines

- `home-desktop-dark.png`
- `home-desktop-light.png`
- `home-desktop-system.png`
- `home-mobile-dark.png`
- `marketplace-mobile-dark.png`
- `product-mobile-light.png`

The files are stored in `docs/visual-baselines/`. They are acceptance evidence,
not runtime assets.

## Checks completed

- Theme selection persists for light, dark, and system modes.
- The homepage hero becomes static when reduced motion is requested.
- Desktop and mobile layouts do not intentionally introduce horizontal scrolling.
- Form fields on checkout have visible labels and browser autocomplete metadata.
- Product actions remain visible without the mobile action bar covering content.
- Empty and API-unavailable catalogue states remain honest and do not substitute
  hardcoded marketplace claims.

## Final evidence gate

Order and private-chat screenshots must be captured using real seeded database
records. They are accepted only after PostgreSQL, Redis, API, web, and admin are
running together and the complete Playwright commerce journey passes. This gate
must not be replaced by mocked screenshots.

