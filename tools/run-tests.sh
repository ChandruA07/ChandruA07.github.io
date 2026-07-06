#!/bin/bash
# =====================================================================
#  run-tests.sh — full verification for the Supabase migration.
#
#  Needs: PostgreSQL 16+ reachable via $PGHOST/$PGUSER (defaults to a
#  local socket), Node 18+, and `npm i` done in the project root
#  (pg + jsdom, see package.json).
#
#  Suites:
#   1. schema install     — sql/schema.sql on an empty database
#   2. seed install       — sql/seed.sql (generated from firebase-seed.json)
#   3. migration suite    — real js/data-api.js + js/realtime.js against
#                           real Postgres (permissive Phase-2 mode)
#   4. migration suite    — SECURITY=1: same suite as the 'authenticated'
#                           role with sql/rls-policies.sql applied
#   5. RLS matrix         — role-by-role allow/deny grid (tools/test-rls.sh)
#   6. UI smoke           — legacy 100+-assertion jsdom boot (stubbed client)
#   7. boot smoke         — jsdom boot over the pg-backed client (real data)
#   8. new-modules        — v11 modules end-to-end in jsdom over real Postgres
# =====================================================================
set -e
cd "$(dirname "$0")/.."
export PGHOST=${PGHOST:-/tmp} PGUSER=${PGUSER:-postgres}
CONN_T="postgresql://$PGUSER@localhost/swppl_test?host=$PGHOST"
CONN_S="postgresql://$PGUSER@localhost/swppl_sec?host=$PGHOST"

step() { echo; echo "━━━ $1 ━━━"; }

step "1+2. schema + seed on a clean database (swppl_test)"
dropdb --if-exists swppl_test; createdb swppl_test
psql -d swppl_test -q -v ON_ERROR_STOP=1 -f sql/schema.sql >/dev/null
psql -d swppl_test -q -v ON_ERROR_STOP=1 -f sql/seed.sql   >/dev/null
echo "schema + seed installed cleanly"

step "3. migration suite — permissive (Phase-2 parity)"
node tools/test-migration.js "$CONN_T" | tail -2

step "4. migration suite — SECURITY (RLS enforced)"
dropdb --if-exists swppl_sec; createdb swppl_sec
psql -d swppl_sec -q -v ON_ERROR_STOP=1 -f sql/schema.sql       >/dev/null
psql -d swppl_sec -q -v ON_ERROR_STOP=1 -f sql/seed.sql         >/dev/null
psql -d swppl_sec -q -v ON_ERROR_STOP=1 -f sql/rls-policies.sql >/dev/null
SECURITY=1 node tools/test-migration.js "$CONN_S" | tail -2

step "5. RLS role matrix"
RLS_DB=swppl_sec bash tools/test-rls.sh | tail -2

step "6. legacy UI smoke suite (stubbed client)"
node tools/smoke-test.js | tail -2

step "7. boot smoke over real Postgres"
node tools/smoke-test-supabase.js "$CONN_T" | tail -2

step "8. v11 new-modules suite over real Postgres"
node tools/test-new-modules.js "$CONN_T" | tail -2

echo
echo "━━━ ALL SUITES COMPLETE ━━━"
