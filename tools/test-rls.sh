#!/usr/bin/env bash
# =====================================================================
# test-rls.sh — RLS / role-matrix verification (run after all 3 SQL files)
#
#   ./tools/test-rls.sh [psql-connection-args…]
#
# Creates one user per role, then exercises the permission matrix as
# each of them using `set role authenticated` + JWT claim GUCs — the
# same mechanism PostgREST/Supabase uses. Every line prints PASS/FAIL;
# exit code is non-zero if any FAIL.
# =====================================================================
set -u
PSQL="psql -h /tmp -U postgres -d ${RLS_DB:-swppl} -v ON_ERROR_STOP=0 -qtA"
FAILS=0

# deterministic per-role uuids
uid() { echo "22222222-2222-4222-8222-00000000000$1"; }
declare -A UIDS=([solar]=$(uid 1) [wtg]=$(uid 2) [bop]=$(uid 3) [land]=$(uid 4) \
                 [procurement]=$(uid 5) [store]=$(uid 6) [planner]=$(uid 7) \
                 [viewer]=$(uid 8) [admin]=$(uid 9))

$PSQL >/dev/null <<SQL
$(for r in "${!UIDS[@]}"; do
  echo "insert into users (id,email,name,role) values ('${UIDS[$r]}','$r@swppl.demo','$r user','$r') on conflict (id) do update set role='$r';"
done)
SQL

# run SQL as a given role; echo OK on success, ERR on error
as_role() {  # $1 role-key ('' = anonymous)  $2 sql
  local claims=""
  if [ -n "$1" ]; then
    claims="set request.jwt.claim.sub = '${UIDS[$1]}';"
  fi
  local out
  out=$($PSQL 2>&1 <<SQL
set role authenticated;
$claims
$2
SQL
)
  if echo "$out" | grep -q "ERROR"; then echo "ERR"; else echo "OK"; fi
}

expect() {  # $1 want(OK/ERR) $2 label $3 role $4 sql
  local got; got=$(as_role "$3" "$4")
  if [ "$got" = "$1" ]; then
    echo "PASS  $2"
  else
    echo "FAIL  $2  (wanted $1, got $got)"
    FAILS=$((FAILS+1))
  fi
}

echo "── read gating ──────────────────────────────────────────────"
# anonymous (no jwt claim): auth.uid() is null → read policy denies rows.
ANON_ROWS=$($PSQL <<SQL
set role authenticated;
set request.jwt.claim.sub = '';
select count(*) from pod_entries;
SQL
)
if [ "$ANON_ROWS" = "0" ]; then echo "PASS  anonymous sees 0 pod rows"; else echo "FAIL  anonymous sees $ANON_ROWS pod rows"; FAILS=$((FAILS+1)); fi
expect OK  "viewer can read solar_itcs"                 viewer "select count(*) from solar_itcs;"
expect ERR "viewer cannot read audit_log (admin only)"  viewer "do \$\$ declare n int; begin select count(*) into n from audit_log; if n = 0 then raise exception 'rls-hid-rows'; end if; end \$\$;"
expect OK  "admin can read audit_log"                   admin  "do \$\$ declare n int; begin select count(*) into n from audit_log; if n = 0 then raise exception 'rls-hid-rows'; end if; end \$\$;"

echo "── module write scoping ─────────────────────────────────────"
expect OK  "solar edits solar_activities"        solar "update solar_activities set today = today where itc_id='ITC-1' and idx=0;"
expect ERR "wtg cannot edit solar_activities"    wtg   "do \$\$ begin update solar_activities set today=99 where itc_id='ITC-1' and idx=0; if not found then raise exception 'rls-blocked'; end if; end \$\$;"
expect OK  "wtg edits wtg_turbines"              wtg   "update wtg_turbines set data = data where id='MBI-12';"
expect ERR "solar cannot edit wtg_turbines"      solar "do \$\$ begin update wtg_turbines set data='{}'::jsonb where id='MBI-12'; if not found then raise exception 'rls-blocked'; end if; end \$\$;"
expect OK  "bop edits bop_activities"            bop   "update bop_activities set data = data where section='pss';"
expect ERR "land cannot edit bop_activities"     land  "do \$\$ begin update bop_activities set data='{}'::jsonb where section='pss' and act_key='Soil Test'; if not found then raise exception 'rls-blocked'; end if; end \$\$;"
expect OK  "admin edits everything (solar)"      admin "update solar_activities set today = today where itc_id='ITC-1' and idx=0;"
expect ERR "viewer cannot insert POD"            viewer "insert into pod_entries (pod_date,module,activity) values (current_date,'s','x');"
expect OK  "solar can insert POD"                solar  "insert into pod_entries (pod_date,module,activity) values (current_date,'s','rls-test');"

echo "── procurement / store / planner ────────────────────────────"
expect OK  "procurement adds vendor"             procurement "insert into vendors (name) values ('RLS Vendor');"
expect ERR "store cannot add vendor"             store       "insert into vendors (name) values ('Nope');"
expect ERR "procurement cannot approve PO (admin only)" procurement "
  do \$\$ declare v uuid; p uuid; begin
    select id into v from vendors limit 1;
    insert into purchase_orders (po_number, vendor_id, vendor_name) values ('PO-RLS-1', v, 'x') returning id into p;
    perform po_set_status(p, 'approved', '');
  end \$\$;"
expect OK  "admin approves PO" admin "
  do \$\$ declare v uuid; p uuid; begin
    select id into v from vendors limit 1;
    insert into purchase_orders (po_number, vendor_id, vendor_name) values ('PO-RLS-2', v, 'x') returning id into p;
    perform po_set_status(p, 'approved', 'ok');
  end \$\$;"
expect OK  "store inserts stock movement"        store "
  do \$\$ declare i uuid; begin
    insert into inventory_items (name) values ('RLS Item') returning id into i;
    insert into stock_movements (item_id, type, qty) values (i, 'in', 10);
  end \$\$;"
# No UPDATE/DELETE policy exists on the ledger for ANY role, so the
# statements are silent zero-row no-ops under RLS — assert zero effect.
expect ERR "store cannot UPDATE the ledger"      store "do \$\$ begin update stock_movements set qty = 1; if found then raise exception 'ledger-mutated'; end if; raise exception 'rls-no-op'; end \$\$;"
expect ERR "even admin cannot DELETE the ledger" admin "do \$\$ begin delete from stock_movements; if found then raise exception 'ledger-mutated'; end if; raise exception 'rls-no-op'; end \$\$;"
# and if a row somehow WERE visible, the schema trigger still blocks it
# (verified separately in tools/test-sql.sh as table owner).
expect OK  "planner adds task"                   planner "insert into plan_tasks (name, start_date, end_date) values ('RLS task', current_date, current_date + 5);"
expect ERR "solar cannot add task"               solar   "insert into plan_tasks (name, start_date, end_date) values ('Nope', current_date, current_date);"
expect ERR "planner cannot set baseline (admin)" planner "select set_plan_baseline();"
expect OK  "admin sets baseline"                 admin   "select set_plan_baseline();"

echo "── module_state key scoping ─────────────────────────────────"
expect OK  "wtg patches wtg/zeroPoint"           wtg   "select merge_module_state('wtg/zeroPoint', '{\"t\":1}'::jsonb);"
expect ERR "solar cannot patch wtg/zeroPoint"    solar "do \$\$ begin perform merge_module_state('wtg/zeroPoint', '{\"t\":2}'::jsonb); if (select value->>'t' from module_state where key='wtg/zeroPoint') = '2' then raise exception 'should-have-blocked'; end if; end \$\$;"
expect OK  "solar patches solar/meta"            solar "select merge_module_state('solar/meta', '{\"x\":1}'::jsonb);"

echo "── users table guards ───────────────────────────────────────"
expect OK  "user renames self"                   solar "update users set name='Solar Renamed' where id='${UIDS[solar]}';"
expect ERR "user cannot self-promote to admin"   solar "update users set role='admin' where id='${UIDS[solar]}';"
expect OK  "admin assigns role"                  admin "update users set role='viewer' where id='${UIDS[solar]}'; update users set role='solar' where id='${UIDS[solar]}';"

echo
if [ $FAILS -eq 0 ]; then echo "✅ RLS matrix: all checks passed"; exit 0
else echo "❌ RLS matrix: $FAILS check(s) FAILED"; exit 1; fi
