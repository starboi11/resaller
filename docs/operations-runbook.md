# Operations runbook

## Health and metrics

- Liveness: `GET /api/v1/health`
- Readiness: `GET /api/v1/health/ready` checks PostgreSQL, Redis and queue access.
- Prometheus metrics: `GET /api/v1/metrics` with `Authorization: Bearer $METRICS_TOKEN` when configured.
- Import `infrastructure/prometheus-alerts.yml` into the production Prometheus/Alertmanager installation.

Logs are structured JSON and redact authorization, cookies and set-cookie values. Alert routing and retention must be selected by the production operator.

## Encrypted backup

Run `infrastructure/backup.sh` daily from a PostgreSQL client container or protected host. It requires `DATABASE_URL`, `BACKUP_ENCRYPTION_KEY`, and a durable `BACKUP_DIR`. Copy encrypted backups to storage outside the application server. The default local retention is 14 days.

Run `infrastructure/restore-drill.sh` monthly against a disposable PostgreSQL instance. `DATABASE_DRILL_URL` is rejected unless it points to the exact `resaller_restore_drill` database. Record the timestamp, backup checksum, migration count and result. Never use production as the drill target.

## Rollback

Application rollback uses the previously verified immutable container images. Database migrations are forward-only: restore from the pre-release encrypted backup if a data migration cannot be corrected forward. Verify readiness, one buyer checkout, one seller acceptance and one admin audit event before reopening traffic.
