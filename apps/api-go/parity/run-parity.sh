#!/usr/bin/env bash
# Starts the Node API (:4000) and the Go API (:4100) on one database with one
# environment file, creates two admin accounts, runs parity.mjs, stops both.
set -euo pipefail
ENV_FILE=${1:?usage: run-parity.sh <env-file>}
ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
set -a; . "$ENV_FILE"; set +a
# Limiter windows are shared through Redis; start every run from zero.
redis-cli -u "$REDIS_URL" --scan --pattern 'resaller:limit:*' | xargs -r redis-cli -u "$REDIS_URL" del >/dev/null
RUN_TAG=$(node -e "console.log(Date.now().toString(36).slice(-5))")
API_PORT=4000 node "$ROOT/apps/api/dist/main.js" > /tmp/parity-node.log 2>&1 & NODE_PID=$!
API_PORT=4100 "${GO_BIN:-/tmp/resaller-go}" > /tmp/parity-go.log 2>&1 & GO_PID=$!
trap 'kill $NODE_PID $GO_PID 2>/dev/null || true' EXIT
for _ in $(seq 1 40); do
  curl -sf http://127.0.0.1:4000/api/v1/health >/dev/null && curl -sf http://127.0.0.1:4100/api/v1/health >/dev/null && break
  sleep 0.5
done
HASH=$(node -e "const c=require('crypto');const s=c.randomBytes(16);const k=c.scryptSync('Parol123',s,64,{N:32768,r:8,p:1,maxmem:67108864});console.log('scrypt\$32768\$8\$1\$'+s.toString('base64url')+'\$'+k.toString('base64url'))")
for tag in nq7 gq7; do
  psql "$DATABASE_URL" -q -c "INSERT INTO \"User\" (id, \"publicId\", username, \"passwordHash\", \"updatedAt\") VALUES (gen_random_uuid(), 'clk${tag}${RUN_TAG}aaaaaaaaaaaaa', 'lk_${tag}_${RUN_TAG}', '$HASH', now())"
  psql "$DATABASE_URL" -q -c "INSERT INTO \"User\" (id, \"publicId\", username, \"passwordHash\", roles, \"updatedAt\") VALUES (gen_random_uuid(), 'cadm${tag}${RUN_TAG}aaaaaaaaaaaa', 'adm_${tag}_${RUN_TAG}', '$HASH', ARRAY['BUYER','SUPER_ADMIN']::\"Role\"[], now())"
done
RUN_TAG=$RUN_TAG node "$(dirname "$0")/parity.mjs" http://127.0.0.1:4000 http://127.0.0.1:4100
