#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"

backup_dir="${BACKUP_DIR:-/backups}"
retention_days="${BACKUP_RETENTION_DAYS:-14}"
case "$retention_days" in
  ''|*[!0-9]*|0) echo "BACKUP_RETENTION_DAYS must be a positive integer" >&2; exit 2 ;;
esac
umask 077
mkdir -p "$backup_dir"
stamp="$(date -u +%Y%m%dT%H%M%SZ)-$$"
target="$backup_dir/resaller-$stamp.dump.gz.enc"
temp_dir="$(mktemp -d "$backup_dir/.backup.XXXXXX")"
trap 'rm -rf "$temp_dir"' EXIT
dump_file="$temp_dir/resaller.dump"
compressed_file="$temp_dir/resaller.dump.gz"
encrypted_file="$temp_dir/resaller.dump.gz.enc"

# Never pipe backup stages together: POSIX sh cannot reliably report a failed
# pg_dump from a pipeline. Publish the artifact only after every stage passes.
pg_dump --format=custom --no-owner --no-privileges --file="$dump_file" "$DATABASE_URL"
test -s "$dump_file"
gzip -9 -c "$dump_file" > "$compressed_file"
test -s "$compressed_file"
openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_ENCRYPTION_KEY -in "$compressed_file" -out "$encrypted_file"
test -s "$encrypted_file"
mv "$encrypted_file" "$target"
(cd "$backup_dir" && sha256sum "$(basename "$target")" > "$(basename "$target").sha256")
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  : "${BACKUP_S3_ENDPOINT:?BACKUP_S3_ENDPOINT is required when BACKUP_S3_BUCKET is set}"
  aws s3 cp "$target" "s3://$BACKUP_S3_BUCKET/$(basename "$target")" --endpoint-url "$BACKUP_S3_ENDPOINT" --only-show-errors
  aws s3 cp "$target.sha256" "s3://$BACKUP_S3_BUCKET/$(basename "$target").sha256" --endpoint-url "$BACKUP_S3_ENDPOINT" --only-show-errors
fi
find "$backup_dir" -type f -name 'resaller-*.dump.gz.enc*' -mtime "+$retention_days" -delete
echo "Encrypted backup created: $target"
