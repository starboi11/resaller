# Account & admin checks (2026-11-04)

Isolated test stack only. Start API, web (`next start`) and the admin server
(`ADMIN_BASE_PATH=<test path> ADMIN_REQUIRE_BASE_PATH=true node apps/admin/server.mjs`),
with `ADMIN_TWO_FACTOR_REQUIRED=false` for the API. Create a test admin with
`node apps/api/dist/scripts/admin-account.js create sayt_admin > out.txt` and
extract the password into a file with mode 600 — never print it.

    ADMIN_SECRET_FILE=… ADMIN_PASSWORD_FILE=… SHOTS_DIR=… node browser-checks.mjs

27 checks at 1280px and 360px. The site uses smooth scrolling, so the script
scrolls a button to the middle before clicking (Puppeteer would otherwise tap
the very bottom edge under the fixed bottom nav); a separate touch-swipe check
proves the register button is tappable above the nav for a real finger.
