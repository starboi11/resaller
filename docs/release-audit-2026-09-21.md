# Resaller public-launch audit — 2026-09-21

## Decision: NO-GO for public production

Source/configuration review and local checks; not a deployed-host penetration test. Application code was not changed during this audit. Build output was regenerated. The project is suitable for continued local testing, not yet signed off for public traffic. No claim of zero future incidents is possible.

## Fresh evidence

- Monorepo test command completed. API: 50 passed, one PostgreSQL concurrency test skipped. Web/admin/UI test commands explicitly report no test files; this does not invalidate separate Playwright tests, but is not browser coverage.
- Shared-package suites also collect both src and generated dist tests; raw totals therefore overstate distinct scenarios.
- All eight typecheck tasks passed.
- All eight build tasks passed (three shared-package cache hits). This is a host build, NOT proof that Docker images build or production containers boot.
- Production dependency audit reported no known vulnerabilities.
- Existing secret scanner passed 355 candidate files; it does not verify provider revocation, ignored files or history.
- Previous 2026-09-20 source findings were rechecked and remain open: development reset-token disclosure, static owner codes, unrestricted proxy trust, missing frontend CSP/frame protection, assistant store-visibility mismatch. The development Compose port exposure remains configured.
- No fresh cross-browser matrix, staging load test, malware test, remote firewall test, restore drill or penetration test was run. The September 16 report is historical evidence, not proof for today's dirty working tree.

## Blocking findings and required actions

### 1. Authentication/security findings remain open — high priority

See `security-audit-2026-09-20.md`. Do not expose the development stack. Replace permanent admin codes with genuine MFA plus recoverable one-time recovery codes; constrain verification attempts and trusted proxies; add frontend browser protections; resolve suspended-store visibility. Verify revocation of every previously exposed credential externally. No old secret was printed or used for a new remote test.

### 2. Docker build context can include private data/secrets — high

All three application Dockerfiles use `COPY . .`. `.dockerignore` excludes env files but not `.secrets/`, `apps/api/data/`, test artifacts or backup-drill directories. `.gitignore` is not a Docker exclusion list. Current media directory contains 19 files; no private media files were found there in this check. If deployment creates `.secrets/metrics_token` as Compose expects, it is eligible for copying into every application image. Exclude all runtime data/secrets, use explicit build inputs and inspect final image contents. Do not build/upload images from the current context before fixing this.

### 3. Backup can falsely report success — high

`infrastructure/backup.sh` uses `set -eu` but no pipeline failure handling for `pg_dump | gzip | openssl`. Failure of pg_dump need not fail the final encryption command, so an invalid backup can get a checksum, be uploaded and be reported successful. Fix pipeline error propagation, write atomically only after success and test intentional pg_dump failure. Off-host destination is optional; without it, backup remains on the same host. Prove a restore from the off-host copy and preserve encryption keys separately. No backup or database was deleted in this audit.

### 4. Monitoring does not notify an operator — high operational priority

`infrastructure/alertmanager.yml` has a named receiver but no delivery integration. Add real routing and prove a controlled alert arrives. Add backup-age/failure coverage. A running Prometheus container is not evidence that someone will hear about an outage.

### 5. Production account recovery has no delivery path — high workflow priority

`AuthService.requestPasswordReset` writes a token hash and security event, then returns accepted=true in production. It does not enqueue or send the raw token to an authenticated recovery destination. Search found no other consumer of PASSWORD_RESET_REQUESTED. Implement verified recovery-channel delivery, anti-enumeration and rate limits; test expired/reused tokens. Removing development token disclosure alone will not make recovery functional.

### 6. Encryption-key rotation can break MFA and notifications — medium/high operational priority

TOTP and notification endpoints both derive encryption keys directly from SESSION_SECRET without a key version. Replacing that secret makes existing encrypted records unreadable unless migration/old-key access is planned. Separate versioned data-encryption keys from session configuration, document rotation and test it on disposable data. Do not blindly rotate this value in a populated deployment.

### 7. Production support configuration is incomplete — medium

Compose passes TELEGRAM_BOT_TOKEN but not TELEGRAM_SUPPORT_ENABLED, TELEGRAM_WEBHOOK_SECRET, TELEGRAM_SUPPORT_CHAT_ID or TELEGRAM_WEBHOOK_URL. These are required by the support configuration when enabled. Supplying them only in the interpolation env file does not automatically inject them into the container. Wire required variables explicitly and test operator authorization and webhook rejection. Email/push and R2 credentials also require real delivery/authorization evidence, not presence checks.

### 8. Health/readiness can be misleading — medium

HealthController.ready returns a degraded JSON body without setting a failure HTTP status. Its S3 check only verifies configuration strings, not credentials or access. Status-only monitors can therefore regard a degraded service as healthy. Add an appropriate failure status and bounded real dependency checks or separate active probes. ClamAV readiness is not verified by Compose's service_started dependency; fail-closed uploads can remain unavailable during scanner startup.

### 9. Test/CI gaps — high release priority

Concurrency test requires RUN_DB_TESTS=1. CI supplies DATABASE_URL but does not set this flag, so that test is skipped. Enable it against isolated CI PostgreSQL and verify the result. Playwright configuration hardcodes localhost and starts local services; create an explicit deployed-target mode before claiming staging evidence. Test buyer/seller/admin denial cases, expired sessions, duplicate checkout, final stock, 60-minute timeout, review eligibility, stored XSS and private attachments. Rerun all supported browsers after current changes, not just the historical revision.

### 10. Container/release rehearsal missing

Build and boot clean images after excluding private data. In particular verify Prisma generation with env files excluded: prisma.config.ts requires DATABASE_URL while the API Dockerfile does not supply it during generation. Treat this as an unverified build concern, not a reproduced failure. Use a non-secret build-time placeholder if required, not production credentials. Application images currently run without a non-root USER declaration and contain development tooling; reduce privileges and runtime contents. Freeze an immutable release and rehearse forward migrations/application rollback with restore authority.

### 11. Human/external gates remain unproved

Repository legal pack explicitly says DRAFT, NOT APPROVED. Launch checklist has uncompleted staging, restore, external services, legal/operations and 20–50-seller beta gates. No new signed approval, deployed-host test results or beta exit evidence was supplied. This audit does not make a legal determination and did not change DNS, deploy or send messages.

## Recommended execution order

1. Fix security and recovery; secure Docker context; fix backup failure handling and alert delivery.
2. Verify code regressions and clean production-image build/boot using isolated data.
3. Deploy private staging; test cross-browser full commerce flow, authorization, uploads, load and security.
4. Prove external-service delivery, off-host restore, key rotation and rollback; obtain legal/operations approval.
5. Run closed beta, close blocking findings and record an explicit release decision.
6. Only then connect public DNS/open production traffic; monitor with a named rollback owner.

No numeric readiness percentage is assigned: unresolved high-impact launch gates cannot be averaged away by passing unit tests.
