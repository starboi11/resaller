# Owner-only checks (2026-11-03)

Reproduces the verification of the owner-only rules on an ISOLATED local
database (`resaller_local_e2e`). Never point these scripts at production.

1. `seed-users.sh`, then `seed-stores.sh` — create four accounts (password
   `Parol123`): `egasi` (owner of store `resaller`, deliberately NOT
   ID-verified), `eski_sotuvchi` (old verified SELLER with its own store
   `eski_dokon`), `eski_azo` (former STORE_MANAGER of `resaller`; teams are
   retired, so it must get nothing) and `xaridor` (buyer), plus products.
2. Copy `local-test.env.example`, set real random secrets, keep
   `OWNER_STORE_USERNAME=resaller`. This value exists only in the seeded TEST
   database; it is not a production value. For production, read the real owner
   store username from the production database.
3. Start the API (`apps/api/dist/main.js`) and `next start` for the web app.
4. `http-checks.sh` — status codes per role for management endpoints and the
   buyer catalogue.
5. `browser-checks.mjs` — Chromium, desktop 1280px and phone 360px, 38 checks;
   screenshots go to `$SHOTS_DIR`. Needs `@sparticuz/chromium` and
   `puppeteer-core`. Real browser security stays on (no `--disable-web-security`),
   otherwise Chrome sends no Origin header and the API correctly blocks login.

Expected results and the screenshots of the 2026-11-03 run:
`docs/verification/2026-11-03-owner-only/`.
