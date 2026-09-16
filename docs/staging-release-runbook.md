# Staging release runbook

There are currently 17 Prisma migration directories. Staging must apply all of them with `prisma migrate deploy`; no migration is marked complete from configuration alone.

## Required owner inputs

- A Linux staging host reachable over SSH and its hostname.
- `STAGING_DOMAIN` with DNS pointing to that host.
- A new R2 Object Read & Write token limited to `resaller-media` and `resaller-private-media`.
- A separate token limited to `resaller-encrypted-backups`.
- An alert receiver address/webhook and a production AI provider decision.

Never paste these values into chat or Git. Put them only in `/opt/resaller/.env.staging`; put the metrics token in `/opt/resaller/.secrets/metrics_token` with mode `0600`.

## Host hardening

1. Create a non-root deploy user with SSH keys and disable password SSH login.
2. Allow inbound TCP 22 from the owner's fixed IP only, and TCP 80/443 publicly.
3. Deny every other inbound port. PostgreSQL 5432, Redis 6379, ClamAV 3310, Prometheus 9090 and Alertmanager 9093 have no Compose host publishing.
4. Enable unattended security updates and provider-level firewall rules matching the host firewall.

## Deployment

Run `scripts/deploy-staging.ps1 -HostName <ssh-host>`. The deployment uses both Compose files, rebuilds services, waits for PostgreSQL/Redis health and applies every pending migration before API startup.

Verify:

- `https://<staging-domain>/api/v1/health/ready` reports every dependency up.
- Caddy serves a valid HTTPS certificate and HTTP redirects to HTTPS.
- Anonymous R2 object URLs return denied.
- Product media and verification documents upload into their separate private buckets.
- Prometheus sees `resaller-api` as up and Alertmanager receives a controlled test alert.

## Evidence gates

- Run the complete Playwright matrix (Chromium, Firefox, WebKit, Pixel 7 and iPhone 13).
- Run `pnpm test:clamav` inside the network containing ClamAV. The harmless EICAR test signature must return `FOUND`.
- Run `pnpm test:sse-load` with a short-lived staging test session; archive the JSON result.
- Trigger the `Staging security checks` workflow for an OWASP ZAP baseline.
- Create an encrypted backup, confirm its off-host R2 copy, restore it into the disposable drill database, then remove the drill database.
- Test rollback by deploying the previous Git commit without reversing already-applied database migrations.

Production and DNS remain blocked until every item above has timestamped evidence.
