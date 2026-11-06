# Resaller release audit — 2026-10-02

Scope: local source, isolated Docker databases, production builds, browser tests and read-only checks of the deployed site. No SSH, Cloudflare changes or production data writes were made. Existing user changes and secret files were preserved.

## Result

This source is prepared for staging validation. Global launch is not approved by this report: the live deployment still differs from the local release and external integrations need end-to-end evidence.

## Corrections in this audit

- Updated Next.js to 16.3.6, Nest packages to 12.0.2 and Fastify to 5.12.5; pinned vulnerable transitive dependencies. The dependency audit initially reported 12 findings; the final full audit reports no known vulnerabilities. This is a dependency advisory check, not proof that the application has no security defects.
- Added migration 19, `20261002090000_session_two_factor`: privileged sessions require an actual verified 2FA timestamp. Promoting an ordinary account no longer lets its old session access admin APIs. Blocked accounts cannot complete a pending 2FA challenge. Login has an additional username/IP limit.
- Made Redis rate-limit increment/expiry atomic. Notification discovery now advances beyond the first 100 rows; rediscovery preserves delayed retries and processing leases.
- Corrected multipart limits so a variant field after a file is accepted; product video uses its own 50 MB limit while images remain capped at 5 MB.
- Added failure handling to the order timeout worker and visible trust recalculation errors.
- Corrected admin `/` to return an actual HTTP 404 before streaming. `/owner` remains accessible with noindex; API role/2FA checks are the authorization boundary.
- Corrected Docker media paths for the non-root API account. Shared Corepack cache is included in the image so non-root startup does not download pnpm again. Web, admin and API can run pnpm with Docker networking disabled.
- Production services require deployment secrets and S3/email configuration. PostgreSQL/Redis have no public ports. API waits for healthy ClamAV; web/admin/API have health checks. Backup failure now stops the loop rather than being hidden by sleep.
- Restore drill validates the database target before mutation and refuses to replace an existing drill database. Backup output is encrypted/atomic with validated retention.
- Staging uses a separate project/directory. Production preflight accepts an explicitly preserved existing Compose project name to avoid accidentally creating a new empty database volume.
- Browser runs no longer reuse a possibly unrelated local server. DB integration tests require isolated test databases. CI includes deployment guards and Redis/DB concurrency tests; Linux visual comparisons remain pending Linux baseline review.
- Added source-only packaging, secret scanning without Git, per-file SHA-256 manifest and archive checksum. Actual env/secrets, user media, databases and build caches are excluded from the distributable source archive and remain in their existing locations.

## Evidence

| Check | Result and boundary |
| --- | --- |
| Lint/type checks | Passed across the monorepo |
| API tests | 80 passed, including real PostgreSQL final-stock concurrency and Redis retry/lease checks |
| Shared package tests | Passed; generated dist tests may be discovered too, so their counts are not presented as extra unique coverage |
| Deployment guard tests | 6 passed |
| Dependency audit | No known vulnerabilities in full dependency audit |
| Docker builds | API, web, admin and backup built successfully |
| Docker startup | Non-root API readiness 200 with database/Redis/queue/storage up; web login 200; admin root 404, owner 200/noindex |
| Migrations | 19 applied to isolated local databases; repeat migrate deploy reports no pending migrations |
| Backup/restore | Actual encrypted backup restored to disposable `resaller_restore_drill`, 19 migrations verified, only the created drill DB removed; off-host restore not yet tested |
| Malware/security smoke | 7 passed: role injection, cross-origin mutation, SQL-shaped login, HttpOnly/SameSite cookie, buyer-to-admin denial, actual upload EICAR rejection and logout revocation |
| Browser matrix | Final run: 158 passed, 7 skipped, 0 failed (5.0 minutes), using compiled API and production Next builds |
| Local SSE | 25 authenticated simultaneous streams receive data in Chromium commerce journey; not a sustained production load test |

Browser coverage includes Chromium, Firefox, WebKit, Android and iPhone emulation, authenticated owner login with TOTP, seller identity verification, direct verified-seller publishing, buyer checkout/review, media permissions, accessibility and visual comparisons. Some operator UI tests mock backend responses; they are not proof of every admin API mutation. Automated accessibility checks cover selected public pages, not every authenticated state or a human screen-reader audit.

The first matrix had transient API disconnects and a subsequent Windows WebKit numeric-input automation stall. The test now uses keyboard input for numeric fields, with bounded action timeouts; both its isolated WebKit commerce rerun and the final complete matrix passed. Seven skips comprise four Chromium-only video playback cases on other projects, two desktop shortcut cases on mobile, and the long Windows iPhone commerce journey. The retained local machine-readable evidence is `test-results/final-browser-report.json`; test traces and account fixture data are not included in the source ZIP.

## Live site differences observed read-only

`https://resaller.uz` responds 200 and API readiness responds 200. Anonymous protected user/cart/order/seller routes deny access. However, 9 smoke assertions failed: HTTP does not redirect to HTTPS on both origins, HSTS is missing on both origins, the admin root returns 200, `/owner` returns 404, admin noindex is missing, and new `/admin/overview` plus `/admin/listings` return 404. These observations confirm that the deployed site has not yet accepted this release. No production configuration was changed.

## Remaining release gates

1. Deploy this exact archive to isolated staging, using the handoff document, and verify all migrations and real R2 object upload/read/private access. Bucket readiness alone is insufficient.
2. Verify actual email/Telegram/push delivery and operator alert delivery. Disabled providers are not a completed integration.
3. Verify HTTPS redirects/HSTS at origin and Cloudflare, owner identity allowlist, private DB/Redis, off-host restore and rollback. Preserve existing volume names and encryption keys.
4. Capture Linux visual baselines and complete the long commerce journey on a real iPhone/Safari. Windows iPhone long multi-context journey remains skipped; other iPhone modules/layouts are exercised.
5. Run sustained SSE/upload/catalog load and staging penetration tests. Current fuzzy search can score a large candidate set in application memory; measure catalog-scale performance before wide launch.
6. Confirm legal documents, support/moderation operation and the 20–50 seller beta. Production AI provider pricing/retention/privacy remains an owner decision. Payment/escrow/settlement is still deferred.
7. Previously exposed credentials were preserved at the owner's request; they remain a credential-security risk. Rotation should be completed before public launch. Do not rotate the data encryption key without planning re-encryption of existing encrypted data.

No test suite can guarantee that no future bug exists. This report distinguishes verified local behavior from the remaining deployment and operational evidence.
