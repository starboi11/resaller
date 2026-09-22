# Local security audit — 2026-09-20

## Verdict

Not a production security sign-off. Review of source, local read-only HTTP/browser probes and existing automated tests. Security findings below were documented, not silently changed. No credentials are included. No staging penetration test or exhaustive stored-XSS/role-pair authorization test was performed.

## Findings, in delivery order

1. **High, development exposure: password reset returns its bearer token.** `apps/api/src/auth/auth.service.ts`, `requestPasswordReset`, returns `developmentToken` whenever NODE_ENV is not production. An unauthenticated caller knowing a username can obtain a reset token when this development API is reachable. API currently listens on 0.0.0.0:4000. Restrict development to loopback and remove remote token disclosure; use a controlled out-of-band reset delivery. Production branch does not return the token. No real user's password/reset state was changed to demonstrate this.
2. **High, local network exposure: database/cache ports are published on all interfaces.** `docker-compose.yml` publishes 5432 and 6379; current Windows listeners include `::` for both. Redis has no application password in this development configuration. Bind development ports to loopback; verify firewall rules. Reachability from another machine was not tested. Standalone `compose.production.yml` does not publish these ports; do not assume the same is true when merging it with development Compose.
3. **High, admin hardening: permanent six-digit owner codes are reusable secrets, not independent MFA.** `auth.service.ts` supports static owner-code hashes alongside TOTP. No per-account/challenge failure counter was found in the reviewed verification flow. The global IP limit is not a replacement. Prefer real TOTP/passkeys and one-time recovery codes; add account/challenge attempt limits. This is a previously requested owner behavior and was not removed without discussion.
4. **Medium, rate-limit trust boundary:** `main.ts` uses `trustProxy: true` and keys the limiter by request.ip. A directly reachable API trusts client-supplied forwarding headers, allowing IP identity manipulation. Restrict trusted proxy hops/addresses, isolate the API and test actual proxy behavior. No brute-force/load attack was run.
5. **Medium, browser defense in depth:** local web and admin responses have neither CSP nor X-Frame-Options. Next configs and `infrastructure/Caddyfile` do not supply these protections. API Helmet protects API responses, not frontend HTML. Add a tested frontend CSP/frame-ancestors policy compatible with theme initialization and Next scripts. Missing CSP alone is not proof of XSS.
6. **Medium, catalog visibility inconsistency:** `assistant.service.ts`, `compare`, filters active/nondeleted listings but not active stores, unlike discovery. Known listing IDs can therefore surface metadata for a suspended store. Align comparison visibility with public catalog policy and add a suspended-store regression test. Source-confirmed predicate difference; not reproduced by modifying a real store.
7. **Medium, secret-scan coverage gap:** `scripts/secret-scan.mjs` lacks Cloudflare R2/Telegram patterns and does not inspect git history or ignored files. Passing it does not prove old chat-exposed credentials were revoked. Rotate those credentials through the provider and confirm revocation separately; never put them in audit output.

## Checks completed

- API Vitest: 22 files passed, 1 skipped; 50 tests passed, 1 skipped. Skipped/integration coverage is not counted as passed.
- Web typecheck passed.
- Production dependency audit: no known vulnerabilities reported by the registry at audit time. This does not cover unknown vulnerabilities or application logic.
- Existing secret scan passed for 354 candidate files, subject to the limitations above.
- SQL-like login input returned 401, not an authenticated session.
- Catalog SQL-like and script-like search inputs returned 200, not server errors. This alone does not establish complete SQLi safety.
- Browser reflected-XSS probe in marketplace search did not execute the supplied image error handler.
- Anonymous auth/me, admin/users and private attachment access returned 401.
- Login with an untrusted Origin returned 403.
- Reviewed Prisma usage: no unsafe raw-query API found in the searched source; tagged query usage observed. No user-controlled HTML sink identified in the reviewed rendering; the observed dangerouslySetInnerHTML theme script is static.
- Reviewed password hashing (scrypt), random hashed session tokens, role guards, private-media ownership checks, image re-encoding and production malware-scanner fail-closed behavior. These are source observations, not exhaustive runtime proofs.
- Heading typography/no-period checked at desktop and phone widths. No page-level horizontal overflow in the initial checks.

## Remaining security acceptance

Resolve findings above; then run isolated-database tests for every buyer/seller/admin ownership boundary, stored XSS across all user fields, CSRF/session rotation and expiration, 2FA brute-force controls, malicious uploads with ClamAV, SSE authorization/reconnect/load, concurrency, and real staging proxy/TLS/firewall configuration. Confirm backup restore, token revocation and logs without secrets. Do not treat local smoke tests as a guarantee of 100% security.
