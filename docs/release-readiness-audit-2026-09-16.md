# Resaller release-readiness audit

Date: 2026-09-16

## Verdict

Resaller is **not yet approved for public production traffic**. The local product and deployment foundation are substantial, but launch remains blocked until staging, live-service, legal, closed-beta and production evidence is complete.

Current evidence-based readiness:

- Local application and core commerce workflow: **implemented baseline**
- Automated code-quality gate: **passing**
- Cross-browser and visual test definitions: **implemented, latest local full matrix not re-run in this audit**
- Staging: **configuration ready, no deployed-host evidence**
- Legal and operations: **drafted, not owner/lawyer approved**
- Closed beta: **not started**
- Production/DNS: **not deployed**

The release order remains:

```text
UI/UX owner acceptance → local full browser matrix → staging deployment
→ staging security/operations evidence → legal approval → closed beta
→ beta fixes and data-based tuning → final security gate → production/DNS
```

## Evidence verified in this audit

- Prisma schema validation passed.
- Tracked/untracked candidate-file secret scan passed.
- Monorepo lint and TypeScript checks passed.
- Unit/domain suite passed: 49 API tests; the PostgreSQL concurrency test was skipped because Docker/PostgreSQL was unavailable.
- Web, admin, API and shared-package production builds passed.
- Production dependency audit has no known vulnerabilities after updating the transitive `mysql2` override to `3.23.1`.
- There are 17 versioned Prisma migrations.
- Playwright defines Chromium, Firefox, WebKit, Pixel 7 and iPhone 13 projects.
- A real database-backed seller → moderation → buyer checkout → seller fulfilment → verified review browser journey exists.
- Visual baselines exist for the five Playwright projects, but the complete latest matrix needs a clean rerun.
- Production Compose, Caddy HTTPS, private database/Redis networking, ClamAV, Prometheus, Alertmanager and encrypted-backup automation are represented in infrastructure code.
- Privacy, buyer, seller, returns/disputes, prohibited-listing and support/moderation documents exist as drafts.

## Blocking work before global launch

### 1. Final local acceptance

- Start Docker/PostgreSQL/Redis and run all 17 migrations from a clean database.
- Run the skipped checkout concurrency integration test.
- Run the entire Playwright matrix, not only Chromium.
- Review buyer, seller and admin screens on desktop, small Android and iPhone viewports.
- Obtain owner acceptance for home, marketplace, product, checkout, order, chat, seller wizard and admin operations visuals.
- Record remaining loading, empty, error, offline, restricted, keyboard, contrast and reduced-motion findings.

### 2. Staging deployment and evidence

- Provision a hardened Linux staging host and staging domain.
- Install secrets outside Git and deploy the production/staging Compose stack.
- Apply all 17 migrations and verify readiness through HTTPS.
- Confirm PostgreSQL, Redis, ClamAV, Prometheus and Alertmanager have no public ports.
- Run Playwright against staging in all configured browsers/devices.
- Run SSE/chat load, real ClamAV EICAR, R2 authorization and OWASP ZAP baseline tests.
- Route a controlled alert to the real operator.
- Produce timestamped backup, off-host copy, restore and application rollback evidence.

### 3. External services

- Revoke every R2 credential exposed in chat/screenshots.
- Create new bucket-scoped media/private-media/backup credentials and store them only in the server secret manager.
- Verify public product-media delivery and private verification/chat authorization boundaries.
- Configure email forwarding and the real email provider.
- Configure Telegram webhook/operator ID and push/email/Telegram notification credentials.
- Approve the AI provider, cost ceiling, processing region, retention, training opt-out and DPA before enabling production AI calls.

### 4. Legal and operations

- Replace all legal/operator/contact placeholders.
- Obtain written approval from an Uzbekistan-qualified lawyer and the owner.
- Publish versioned policies and record the accepted policy version for each user.
- Name support/moderation operators, escalation contacts and on-call ownership.
- Rehearse moderation, dispute, privacy request and security incident procedures.

### 5. Closed beta

- Recruit 20–50 real sellers under a written beta scope and feedback process.
- Seed real catalogues and execute complete seller/buyer/admin journeys.
- Track funnel completion, seller acceptance time, timeout/cancellation rate, search success, zero-result searches, support volume, disputes, chat reconnects and operational response time.
- Fix every launch-blocking defect and repeat affected regression tests.
- Tune ranking, analytics and UX only from anonymized beta evidence; do not invent thresholds before data exists.
- Obtain a written beta exit decision from product, operations and security owners.

### 6. Final security and production gate

- Resolve all high/critical findings and explicitly accept or fix remaining material findings.
- Rotate production secrets and verify least privilege.
- Freeze an immutable release commit/image and create a pre-release encrypted backup.
- Deploy production, run migrations and complete smoke tests before opening traffic.
- Connect `resaller.uz` DNS only after HTTPS, monitoring, alerts, restore and rollback evidence pass.
- Monitor the initial release with named rollback authority.

## Beta exit criteria

The beta is complete only when:

- no unresolved P0/P1 workflow, privacy or security defect remains;
- seller product-to-fulfilment and buyer checkout-to-review journeys pass in production-like staging;
- support and moderation can operate without database/manual-code intervention;
- ranking/search changes are documented with before/after evidence;
- backups restore successfully and the previous application release can be restored;
- product, operations, legal and security owners sign the release decision.
