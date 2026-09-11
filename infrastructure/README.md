# Infrastructure

Development dependencies are defined in the root Compose file. Production manifests will live here and must keep PostgreSQL and Redis off the public network, terminate HTTPS at a reverse proxy, and provide backups, health checks, log rotation, and rollback.
