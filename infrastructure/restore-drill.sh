#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"
: "${BACKUP_FILE:?BACKUP_FILE is required}"

case "$BACKUP_FILE" in
  /*) ;;
  *) echo "BACKUP_FILE must be an absolute path" >&2; exit 2 ;;
esac
test -f "$BACKUP_FILE"
test -f "$BACKUP_FILE.sha256"
(cd "$(dirname "$BACKUP_FILE")" && sha256sum -c "$(basename "$BACKUP_FILE").sha256")

admin_url="${DATABASE_ADMIN_URL:-$DATABASE_URL}"
drill_db="resaller_restore_drill"
temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT
dump_file="$temp_dir/resaller.dump"

openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_KEY -in "$BACKUP_FILE" | gzip -d > "$dump_file"
psql "$admin_url" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $drill_db WITH (FORCE)"
psql "$admin_url" -v ON_ERROR_STOP=1 -c "CREATE DATABASE $drill_db"
drill_url="${DATABASE_DRILL_URL:?DATABASE_DRILL_URL must point to resaller_restore_drill}"
case "$drill_url" in
  */resaller_restore_drill|*/resaller_restore_drill\?*) ;;
  *) echo "DATABASE_DRILL_URL must target only resaller_restore_drill" >&2; exit 2 ;;
esac
pg_restore --exit-on-error --no-owner --no-privileges --dbname="$drill_url" "$dump_file"
psql "$drill_url" -v ON_ERROR_STOP=1 -c 'SELECT COUNT(*) AS applied_migrations FROM "_prisma_migrations"'
psql "$admin_url" -v ON_ERROR_STOP=1 -c "DROP DATABASE $drill_db WITH (FORCE)"
echo "Restore drill completed and disposable database removed"
