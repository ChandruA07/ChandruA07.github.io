-- =====================================================================
--  rls-policies.sql — SWPPL Dashboard · Phase 6 (applied LAST, on purpose)
--
--  Until this file is run, the database behaves like the Phase-2
--  "permissive" stage (equivalent to the old public demo rules).
--  Running it flips the project to default-deny, role-scoped access:
--
--    • ALL reads require a signed-in user (anon gets nothing).
--    • Writes are scoped per module role; admin (Site Manager) can
--      write everywhere.
--    • stock_movements has NO update/delete policy for anyone —
--      combined with the schema trigger, the ledger is append-only
--      at two independent layers.
--    • audit_log is readable by admin only; rows arrive only via the
--      schema's security-definer triggers and the log_audit() RPC.
--    • users.role can only be changed by an admin (trigger guard,
--      since RLS cannot express per-column rules).
--
--  Role matrix: docs/supabase/SECURITY.md
-- =====================================================================

-- Supabase already has anon/authenticated; create them when testing on
-- a plain local Postgres.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
revoke all on all tables in schema public from anon;

-- Helpers -------------------------------------------------------------
create or replace function is_role(variadic p_roles text[]) returns boolean
  language sql stable security definer set search_path = public as
$$ select my_role() = any (p_roles) $$;

create or replace function is_editor() returns boolean   -- any signed-in non-viewer
  language sql stable security definer set search_path = public as
$$ select auth.uid() is not null and my_role() not in ('viewer','anon') $$;

-- log_audit() RPC is defined in schema.sql (needed from Phase 2 on).

-- =====================================================================
--  Enable RLS + policies
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'organizations','projects','sites','roles','users',
    'pod_entries','next_day_plans','daily_progress',
    'solar_itcs','solar_activities','wtg_turbines',
    'bop_assets','bop_activities',
    'land_wtg_locs','land_sol_blocks','land_leases','land_parcels',
    'hse_observations','hse_employees',
    'milestones','blockers','row_issues','snapshots','module_state',
    'notifications','audit_log',
    'vendors','purchase_orders','po_line_items','po_status_history',
    'inventory_items','stock_movements',
    'plan_tasks','task_dependencies','plan_baselines',
    'documents','document_versions'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ---- read: signed-in users see everything except the audit log -------
do $$
declare t text;
begin
  foreach t in array array[
    'organizations','projects','sites','roles','users',
    'pod_entries','next_day_plans','daily_progress',
    'solar_itcs','solar_activities','wtg_turbines',
    'bop_assets','bop_activities',
    'land_wtg_locs','land_sol_blocks','land_leases','land_parcels',
    'hse_observations','hse_employees',
    'milestones','blockers','row_issues','snapshots','module_state',
    'notifications',
    'vendors','purchase_orders','po_line_items','po_status_history',
    'inventory_items','stock_movements',
    'plan_tasks','task_dependencies','plan_baselines',
    'documents','document_versions'
  ] loop
    execute format('drop policy if exists read_authenticated on %I', t);
    execute format(
      'create policy read_authenticated on %I for select
         using (auth.uid() is not null)', t);
  end loop;
end $$;

drop policy if exists audit_admin_read on audit_log;
create policy audit_admin_read on audit_log
  for select using (is_role('admin'));
revoke insert, update, delete on audit_log from authenticated;

-- ---- users: self-service name; role changes admin-only ---------------
drop policy if exists users_self_update on users;
create policy users_self_update on users
  for update using (id = auth.uid() or is_role('admin'))
             with check (id = auth.uid() or is_role('admin'));

create or replace function users_guard()
  returns trigger language plpgsql security definer set search_path = public as
$$
begin
  if new.role is distinct from old.role and my_role() <> 'admin' then
    raise exception 'Only Site Manager can change roles.';
  end if;
  return new;
end $$;
drop trigger if exists users_role_guard on users;
create trigger users_role_guard before update on users
  for each row execute function users_guard();

-- ---- module-scoped write policies ------------------------------------
-- helper macro pattern: writer(table, roles…)
do $$
declare
  rec record;
begin
  for rec in select * from (values
    -- table              , roles allowed to write (admin always included)
    ('pod_entries'        , array['solar','wtg','bop','land','procurement','store','planner']),
    ('next_day_plans'     , array['solar','wtg','bop','land','procurement','store','planner']),
    ('daily_progress'     , array['solar','wtg','bop','land','procurement','store','planner']),
    ('solar_itcs'         , array['solar']),
    ('solar_activities'   , array['solar']),
    ('wtg_turbines'       , array['wtg']),
    ('bop_assets'         , array['bop']),
    ('bop_activities'     , array['bop']),
    ('land_wtg_locs'      , array['land']),
    ('land_sol_blocks'    , array['land']),
    ('land_leases'        , array['land']),
    ('land_parcels'       , array['land']),
    ('hse_observations'   , array['solar','wtg','bop','land','procurement','store','planner']),
    ('hse_employees'      , array['solar','wtg','bop','land','procurement','store','planner']),
    ('milestones'         , array['solar','wtg','bop','land','procurement','store','planner']),
    ('blockers'           , array['solar','wtg','bop','land','procurement','store','planner']),
    ('row_issues'         , array['solar','wtg','bop','land','procurement','store','planner']),
    ('snapshots'          , array['solar','wtg','bop','land','procurement','store','planner']),
    ('notifications'      , array['solar','wtg','bop','land','procurement','store','planner']),
    ('vendors'            , array['procurement']),
    ('purchase_orders'    , array['procurement']),
    ('inventory_items'    , array['store']),
    ('plan_tasks'         , array['planner']),
    ('task_dependencies'  , array['planner']),
    ('documents'          , array['solar','wtg','bop','land','procurement','store','planner'])
  ) as v(tbl, roles) loop
    execute format('drop policy if exists write_scoped on %I', rec.tbl);
    execute format(
      'create policy write_scoped on %I for all
         using      (is_role(variadic %L::text[] || array[''admin'']))
         with check (is_role(variadic %L::text[] || array[''admin'']))',
      rec.tbl, rec.roles, rec.roles);
  end loop;
end $$;

-- stock_movements: INSERT only, store/admin. No update/delete policy
-- exists for ANY role — RLS layer #2 of ledger immutability.
drop policy if exists ledger_insert on stock_movements;
create policy ledger_insert on stock_movements
  for insert with check (is_role('store','admin'));

-- po_line_items / po_status_history / plan_baselines / document_versions
-- are written exclusively through the security-definer RPCs, which
-- carry their own role checks (below). No direct write policies.
revoke insert, update, delete on po_line_items      from authenticated;
revoke insert, update, delete on po_status_history  from authenticated;
revoke insert, update, delete on plan_baselines     from authenticated;
revoke insert, update, delete on document_versions  from authenticated;
revoke insert, update, delete on audit_log          from authenticated;

-- module_state: key-prefix scoped
drop policy if exists module_state_write on module_state;
create policy module_state_write on module_state
  for all
  using (
    is_role('admin')
    or (key like 'solar/%' and is_role('solar'))
    or (key like 'wtg/%'   and is_role('wtg'))
    or (key like 'bop/%'   and is_role('bop'))
    or (key in ('ganttRows','schedule') and is_editor())
  )
  with check (
    is_role('admin')
    or (key like 'solar/%' and is_role('solar'))
    or (key like 'wtg/%'   and is_role('wtg'))
    or (key like 'bop/%'   and is_role('bop'))
    or (key in ('ganttRows','schedule') and is_editor())
  );

-- module_state RPCs obey table RLS from here on (SECURITY INVOKER means
-- the caller's key-prefix policy above applies to every merge/set).
alter function merge_module_state(text, jsonb) security invoker;
alter function set_module_state(text, jsonb)  security invoker;

-- =====================================================================
--  FLIP THE SWITCH
--  Every RPC in schema.sql already calls rpc_require(...); those guards
--  have been dormant (Phase-2 permissive mode). This single row is the
--  moment "security is layered on last" becomes real:
-- =====================================================================
update app_settings set value = 'true' where key = 'security_enforced';
