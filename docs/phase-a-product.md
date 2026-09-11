# Phase A — Product contract

Resaller is a mobile-first, multi-seller marketplace for buyers and independent stores. The MVP helps sellers list inventory, receive direct orders, communicate with buyers, and establish measurable trust. It does not collect buyer funds or settle seller payouts.

## Actors and value

- Buyers discover products, order across multiple stores, track fulfillment, chat about an order, and review completed purchases.
- Sellers manage a store, catalog, stock, incoming orders, public questions, team members, and operating settings.
- Store managers and order operators receive least-privilege access.
- Specialized admins perform verification, moderation, support, disputes, security, and platform administration.

## Commercial rules

- The MVP has zero marketplace sales commission.
- Payment collection, escrow, settlement, and marketplace payout accounting are deferred.
- Sponsored placement must not override basic organic relevance or masquerade as organic content.
- Trust status cannot be bought.

## Order contract

- A cart may contain products from many stores.
- Checkout creates one immutable parent checkout and one order per store.
- Stock is reserved atomically when checkout succeeds.
- A seller must accept within exactly 60 minutes.
- Reject, timeout, or eligible cancellation releases stock; completion finalizes it.
- A buyer may directly cancel before acceptance. Later changes require an auditable request/workflow.
- Historical orders never change when a listing, price, delivery setting, policy, or legal document changes.

## Content, trust, and moderation

- Store Q&A is public and subject to reporting/moderation.
- Order Chat is private and accessible to authorized participants; exceptional admin access requires a legitimate reason and audit.
- Only completed orders can create verified reviews.
- Imported testimonials are visibly labeled and excluded from the verified rating.
- Automated risk signals trigger review and never declare a user fraudulent by themselves.

## Launch boundary

Launch requires approved privacy, buyer, seller, prohibited-listing, return, dispute, moderation, and support policies plus a closed beta. These documents require owner/legal approval and cannot be inferred from implementation code.
