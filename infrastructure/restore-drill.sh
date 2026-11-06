#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"
: "${BACKUP_FILE:?BACKUP_FILE is required}"
: "${DATABASE_DRILL_URL:?DATABASE_DRILL_URL must point to resaller_restore_drill}"

admin_url="${DATABASE_ADMIN_URL:-$DATABASE_URL}"
drill_url="$DATABASE_DRILL_URL"
drill_db="resaller_restore_drill"
case "$drill_url" in
  */resaller_restore_drill|*/resaller_restore_drill\?*) ;;
  *) echo "DATABASE_DRILL_URL must target only resaller_restore_drill" >&2; exit 2 ;;
esac
admin_origin="${admin_url%%\?*}"
drill_origin="${drill_url%%\?*}"
if [ "${admin_origin%/*}" != "${drill_origin%/*}" ]; then
  echo "Admin and drill database URLs must use the same server and credentials" >&2
  exit 2
fi

case "$BACKUP_FILE" in
  /*) ;;
  *) echo "BACKUP_FILE must be an absolute path" >&2; exit 2 ;;
esac
test -f "$BACKUP_FILE"
test -f "$BACKUP_FILE.sha256"
(cd "$(dirname "$BACKUP_FILE")" && sha256sum -c "$(basename "$BACKUP_FILE").sha256")

temp_dir="$(mktemp -d)"
created_drill=false
cleanup() {
  if [ "$created_drill" = true ]; then
    psql "$admin_url" -v ON_ERROR_STOP=1 -c "DROP DATABASE $drill_db" || return 1
  fi
  rm -rf "$temp_dir"
}
trap cleanup EXIT
dump_file="$temp_dir/resaller.dump"

openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_KEY -in "$BACKUP_FILE" -out "$temp_dir/resaller.dump.gz"
gzip -d -c "$temp_dir/resaller.dump.gz" > "$dump_file"
pg_restore --list "$dump_file" > /dev/null
existing="$(psql "$admin_url" -v ON_ERROR_STOP=1 -tAc "SELECT count(*) FROM pg_database WHERE datname = '$drill_db'")"
if [ "$existing" != 0 ]; then
  echo "Refusing to replace an existing restore-drill database" >&2
  exit 2
fi
psql "$admin_url" -v ON_ERROR_STOP=1 -c "CREATE DATABASE $drill_db"
created_drill=true
actual_db="$(psql "$drill_url" -v ON_ERROR_STOP=1 -tAc 'SELECT current_database()')"
if [ "$actual_db" != "$drill_db" ]; then
  echo "Drill connection did not reach the disposable database" >&2
  exit 2
fi
pg_restore --exit-on-error --no-owner --no-privileges --dbname="$drill_url" "$dump_file"
psql "$drill_url" -v ON_ERROR_STOP=1 -c 'SELECT COUNT(*) AS applied_migrations FROM "_prisma_migrations"'
cleanup
created_drill=false
trap - EXIT
echo "Restore drill completed and disposable database removed"
