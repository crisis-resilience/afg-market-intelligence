#!/usr/bin/env bash
#
# Restore a backup into an isolated throwaway database and verify core tables.
set -euo pipefail

REPO_DIR="${AFG_MARKET_DIR:-/home/azureuser/afg-market-intelligence}"
COMPOSE_FILE="${REPO_DIR}/docker-compose.prod.yml"
VERIFY_DB="afg_market_restore_verify"
ARCHIVE="${1:-}"

log()  { echo "[restore-check] $*"; }
fail() { echo "[restore-check] ERROR: $*" >&2; exit 1; }

[ -n "$ARCHIVE" ] || fail "usage: verify-backup.sh /path/to/afg-market-*.dump"
[ -r "$ARCHIVE" ] || fail "backup is not readable: ${ARCHIVE}"
[ -f "$COMPOSE_FILE" ] || fail "compose file not found at ${COMPOSE_FILE}"

cd "$REPO_DIR"

drop_verify_db() {
  docker compose -f "$COMPOSE_FILE" exec -T db sh -c \
    'dropdb --username="$POSTGRES_USER" --if-exists "'"$VERIFY_DB"'"' >/dev/null 2>&1 || true
}
trap drop_verify_db EXIT

drop_verify_db
log "creating isolated verification database"
docker compose -f "$COMPOSE_FILE" exec -T db sh -c \
  'createdb --username="$POSTGRES_USER" "'"$VERIFY_DB"'"'

log "restoring archive"
docker compose -f "$COMPOSE_FILE" exec -T db sh -c \
  'pg_restore --username="$POSTGRES_USER" --dbname="'"$VERIFY_DB"'" --no-owner --no-acl --exit-on-error' \
  < "$ARCHIVE"

table_count="$(
  docker compose -f "$COMPOSE_FILE" exec -T db sh -c \
    'psql --username="$POSTGRES_USER" --dbname="'"$VERIFY_DB"'" --tuples-only --no-align --command="
      SELECT count(*) FROM information_schema.tables
      WHERE table_schema = '\''public'\''
        AND table_name IN ('\''products'\'', '\''markets'\'', '\''indicators'\'', '\''pipeline_runs'\'');
    "'
)"

[ "$table_count" = "4" ] || fail "restored database is missing one or more core tables"
log "restore verified successfully; removing throwaway database"
