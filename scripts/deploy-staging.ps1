param(
  [Parameter(Mandatory = $true)][string]$HostName,
  [string]$RemotePath = '/opt/resaller'
)

$ErrorActionPreference = 'Stop'
if ($HostName -notmatch '^[a-zA-Z0-9._@-]+$') { throw 'Invalid SSH host name.' }
if (-not $RemotePath.StartsWith('/opt/')) { throw 'RemotePath must stay under /opt/.' }

ssh $HostName "cd '$RemotePath' && git pull --ff-only && docker compose --env-file .env.staging -f compose.production.yml -f compose.staging.yml pull && docker compose --env-file .env.staging -f compose.production.yml -f compose.staging.yml up -d --build && docker compose --env-file .env.staging -f compose.production.yml -f compose.staging.yml exec -T api pnpm --filter @resaller/api db:migrate:deploy"
if ($LASTEXITCODE -ne 0) { throw 'Staging deployment failed.' }
