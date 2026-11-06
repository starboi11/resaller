param(
  [Parameter(Mandatory = $true)][string]$HostName,
  [string]$RemotePath = '/opt/resaller-staging'
)

$ErrorActionPreference = 'Stop'
if ($HostName -notmatch '^[a-zA-Z0-9._@-]+$') { throw 'Invalid SSH host name.' }
if ($RemotePath -notmatch '^/(opt|home)/[a-zA-Z0-9_./-]+$' -or $RemotePath.Contains('..') -or $RemotePath -notmatch '/resaller-staging$') { throw 'Use a dedicated resaller-staging directory under /opt or /home.' }

# Deploy the already-uploaded, reviewed source. Never pull an unknown revision or
# reuse the production Compose project/volumes. Backup precedes migration.
$compose = 'docker compose -p resaller-staging --env-file .env.staging -f compose.production.yml -f compose.staging.yml'
ssh $HostName "cd '$RemotePath' && node scripts/server-preflight.mjs --staging && $compose build && $compose up -d --wait postgres redis clamav && $compose run --rm --no-deps backup resaller-backup && $compose run --rm --no-deps api pnpm --filter @resaller/api db:migrate:deploy && $compose up -d --wait"
if ($LASTEXITCODE -ne 0) { throw 'Staging deployment failed.' }
