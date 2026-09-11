# Phase A acceptance matrix

Phase A is complete when every locked product rule has a canonical statement, enforcement point, automated evidence, and no unresolved product decision.

| Product rule | Canonical enforcement | Evidence | Status |
| --- | --- | --- | --- |
| Resaller is a multi-seller marketplace | Checkout groups cart items by store and creates child orders | Checkout API/runtime flow | Implemented |
| Buyer/seller/team/admin roles are distinct | Prisma `Role`, session resolution, ownership and role guards | Role guard tests | Implemented |
| MVP commission is 0% | Shared `PLATFORM_BUSINESS_RULES`; immutable checkout snapshot | Business-contract tests | Implemented |
| Payment, escrow and settlement are deferred | Shared contract, capability endpoint and order snapshot | Business-contract/platform tests | Implemented |
| Seller acceptance is exactly 60 minutes | Shared contract and order policy | Order-policy test | Implemented |
| Stock is reserved/released/finalized atomically | Serializable checkout and order transition transactions | Domain code and DB checks | Implemented; concurrency test pending D15 |
| Buyer direct cancellation only before acceptance | Order policy and transition authorization | Order-policy test | Implemented |
| Later cancellation is a request | Auditable `OrderChange` cancellation request | API implementation | Implemented; decision workflow pending |
| Historical order facts are immutable | JSON snapshots on order/items and policy snapshots; restrictive deletes | Schema and checkout implementation | Implemented |
| Verified reviews require completion | Review service checks `COMPLETED`; DB rating range | Service behavior and DB constraint | Implemented |
| Imported testimonials do not affect verified rating | Separate `ImportedTestimonial` model | Schema separation | Implemented |
| Trust cannot be purchased | No commerce path can assign trust; verification controls identity badge | Admin verification transaction | Implemented |
| Risk signals are not verdicts | Risk events are reviewable signals with `reviewedAt` | Schema contract | Implemented; scoring/review workflow pending D9 |
| Public Q&A and private order chat are separate | Separate models/routes and participant authorization | API implementation | Implemented |
| Admin moderation requires role and audit reason | Role guards and transactional audit logs | Runtime authorization check | Implemented |
| Launch requires legal and beta evidence | Launch checklist blocks production | `launch-checklist.md` | External approval/evidence required |

## Phase A closure boundary

The business contract itself is locked. Remaining items marked pending are implementation or launch evidence assigned to later phases; they do not reopen the product rules. Any future rule change requires an explicit decision record because it can alter existing orders or user rights.
