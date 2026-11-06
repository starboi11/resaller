# Account & admin verification — 2026-11-04

## Test suites
```
pnpm check EXIT=0
@resaller/types:test:       Tests  6 passed (6)
@resaller/validation:test:       Tests  6 passed (6)
@resaller/config:test:       Tests  12 passed (12)
@resaller/api:test:       Tests  138 passed | 2 skipped (140)
redis-queue (RUN_REDIS_TESTS=1):       Tests  2 passed (2)
ok  	github.com/resaller/api-go/internal/config	0.003s
ok  	github.com/resaller/api-go/internal/httpx	0.009s
ok  	github.com/resaller/api-go/internal/ids	0.140s
ok  	github.com/resaller/api-go/internal/secure	0.373s
Node/Go parity, admin 2FA on: 27/27 scenarios identical; interoperability OK + 34 PASS, 0 FAIL
Node/Go parity, admin 2FA off: 27/27 scenarios identical; interoperability OK + 34 PASS, 0 FAIL
Browser (account/admin): 27/27 browser checks passed
```

## Browser checks (Chromium 1280px / 360px)
```
PASS  [desktop] login asks only username and password
PASS  [desktop] register asks name, phone, username, password
PASS  [desktop] registration with a 6-digit password signs in
PASS  [desktop] account shows name, formatted phone and username
PASS  [desktop] account is simple: no channel form, devices folded
PASS  [desktop] account page fits 360px width
PASS  [desktop] checkout prefills name and phone from the account
PASS  [desktop] customer pages without JS errors
PASS  [desktop] guessed admin URL /owner is a plain 404 without the secret
PASS  [desktop] admin page opens at the secret path with its styles
PASS  [desktop] admin signs in with the 16-character password, no 2FA prompt
PASS  [desktop] admin page shows no password on screen
PASS  [desktop] admin pages without JS errors
PASS  [mobile] login asks only username and password
PASS  [mobile] register asks name, phone, username, password
PASS  [mobile] registration with a 6-digit password signs in
PASS  [mobile] after a swipe the "Hisob yaratish" button is tappable above the bottom nav
PASS  [mobile] account shows name, formatted phone and username
PASS  [mobile] account is simple: no channel form, devices folded
PASS  [mobile] account page fits 360px width
PASS  [mobile] checkout prefills name and phone from the account
PASS  [mobile] customer pages without JS errors
PASS  [mobile] guessed admin URL /owner is a plain 404 without the secret
PASS  [mobile] admin page opens at the secret path with its styles
PASS  [mobile] admin signs in with the 16-character password, no 2FA prompt
PASS  [mobile] admin page shows no password on screen
PASS  [mobile] admin pages without JS errors
27/27 browser checks passed
```

## Fuzzing the admin host
```
292 common admin paths, redirects followed: 0 non-404, 0 responses containing the secret
<secret>/owner 200; /owner 404; / 404; bare <secret> 404
Caddy 2.10 gate: only <secret>/* forwarded; /owner, /, <secret>, /x<secret>/owner, <secret>/../owner -> 404
```

The secret path and admin password used here were throwaway test values; neither appears in this report.
