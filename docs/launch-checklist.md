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

## Final external-service gate immediately before global launch

- [ ] Register the Telegram webhook and bind the approved operator Telegram ID
- [ ] Configure `support@resaller.uz`/temporary Gmail forwarding and a real email provider
- [ ] Install Telegram, email and push notification credentials in the server secret manager
- [ ] Revoke every R2 credential previously exposed in chat or screenshots
- [ ] Create new bucket-scoped R2 Object Read & Write credentials and install them only in staging/production secrets
- [ ] Run R2 public/private upload-download authorization smoke tests
- [ ] Approve the AI provider, model, monthly/hard cost budget, processing region, retention, training opt-out and DPA

Production launch is blocked until every unchecked item has evidence and an owner.
