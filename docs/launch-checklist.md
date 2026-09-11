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

- [ ] Publish privacy notice, buyer terms, seller terms, prohibited-listing policy, returns and disputes policy
- [ ] Confirm support and moderation operating procedures
- [ ] Recruit 20–50 beta sellers and complete closed beta

Production launch is blocked until every unchecked item has evidence and an owner.
