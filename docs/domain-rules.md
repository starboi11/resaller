# Locked domain rules

- One account may hold multiple roles; authorization is checked by the API on every protected action.
- A checkout may contain many sellers and creates one child order per store.
- A seller has exactly 60 minutes to accept. Stock is reserved at checkout and released on rejection, timeout, or cancellation; completion finalizes it.
- Buyers may cancel directly only before seller acceptance. Later cancellation is a request and an auditable transition.
- Every order stores immutable product, variant, price, seller, store-policy, delivery, and legal-version snapshots.
- Verified reviews require completed orders. Imported testimonials are labeled and excluded from the core rating.
- Trust badges cannot be purchased; automated risk signals are never treated as a fraud verdict.
- Payment collection, escrow, marketplace settlement, and commission remain deferred.
