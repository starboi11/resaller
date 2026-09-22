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
- Privileged accounts use authenticator-app TOTP; permanent static codes are not accepted. Failed TOTP attempts are server-side rate limited.
- Password-reset bearer tokens never appear in API responses. A configured email provider sends a 15-minute, one-time recovery link only to an active account email endpoint.
- Production browser responses use CSP, clickjacking, MIME-sniffing, referrer and permissions headers. Production API access is private behind the configured reverse proxy.
- Session rotation and encryption-key rotation are separate operations. `DATA_ENCRYPTION_KEY` protects encrypted persistent data and must be planned/migrated before rotation.
