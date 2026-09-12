#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"

backup_dir="${BACKUP_DIR:-/backups}"
retention_days="${BACKUP_RETENTION_DAYS:-14}"
mkdir -p "$backup_dir"
umask 077
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$backup_dir/resaller-$stamp.dump.gz.enc"

pg_dump --format=custom --no-owner --no-privileges "$DATABASE_URL" \
  | gzip -9 \
  | openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_ENCRYPTION_KEY -out "$target"
(cd "$backup_dir" && sha256sum "$(basename "$target")" > "$(basename "$target").sha256")
find "$backup_dir" -type f -name 'resaller-*.dump.gz.enc*' -mtime "+$retention_days" -delete
echo "Encrypted backup created: $target"
