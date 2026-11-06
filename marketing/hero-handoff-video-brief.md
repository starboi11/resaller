# Resaller homepage handoff loop

Status: a manually animated, muted 6.4-second WebM loop is integrated locally. The camera slowly moves and the red light pulses; the people and bag remain still. This is not filmed or AI-generated handoff motion and has not yet received owner visual approval.

Source frame: `apps/web/public/brand/resaller-handoff-poster.png`.

Current asset: `apps/web/public/ads/resaller-handoff-loop.webm`. Rebuild it with `node scripts/render-handoff-loop.mjs`.

## Deliverable

- 16:9, 5–6 seconds, muted MP4/WebM for the homepage hero; no baked-in site text or buttons.
- Two adults remain on the right half of the frame. Seller passes one matte black bag to buyer. Preserve the approved off-white/red bag logo accurately.
- Minimal movement: hands meet, bag changes hands, natural eye contact. Locked camera with only subtle cinematic parallax and restrained red rim light.
- First and final frames should be visually close enough for a gentle dissolve loop. No jump cut, extra hands, morphing faces or bag, new people, logos, speech, music or checkout/payment imagery.
- Keep the left half dark and low-detail so the real HTML headline remains readable.

## Site acceptance

- Still poster loads before video; playback begins only when ready and should not block the page.
- Autoplay only when muted, looped, inline and visible. Pause when offscreen or tab hidden.
- `prefers-reduced-motion`, data-saver, unsupported video and narrow mobile devices keep the static poster.
- Compress and test the final asset against mobile load/performance budgets before enabling it.
- A separate sound-enabled advertisement may be made later, but the homepage background must stay muted.
