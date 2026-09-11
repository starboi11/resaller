# Phase C baseline matrix

Phase C currently provides only a UI/UX foundation. The approved black/neon-green visual board is canonical; the current generic violet implementation does not satisfy final visual acceptance.

| Requirement | Evidence | Status |
| --- | --- | --- |
| Mobile-first buyer shell | Responsive header and fixed bottom navigation | Implemented |
| Minimum touch targets | Shared buttons, navigation and admin actions use at least 44px | Implemented |
| Light, dark and system themes | Token-based theme with persistent three-state selector | Baseline; brand mismatch |
| Accessible navigation | Skip links, focus-visible treatment, landmarks, labels and page titles | Implemented baseline |
| Reduced motion | Global `prefers-reduced-motion` handling | Implemented |
| Loading state | Route skeletons for buyer and admin | Implemented |
| Empty/no-results states | Marketplace, orders and seller queue state panels | Implemented |
| Error/retry states | Route error boundaries and API failure panels | Implemented |
| 404 state | Buyer and admin not-found screens | Implemented |
| Offline state | Live browser network banner | Implemented |
| Product primary action | Stock-aware cart action with login/success/failure feedback | Baseline |
| Seller urgency hierarchy | Action Center and 60-minute acceptance queue | Implemented baseline |
| Admin density and audit context | Queue metrics, required reasons and permission responses | Implemented baseline |

Remaining full buyer, seller and admin feature screens are Phase D implementation work, not a reopening of Phase C decisions.

Final acceptance additionally requires screenshot comparison against the approved board for desktop home, mobile home, search, filter, product, order tracking, and order chat.
