# Server handoff (staging first)

This repository can be deployed to a server, but production launch is **not approved** by a local test run. Follow `production-preflight.md` and `launch-checklist.md`; do not use credentials previously pasted into chat.

1. Provision an Ubuntu host with Docker Compose, SSH access, firewall rules for only SSH/80/443, and DNS for a staging hostname plus `admin.<staging-hostname>`. Keep PostgreSQL and Redis without published ports.
2. Clone the private repository into a restricted directory. Copy `.env.production.example` to a server-only `.env.staging`; replace every placeholder with new, unique secrets. Set `DOMAIN` and `STAGING_DOMAIN` for the staging host. Never commit this file.
3. Create `.secrets/metrics_token` and `.secrets/alertmanager_webhook_url` on the host. Restrict their permissions and match `metrics_token` to `METRICS_TOKEN`.
4. Validate configuration before starting containers:

   ```sh
   docker compose --env-file .env.staging -f compose.production.yml -f compose.staging.yml config --quiet
   ```

5. Boot staging, then verify migration and readiness:

   ```sh
   docker compose --env-file .env.staging -f compose.production.yml -f compose.staging.yml up -d --build
   docker compose --env-file .env.staging -f compose.production.yml -f compose.staging.yml exec -T api pnpm --filter @resaller/api db:migrate:deploy
   curl --fail https://<staging-hostname>/api/v1/health/ready
   ```

6. Run browser tests against staging (`E2E_WEB_URL`, `E2E_ADMIN_URL`, `E2E_API_URL`) with dedicated test accounts and database. Run R2 private/public access, email delivery, ClamAV EICAR, SSE load, alert routing, encrypted off-host backup, restore, and rollback drills. Record evidence and owners.
7. Obtain legal/owner approval for policies, support procedures, and the closed beta. Rotate all disclosed R2/admin credentials and confirm privileged 2FA enrollment. Do not reuse a static six-digit code as 2FA.
8. Only after the launch checklist is signed off, create a release tag/image, take a verified backup, deploy production, run the critical commerce smoke test, and then switch DNS. Keep a named rollback owner available.

Payment collection and settlement remain outside the MVP.
