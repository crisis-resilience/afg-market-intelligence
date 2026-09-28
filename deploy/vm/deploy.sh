#!/usr/bin/env bash
#
# AFG Market Diversification Tool — production deploy, invoked over SSH by the
# CI deploy key.
#
# Installed on the VM at /usr/local/bin/afg-market-deploy and pinned as the
# forced command for the CI key in ~/.ssh/authorized_keys, so that key cannot
# open a shell or run anything else — if it leaks, it can only deploy.
#
# The only thing the caller controls is SSH_ORIGINAL_COMMAND, which must be the
# commit SHA to deploy. Deploying an explicit SHA (rather than whatever main
# points at now) pins production to exactly the commit CI tested, even if main
# has moved on while the pipeline was running.
#
# See docs/VM_DEPLOYMENT.md for first-time VM setup.
#
set -euo pipefail

REPO_DIR="${AFG_MARKET_DIR:-/home/azureuser/afg-market-intelligence}"
COMPOSE_FILE="docker-compose.prod.yml"
HEALTH_RETRIES=45
HEALTH_DELAY=2

# The images CI built, tested and published for this commit. Production runs
# those artifacts rather than rebuilding from source here: a rebuild on the VM
# produces a THIRD image — different base layer, different pip/npm resolution,
# built on a different day — so the thing that passed CI was never the thing
# that ran. It also keeps the build off the box that is serving traffic.
#
# Both are tagged with the full commit SHA by the "Build and publish images"
# job. Overridable for a fork or a private mirror.
BACKEND_IMAGE_REPO="${AFG_MARKET_BACKEND_IMAGE_REPO:-ghcr.io/crisis-resilience/afg-market-intelligence/backend}"
FRONTEND_IMAGE_REPO="${AFG_MARKET_FRONTEND_IMAGE_REPO:-ghcr.io/crisis-resilience/afg-market-intelligence/frontend}"

log()  { echo "[deploy] $*"; }
fail() { echo "[deploy] ERROR: $*" >&2; exit 1; }

# Never eval or interpolate this into a command — validate it is a bare SHA.
TARGET_SHA="${SSH_ORIGINAL_COMMAND:-}"
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] \
  || fail "expected a 40-character commit SHA, got: '${TARGET_SHA}'"

cd "$REPO_DIR" || fail "repo not found at ${REPO_DIR}"

read_env() {
  sed -n "s/^${1}=//p" .env 2>/dev/null | tr -d "\"'" | head -1
}

# Refuse insecure or incomplete production configuration before touching the
# currently-running stack. Compose catches missing values, but not placeholders,
# plain HTTP, or a secret file readable by other local users.
[ -f .env ] || fail ".env does not exist — see docs/VM_DEPLOYMENT.md section 4"
[ "$(stat -c '%a' .env)" = "600" ] \
  || fail ".env must have mode 600 (run: chmod 600 .env)"

POSTGRES_PASSWORD="$(read_env POSTGRES_PASSWORD)"
DATABASE_URL="$(read_env DATABASE_URL)"
COMTRADE_API_KEY="$(read_env COMTRADE_API_KEY)"
SITE_ADDRESS="$(read_env SITE_ADDRESS)"

[ "${#POSTGRES_PASSWORD}" -ge 24 ] && [ "$POSTGRES_PASSWORD" != "postgres" ] \
  || fail "POSTGRES_PASSWORD must be a non-default value of at least 24 characters"
[ -n "$DATABASE_URL" ] && [[ "$DATABASE_URL" != *"postgres:postgres@"* ]] \
  || fail "DATABASE_URL is missing or contains the default database password"
[ -n "$COMTRADE_API_KEY" ] && [ "$COMTRADE_API_KEY" != "your_api_key_here" ] \
  || fail "COMTRADE_API_KEY is missing or still set to the placeholder"
[[ "$SITE_ADDRESS" == https://* ]] \
  || fail "SITE_ADDRESS must be an https:// URL in production"

# Where to probe for health. This has to follow SITE_ADDRESS: once a domain is
# configured Caddy serves only that hostname and redirects HTTP to HTTPS, so a
# request to http://localhost would 404 and this script would roll back a
# perfectly healthy deploy. --resolve keeps the request on the loopback
# interface while still sending the hostname the certificate was issued for,
# so this works without depending on NAT hairpinning.
CURL_RESOLVE=()
case "$SITE_ADDRESS" in
  https://*)
    HEALTH_HOST="${SITE_ADDRESS#https://}"
    HEALTH_HOST="${HEALTH_HOST%%/*}"
    HEALTH_URL="https://${HEALTH_HOST}/health"
    CURL_RESOLVE=(--resolve "${HEALTH_HOST}:443:127.0.0.1")
    ;;
  *)
    HEALTH_URL="http://localhost/health"
    ;;
esac

# A dirty tree would make the checkout below fail halfway through, leaving the
# VM on neither the old nor the new commit. Refuse up front instead.
if ! git diff --quiet HEAD 2>/dev/null; then
  fail "working tree at ${REPO_DIR} has uncommitted changes — refusing to deploy over them"
fi

PREVIOUS_SHA="$(git rev-parse HEAD)"
log "currently deployed: ${PREVIOUS_SHA}"
log "deploying:          ${TARGET_SHA}"

health_ok() {
  local i
  for ((i = 1; i <= HEALTH_RETRIES; i++)); do
    # Matches the backend's own /health contract (backend/routers/meta.py),
    # which returns 503 + "unhealthy" when the database is unreachable. Grepping
    # for "healthy" alone would match "unhealthy" too — hence the full field.
    if curl -fsS "${CURL_RESOLVE[@]}" --max-time 5 "$HEALTH_URL" 2>/dev/null \
         | grep -q '"status":"healthy"'; then
      log "health check passed after $(( i * HEALTH_DELAY ))s"
      return 0
    fi
    sleep "$HEALTH_DELAY"
  done
  return 1
}

# Record the images in .env as well as exporting them. Compose reads .env from
# the project directory automatically, so the pin survives into any later
# `docker compose ps|logs` — including the ones this script runs on the failure
# path, and any an operator runs by hand afterwards.
pin_images_in_env() {
  local backend_ref="$1" frontend_ref="$2" tmp
  tmp="$(mktemp)"
  grep -v -e '^BACKEND_IMAGE=' -e '^FRONTEND_IMAGE=' .env > "$tmp" 2>/dev/null || true
  printf 'BACKEND_IMAGE=%s\n'  "$backend_ref"  >> "$tmp"
  printf 'FRONTEND_IMAGE=%s\n' "$frontend_ref" >> "$tmp"
  # Rewrite in place rather than mv, so .env keeps its ownership and mode.
  cat "$tmp" > .env
  rm -f "$tmp"
}

bring_up() {
  local sha="$1" backend_image frontend_image
  backend_image="${BACKEND_IMAGE_REPO}:sha-${sha}"
  frontend_image="${FRONTEND_IMAGE_REPO}:sha-${sha}"

  git -c advice.detachedHead=false checkout --quiet "$sha"
  pin_images_in_env "$backend_image" "$frontend_image"
  export BACKEND_IMAGE="$backend_image" FRONTEND_IMAGE="$frontend_image"

  # Pull explicitly, before anything is torn down. Compose would pull too, but
  # a missing image would surface midway through replacing the running stack.
  # It matters most on the rollback path: rolling back to a commit whose images
  # were never published must fail loudly rather than half-way.
  local image
  for image in "$backend_image" "$frontend_image"; do
    log "pulling ${image}"
    docker pull --quiet "$image" \
      || fail "cannot pull ${image} — check that the build job published it for ${sha}, and that this VM can read the registry"
  done

  # No --build: every service here runs a published image or a stock one.
  docker compose -f "$COMPOSE_FILE" up -d --remove-orphans
}

log "fetching from origin"
git fetch --quiet origin main
git cat-file -e "${TARGET_SHA}^{commit}" 2>/dev/null \
  || fail "commit ${TARGET_SHA} not found after fetch — was it pushed to origin?"

# "The object exists" is NOT "this commit is on main". A clone retains every
# branch it has ever fetched, so without this check a leaked deploy key could
# name any historical or side-branch SHA — including a commit from before a
# security fix — and have production check it out. FETCH_HEAD is used rather
# than origin/main because it is unambiguously what the fetch above just
# retrieved. Ancestors are allowed, not just the tip: main may legitimately
# have moved on while this deploy was queued.
git merge-base --is-ancestor "$TARGET_SHA" FETCH_HEAD 2>/dev/null \
  || fail "commit ${TARGET_SHA} is not reachable from origin/main — refusing to deploy it"

# Two ways a deploy fails, and both need the same rollback. `bring_up` returning
# non-zero must not be fatal on the spot: compose stops the running containers
# before it starts the new ones, so a stack that fails to come up leaves the
# site DOWN — exiting there would skip the rollback entirely.
#
# A failed migration is exactly that case. `migrate` runs before the API, and
# backend waits on service_completed_successfully, so a bad revision means
# compose stops the old API, fails, and returns non-zero — with the site down.
#
# Alembic runs each revision in a transaction and Postgres has transactional
# DDL, so the revision that failed leaves nothing behind and the previous image
# is safe to bring back. Earlier revisions in the same chain stay applied, which
# is why old code against a partly-migrated database can still need a human.
FAILURE=""
if ! bring_up "$TARGET_SHA"; then
  FAILURE="the stack did not come up — see the output above. A failed migration stops here, and the old containers are already down."
elif ! health_ok; then
  FAILURE="health check FAILED after $(( HEALTH_RETRIES * HEALTH_DELAY ))s"
fi

if [ -z "$FAILURE" ]; then
  log "DEPLOY OK ${TARGET_SHA}"
  exit 0
fi

log "$FAILURE"
log "=== container state ==="
docker compose -f "$COMPOSE_FILE" ps || true
log "=== recent logs ==="
# `docker compose logs` covers stopped containers too, which matters here:
# `migrate` has already exited, and its log is the only place a failed revision
# explains itself.
docker compose -f "$COMPOSE_FILE" logs --tail 50 || true

if [ "$PREVIOUS_SHA" = "$TARGET_SHA" ]; then
  fail "deploy failed health check and there is nothing to roll back to"
fi

log "rolling back to ${PREVIOUS_SHA}"
bring_up "$PREVIOUS_SHA"

if health_ok; then
  fail "deploy of ${TARGET_SHA} failed its health check; rolled back to ${PREVIOUS_SHA} and the site is up"
else
  fail "deploy of ${TARGET_SHA} failed AND rollback to ${PREVIOUS_SHA} is also unhealthy — the site is DOWN, manual intervention needed"
fi
