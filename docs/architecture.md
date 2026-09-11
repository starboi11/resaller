# Architecture

Resaller is a pnpm/Turborepo modular monolith. `web` serves buyers and sellers, `admin` is a separately deployable privileged surface, and `api` is the authoritative REST backend under `/api/v1`.

PostgreSQL is the source of truth. Redis is an optional acceleration and temporary-state layer; correctness cannot depend on cached data. Payment collection, escrow, and settlement are intentionally outside the MVP boundary.

Domain modules own their rules. Order, policy, legal, dispute, and audit history is append-only or snapshot-based. Product or store edits never rewrite an existing order snapshot.
