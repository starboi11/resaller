# Visual acceptance record

Updated: 2026-09-17

## Approved direction

The buyer experience follows the supplied Resaller references: cinematic black and
deep-green surfaces, neon-mint accents, metallic dimensional branding, restrained
content density, one clear action per screen, and mobile-first navigation.
The approved homepage headline is “Xarid qilish va sotishning yaxshiroq yo‘li.”
The earlier “Sotib ol. Sot. O‘s.” text is not the accepted hero copy.

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
- Home and empty marketplace visual snapshots pass on desktop Chromium, Firefox,
  WebKit, Pixel 7, and iPhone 13. The floating AI control is excluded from the
  hero-only snapshot because it is a separate fixed surface.
- A responsive browser smoke test opens the buyer, seller, and admin entry
  workspaces at those five device profiles and checks for visible content and
  horizontal clipping. This checks layout resilience, not visual approval.
- The real seller → moderator → buyer → fulfillment → review browser journey
  passes on desktop Chromium and iPhone 13. It captures product, cart,
  order/chat, seller wizard, and authenticated admin screenshots from actual
  records. A public product image was checked both as an HTTP response and as a
  browser-rendered image. Public media now has an explicit cross-origin resource
  policy; private media remains protected.
- The admin sidebar shows only modules allowed by the signed-in operator's
  roles. Its links open the corresponding module; this is verified in the
  authenticated browser journey.

## Reference comparison, 2026-09-17

The concept images in `OneDrive/Desktop/Photo` were compared with screenshots
from the real desktop and iPhone browser journey in `test-results/`.

| Screen | Current result | Remaining visual difference |
| --- | --- | --- |
| Product | Dark layout, real media, gallery and purchase action render | Simpler composition than the concept; final imagery/content and owner side-by-side approval remain |
| Order and private chat | Real order, translated status, timeline and chat are usable | Chat bubbles and timeline have less visual hierarchy than the concept |
| Seller wizard | Four approved steps, labeled fields, draft and media flow render | Creator still shares a long page with store settings, team and testimonials; the concept uses a focused workspace |
| Authenticated admin | Moderation and role-filtered modules render in the new shell | Detailed operator views need visual review with representative disputes, risk and security records |

The concept pictures contain illustrative figures and products. They must not
be copied as live claims or mistaken for real catalogue records.

## Final evidence gate

The complete browser journey and its screenshots now exist locally, but exact
reference parity is **not** signed off. The differences above require design
iteration and owner review at desktop and mobile sizes. The transaction test
runs on Chromium desktop and iPhone/WebKit; Firefox and Android still receive
the public/responsive suite rather than the full transactional journey.
