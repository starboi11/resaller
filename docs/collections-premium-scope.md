# Collections and premium scope

Decision date: 2026-09-16

## MVP collections

Collections are included in the MVP. A collection belongs to one store, contains
only that store's listings, has a seller-defined order, and can be activated or
hidden. Collections are merchandising groups, not new inventory or pricing
sources. Listing stock, moderation, price and availability remain authoritative.

## MVP premium entitlement

Premium is an entitlement represented by `Store.premiumUntil`. It may unlock
presentation and analytics features, but must not bypass verification,
moderation, trust, risk, order or security rules. During closed beta, only an
authorized admin may grant or revoke the entitlement and every change must be
audited.

The MVP does not collect subscription payments, auto-renew, issue invoices or
perform settlement. Public self-service purchase is deferred until the owner
approves provider cost, tax/legal treatment, refunds and billing terms. Expired
entitlements fall back to the standard experience without deleting seller data.
