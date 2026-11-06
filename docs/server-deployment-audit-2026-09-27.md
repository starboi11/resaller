# Resaller server update — 2026-09-27

Scope: only `/home/topchik/resaller-deploy/resaller` and Docker services with the `resaller` Compose project. The two `resaller-server-ready*.zip` files and other hosted projects were not modified.

## Deployed

- Source from Git commit `2b25aa5` was packaged from tracked files and checksum-verified after transfer. Uncommitted marketing/visual experiments were not deployed.
- Existing `.env.server`, `compose.server.yml`, PostgreSQL/Redis/media volumes were preserved.
- Before deployment, a source archive and PostgreSQL custom-format dump were saved in `/home/topchik/resaller-deploy/backups/` with owner-only permissions. The dump's table-of-contents was readable through `pg_restore -l`.
- API, web and admin images built successfully. Only their Resaller containers were recreated. All three were running after deployment; the API applied no pending migrations, and local readiness returned HTTP 200.

## Verification

- `pnpm check` passed locally: schema validation, secret scan, lint, typecheck, unit tests and production builds. The optional PostgreSQL integration test was skipped because the local database was not running.
- A separate local Playwright rerun could not start because local PostgreSQL refused port 5432. This is an environment gap, not a passing browser result.
- Against deployed `https://resaller.uz`, the read-only public Playwright suite passed 15 tests across desktop Chromium and Android emulation; one desktop-only shortcut test was intentionally skipped on mobile.
- The live smoke check passed HTTPS home/admin, public catalog, anonymous authorization boundaries and readiness. It failed four transport checks: HTTP returned 200 instead of redirecting to HTTPS on both hosts, and HSTS was absent on both HTTPS hosts.

## Remaining blockers

1. Configure HTTPS redirection and HSTS at the Cloudflare zone/edge. The origin serves Resaller through a port-80-only Nginx vhost; changing origin redirects without checking Cloudflare TLS mode could create a redirect loop. No shared Nginx or unrelated service configuration was changed.
2. Run authenticated buyer/seller/admin and private-media end-to-end tests against isolated staging. The deployed public suite did not prove those journeys, and no production customer orders were mutated for testing.
3. The server's Resaller Compose configuration still selects local media storage, not R2. Switch only after fresh, private credentials and an end-to-end upload/download authorization test.
4. Complete legal, backup restore, alerting, security and beta launch gates before calling the site production-ready.
