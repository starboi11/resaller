# Launch readiness

## Automated gates

- [x] Monorepo install, lint, typecheck, tests, and production builds
- [x] Versioned API, structured logging, safe error envelope, env validation
- [x] PostgreSQL schema baseline and Redis-ready infrastructure
- [x] Immutable order snapshot and 60-minute acceptance rules represented in schema/domain policy

## Requires staging infrastructure

- [ ] Apply and rehearse migrations against staging PostgreSQL
- [ ] Run browser E2E against deployed web/admin/API
- [ ] Penetration test, backup/restore drill, monitoring and alert verification
- [ ] HTTPS, firewall, private DB/Redis, object storage, log rotation, rollback drill

## Requires owner/legal approval

- [x] Prepare draft privacy notice, buyer terms, seller terms, prohibited-listing policy, returns/disputes policy and support/moderation SOP
- [ ] Replace every `[LEGAL_APPROVAL_REQUIRED]` and operator/contact placeholder
- [ ] Obtain written approval from an Uzbekistan-qualified lawyer and the owner
- [ ] Publish the approved, versioned documents and capture user acceptance
- [ ] Rehearse and approve support/moderation procedures with named operators
- [ ] Recruit 20–50 beta sellers and complete closed beta

## Closed-beta exit gate

- [ ] Define beta scope, feedback channel, privacy notice, named owners and stop criteria
- [ ] Recruit 20–50 real sellers and seed representative catalogues
- [ ] Record seller product-to-fulfilment and buyer checkout-to-review completion evidence
- [ ] Track search success/zero-results, checkout completion, seller acceptance time, cancellations, disputes and support load
- [ ] Fix every P0/P1 beta defect and rerun affected browser/security tests
- [ ] Tune ranking, analytics and UX from anonymized beta evidence
- [ ] Record written product, operations and security approval to exit beta

## Final external-service gate immediately before global launch

- [ ] Register the Telegram webhook and bind the approved operator Telegram ID
- [ ] Configure `support@resaller.uz`/temporary Gmail forwarding and a real email provider
- [ ] Install Telegram, email and push notification credentials in the server secret manager
- [ ] Revoke every R2 credential previously exposed in chat or screenshots
- [ ] Create new bucket-scoped R2 Object Read & Write credentials and install them only in staging/production secrets
- [ ] Run R2 public/private upload-download authorization smoke tests
- [ ] Approve the AI provider, model, monthly/hard cost budget, processing region, retention, training opt-out and DPA

## Production cutover gate

- [ ] Complete final dependency, secret, authorization and penetration-test review
- [ ] Resolve all high/critical findings and document material accepted risks
- [ ] Freeze an immutable release commit/image and create a verified pre-release backup
- [ ] Deploy production and apply all pending migrations with rollback authority present
- [ ] Verify HTTPS, health, monitoring, alert routing, R2 boundaries and critical commerce smoke tests
- [ ] Connect `resaller.uz` DNS only after every preceding gate has timestamped evidence
- [ ] Monitor launch with named incident commander and rollback owner

Production launch is blocked until every unchecked item has evidence and an owner.
