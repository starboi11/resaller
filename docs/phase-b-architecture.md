# Phase B — Architecture contract

## System boundary

```text
Browser → Web/Admin → versioned API → PostgreSQL
                                  ├→ Redis
                                  └→ Media adapter
```

- Next.js serves buyer/seller and separate admin applications.
- NestJS with Fastify owns validation, authorization, business transitions, and audit decisions.
- PostgreSQL is the authoritative store for identity, commerce, legal snapshots, and audit history.
- Redis is not a source of truth; it supports rate limits, cache, presence, queues, and temporary state.

## Integrity boundary

- Public IDs are separate from immutable internal UUIDs.
- Money uses integer minor units, never floating point.
- UTC timestamps are mandatory.
- Foreign keys and DB checks protect critical invariants.
- Checkout, stock, and order transitions use serializable transactions where races matter.
- Production schema changes occur only through committed migrations.

## Security boundary

- Passwords use salted scrypt hashes.
- Browser sessions use random opaque tokens; only token hashes are stored.
- Password-reset tokens are random, stored only as hashes, expire after 15 minutes, and can be consumed once; a successful reset revokes every existing session.
- Authenticated clients can atomically rotate a session token; the replaced token becomes invalid immediately.
- Privileged admin roles must complete TOTP enrollment or verification before a session is issued; TOTP secrets use authenticated encryption at rest and challenges expire after five minutes.
- Session context stores a keyed IP fingerprint rather than a raw IP; users can inspect and revoke active sessions.
- Failed and previously unseen login contexts create security events; new contexts create user-visible alerts.
- HttpOnly, Secure, SameSite cookies are used.
- Every protected API operation resolves the session and checks ownership/role server-side.
- Validation is allow-listed; CORS, CSP, origin checking, rate limits, and safe error envelopes are enabled.
- Logs redact cookies, authorization data, and credentials.
- Admin mutations record actor, target, action, reason, timestamp, and metadata.

## Deployment boundary

- Caddy terminates HTTPS and routes web/admin/API traffic.
- PostgreSQL and Redis are not published publicly in production.
- API startup applies committed migrations before serving.
- Media and database data use persistent volumes until external managed storage is configured.
- Production launch additionally requires monitoring, encrypted backups, restore evidence, rollback rehearsal, and penetration testing.
