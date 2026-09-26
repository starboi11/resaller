# Production preflight

Production is intentionally blocked by Compose until the values below are supplied outside Git in the server's protected `.env.production` (or secret manager). Never paste them into chat, a source file, or GitHub.

Required values:

- `DOMAIN`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `SESSION_SECRET`, `DATA_ENCRYPTION_KEY`, `METRICS_TOKEN`, `BACKUP_ENCRYPTION_KEY`
- R2: `S3_ENDPOINT`, `S3_BUCKET`, `S3_PRIVATE_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
- email delivery: `EMAIL_WEBHOOK_URL`, `EMAIL_WEBHOOK_TOKEN`
- off-host backup: `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`

Private files required on the host, excluded from Git and Docker build context:

- `.secrets/metrics_token` — exactly the same value as `METRICS_TOKEN`
- `.secrets/alertmanager_webhook_url` — an HTTPS webhook owned by the operator/on-call system

Before first production boot:

1. Create a new, bucket-scoped R2 key; revoke any key that was ever exposed.
2. Create a dedicated 32+ character `DATA_ENCRYPTION_KEY`. Do not change it casually: it encrypts TOTP and notification endpoints. `SESSION_SECRET` rotates browser sessions; it is separate.
3. Configure the email webhook to actually send the `PASSWORD_RESET` payload's `resetUrl`. A user needs an active email endpoint in Account before they can use email recovery.
4. Configure the alert webhook and send a controlled test alert. Production should not be started if alert routing is absent.
5. Run `docker compose --env-file .env.production -f compose.production.yml config --quiet`; then build/boot staging first.
6. In staging, verify `/api/v1/health/ready` is HTTP 200, private R2 access is denied without authorization, public media is available only for active listings, and ClamAV rejects EICAR.
7. Create an encrypted off-host backup, run `infrastructure/restore-drill.sh` against only its disposable database, then rehearse application rollback.
8. Record the tested Git commit and deploy that exact commit/image. After the server rebuild, run `LIVE_ORIGIN=https://resaller.uz pnpm test:live-smoke`; both root and admin HTTP URLs must redirect to HTTPS and both HTTPS responses must include HSTS. Compare the live account and seller screens with the same commit's browser evidence; a passing local suite does not verify an older server build.
9. With dedicated staging test identities, verify browser cookie persistence after reload and the real R2 upload → reload → read path for an unpublished seller draft, then approval → public buyer image access. A bucket `HeadBucket` readiness result is not an object round-trip test.

Do not rotate `DATA_ENCRYPTION_KEY` after accounts enable 2FA without a planned ciphertext re-encryption migration. Do not change the production `SESSION_SECRET` before revoking all active sessions deliberately.
