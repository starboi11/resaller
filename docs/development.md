# Development conventions

Environments are `development`, `test`, `staging`, and `production`; each has isolated data and secrets. Configuration is parsed once at startup and invalid configuration fails fast.

Errors use a stable code, human-safe message, request ID, and optional field details. Internal causes and secrets are never returned to clients. Structured logs use request IDs and UTC timestamps.

Branches are short-lived and reviewed. Schema changes are migration-only. A change is complete when lint, typecheck, tests, and build pass.
# Production container validation

Copy `.env.production.example` to a private `.env.production`, replace every value, then validate with:

```sh
docker compose --env-file .env.production -f compose.production.yml config --quiet
```

Production startup applies committed Prisma migrations before the API begins accepting traffic. PostgreSQL and Redis are intentionally not published to the host network.
