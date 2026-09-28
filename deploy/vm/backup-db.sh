#!/usr/bin/env bash
#
# Create a validated PostgreSQL custom-format backup and optionally upload it
# to a private Azure Blob container with AzCopy and the VM's managed identity.
set -euo pipefail

REPO_DIR="${AFG_MARKET_DIR:-/home/azureuser/afg-market-intelligence}"
COMPOSE_FILE="${REPO_DIR}/docker-compose.prod.yml"
BACKUP_DIR="${AFG_MARKET_BACKUP_DIR:-${HOME}/afg-market-backups}"
RETENTION_DAYS="${AFG_MARKET_BACKUP_RETENTION_DAYS:-7}"
AZURE_STORAGE_CONTAINER_URL="${AZURE_STORAGE_CONTAINER_URL:-}"

log()  { echo "[backup] $*"; }
fail() { echo "[backup] ERROR: $*" >&2; exit 1; }

[[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] \
  || fail "AFG_MARKET_BACKUP_RETENTION_DAYS must be a non-negative integer"
[ -f "$COMPOSE_FILE" ] || fail "compose file not found at ${COMPOSE_FILE}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

exec 9>"${BACKUP_DIR}/.backup.lock"
flock -n 9 || fail "another database backup is already running"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
filename="afg-market-${timestamp}.dump"
archive="${BACKUP_DIR}/${filename}"
partial="${archive}.partial"
checksum="${archive}.sha256"

cleanup() {
  rm -f "$partial"
}
trap cleanup EXIT

cd "$REPO_DIR"
log "creating ${filename}"
docker compose -f "$COMPOSE_FILE" exec -T db sh -c \
  'pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom --no-owner --no-acl' \
  > "$partial"

[ -s "$partial" ] || fail "pg_dump produced an empty archive"
docker compose -f "$COMPOSE_FILE" exec -T db pg_restore --list < "$partial" >/dev/null \
  || fail "pg_restore could not read the generated archive"

chmod 600 "$partial"
mv "$partial" "$archive"
(cd "$BACKUP_DIR" && sha256sum "$filename" > "${filename}.sha256")
log "validated backup: ${archive}"

if [ -n "$AZURE_STORAGE_CONTAINER_URL" ]; then
  command -v azcopy >/dev/null 2>&1 \
    || fail "AZURE_STORAGE_CONTAINER_URL is set but azcopy is not installed"
  log "authenticating AzCopy with the VM managed identity"
  azcopy login --identity >/dev/null
  destination="${AZURE_STORAGE_CONTAINER_URL%/}"
  azcopy copy "$archive" "${destination}/${filename}" --overwrite=false
  azcopy copy "$checksum" "${destination}/${filename}.sha256" --overwrite=false
  log "uploaded backup and checksum to Azure Blob Storage"
else
  log "warning: AZURE_STORAGE_CONTAINER_URL is unset; backup exists only on this VM"
fi

find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name 'afg-market-*.dump' -o -name 'afg-market-*.dump.sha256' \) \
  -mtime "+${RETENTION_DAYS}" -delete

log "backup complete"
