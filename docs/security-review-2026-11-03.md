# Security review 2026-11-03 — Go API phase 1: findings and resolution

Source: external review of `apps/api-go` (phase 1). Each finding was checked
against the code and deployment, fixed in BOTH the Go and the Node API (the Go
code reproduced Node behaviour, so Node had the same weaknesses), and verified.

| # | Finding | Assessment | Resolution | Evidence |
|---|---|---|---|---|
| F1 | Rate limits keyed on the left-most `X-Forwarded-For` (spoofable) | Code weakness confirmed in Go and Node. Not exploitable through the current proxy: Caddy ≥2.5 discards client `X-Forwarded-*` unless `trusted_proxies` is set, and compose uses Caddy 2.10 without it. Would become exploitable with a CDN in front or the API exposed directly. | Both APIs trust exactly one hop and read the right-most entry (Go `ClientIP`, Node `trustProxy: hop === 0`). Added a per-account login window (30 / 15 min, any address) so the limit no longer depends on network identity. `LOGIN_RATE_LIMITED` security event. Caddyfile documents the trust rule. | Parity: 11 registrations with rotating spoofed left-most hops → 10 accepted, 11th 429, on both. Sessions keyed on the real right-most address. 30 failed logins from 30 addresses → the 31st with the correct password is refused on both. |
| F2 | Username enumeration by login timing | Confirmed in Go and Node (`||` short-circuit skipped scrypt for missing users). | Missing/inactive accounts are verified against a real dummy scrypt hash: exactly one verification per attempt. | Median login time, real vs missing user: Node 96 / 99 ms, Go 86 / 86 ms. Node unit test asserts one verification for a missing user. |
| F3 | No dedicated limit on register / password-reset request | Confirmed. | Register: 10 per address per hour → 429. Reset: 3 per account and 10 per address per 15 min; over the limit the answer stays `{accepted:true}` and nothing is sent (no flooding, no enumeration). | Parity: 5 reset requests → 5 identical 202 answers, 3 reached the account, on both. Node unit tests for both limits. |
| F4 | Global HTTP limiter is per process | Confirmed (info). | Go: Redis-backed cluster-wide window (`resaller:limit:http:<hmac(ip)>`), falling back to the in-process window only if Redis is unreachable. Node keeps @fastify/rate-limit in memory until it is retired. | Go unit test for the window; fallback path covered by the nil-limiter test. |

Trade-off to know: the per-account login window means 30 wrong guesses in
15 minutes temporarily lock that account for everyone, including its owner.
That is the intended cost of making online guessing independent of IP; the
owner can still reset the password.

Verification run: Node `vitest` 136 passed (2 skipped, DB tests on), Go
`go test ./...` passed, parity 24/24 scenarios identical with TRUST_PROXY=true.
