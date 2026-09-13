#!/usr/bin/env bash
#
# AFG Market Diversification Tool — production ETL run, invoked over SSH by the
# ETL key.
#
# Installed on the VM at /usr/local/bin/afg-market-etl and pinned as the forced
# command for the ETL key in ~/.ssh/authorized_keys. Deliberately a SEPARATE key
# and script from deploy.sh: the two do different jobs, and a key that can run
# the ETL should not also be able to change which commit is in production.
#
# The ETL runs HERE, on the VM, rather than on a GitHub-hosted runner, so that
# Postgres never needs a published port. GitHub's runner IP ranges are large and
# change constantly, so allowlisting them would effectively mean exposing the
# database to the internet for one scheduled job a month.
#
# SSH_ORIGINAL_COMMAND carries the optional product filter, forwarded to
# `--products`. Empty means a full run.
#
# See docs/VM_DEPLOYMENT.md for first-time VM setup.
#
set -euo pipefail

REPO_DIR="${AFG_MARKET_DIR:-/home/azureuser/afg-market-intelligence}"
COMPOSE_FILE="docker-compose.prod.yml"

log()  { echo "[etl] $*"; }
fail() { echo "[etl] ERROR: $*" >&2; exit 1; }

# Everything after this point treats the argument as untrusted input from the
# network. Product names are the only thing the caller may pass.
#
# Names are COMMA-separated, not space-separated, because they contain spaces
# ("Dried Grapes (Raisins)"). Comma is a safe delimiter here: no name in
# config.py's PRODUCTS contains one — asserted by
# tests/test_config.py::test_product_names_are_safe_for_the_etl_ssh_command, so
# adding a product with a comma fails CI rather than silently splitting wrong.
#
# The allowlist is the exact character set those 38 names use — letters,
# digits, spaces, and & ( ) - / — plus the comma delimiter. It is what keeps
# this forced command from becoming an arbitrary-shell primitive: `; rm -rf /`
# is not a valid product name. Note there is deliberately no quote character in
# the set, so nothing below needs `eval` to reassemble quoted arguments.
RAW_ARGS="${SSH_ORIGINAL_COMMAND:-}"
if [ -n "$RAW_ARGS" ]; then
  [[ "$RAW_ARGS" =~ ^[A-Za-z0-9\ \(\)/\&,-]+$ ]] \
    || fail "product filter contains disallowed characters: '${RAW_ARGS}'"
fi

cd "$REPO_DIR" || fail "repo not found at ${REPO_DIR}"

# The ETL runs from the SAME image the API is currently serving, so the pipeline
# writing rows and the API reading them are always built from one commit. `run`
# rather than `exec`: a fresh container each time, so a long ETL can't be killed
# by an unrelated API restart, and its resource usage is isolated.
#
# --rm so the container is cleaned up on exit. No ports, no restart policy: this
# is a batch job, and a non-zero exit must fail the workflow rather than loop.
BACKEND_IMAGE="$(sed -n 's/^BACKEND_IMAGE=//p' .env 2>/dev/null | tr -d "\"'" | head -1)"
[ -n "$BACKEND_IMAGE" ] \
  || fail "BACKEND_IMAGE is not pinned in ${REPO_DIR}/.env — has a deploy run yet?"

log "running ETL from ${BACKEND_IMAGE}"

run_in_backend() {
  docker compose -f "$COMPOSE_FILE" run --rm --no-deps -T backend "$@"
}

if [ -n "$RAW_ARGS" ]; then
  log "product filter: ${RAW_ARGS}"
  # Split on comma into a real array, so each product reaches `--products` as
  # one argument with its spaces intact. Setting IFS for the duration of a
  # single `read` keeps the change local — no eval, no word-splitting on the
  # spaces inside names.
  IFS=',' read -r -a PRODUCT_ARGS <<< "$RAW_ARGS"
  run_in_backend python -m etl.run --products "${PRODUCT_ARGS[@]}"
else
  log "full run (all products)"
  run_in_backend python -m etl.run
fi

# Structural data checks, same ones that gated the old GitHub-hosted workflow.
# Fails on real problems (negative values, duplicate supplier codes,
# market_share_pct mismatches, out-of-range scores); does NOT fail on expected
# source-data gaps like WGI's publishing lag. See etl/verify.py.
log "verifying data"
run_in_backend python -m etl.verify

log "ETL OK"
