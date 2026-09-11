# Resaller.uz

Mobile-first, multi-seller marketplace implemented as a modular monolith.

## Prerequisites

- Node.js 24 LTS-compatible runtime
- Corepack / pnpm 12
- Docker Desktop

## Start locally

1. Copy `.env.example` to `.env` and replace the development secrets.
2. Run `docker compose up -d`.
3. Run `pnpm install`.
4. Run `pnpm dev`.

Services: buyer/seller web `:3000`, admin `:3001`, API `:4000/api/v1`, PostgreSQL `:5432`, Redis `:6379`.

## Quality gate

Run `pnpm check`. CI executes lint, typecheck, tests, and builds in that order.

See `docs/architecture.md`, `docs/security.md`, and `docs/development.md` before contributing.

Current implementation coverage and production blockers are tracked in `docs/implementation-status.md` and `docs/launch-checklist.md`.
Foundation-first delivery order is tracked in `docs/foundation-roadmap.md`; final frontend work begins after stages F1–F6 are closed.
The complete A–D delivery contract starts at `docs/master-roadmap.md`.
