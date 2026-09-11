# Security baseline

- Server-side authorization is mandatory; UI visibility is not authorization.
- Browser authentication uses opaque server-side sessions in HttpOnly, Secure, SameSite cookies.
- Secrets are supplied through the environment and never committed.
- Logs redact credentials, cookies, authorization headers, tokens, and private content.
- Every admin and store-team mutation carries actor, target, reason, timestamp, and metadata where applicable.
- Inputs are allow-listed and validated at API boundaries. Uploads require content sniffing, size/dimension limits, random names, and private-object authorization.
- Order transitions and stock reservations use transactions and idempotency controls.
- State-changing browser requests are rejected when their `Origin` is outside the configured allow-list, providing an additional CSRF boundary alongside SameSite cookies.
- CI rejects high/critical production dependency advisories. Staging penetration testing remains a launch gate.
