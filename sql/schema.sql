-- =====================================================================
--  schema.sql — SWPPL Dashboard · Supabase (Postgres) migration
--  Phase 1 deliverable. Run FIRST, before seed.sql and rls-policies.sql.
--
--  Design notes (full rationale in docs/supabase/SCHEMA.md):
--
--  • Entities that are genuinely relational get first-class tables and
--    columns: pod_entries, vendors, purchase_orders, po_line_items,
--    po_status_history, inventory_items, stock_movements, plan_tasks,
--    task_dependencies, plan_baselines, documents, document_versions,
--    hse_*, land_leases, land_parcels, solar_activities, milestones,
--    blockers, row_issues, notifications, audit_log, users.
--
--  • Attributes that are intrinsically DOCUMENT-shaped and are always
--    read/written whole by the UI (a turbine's per-stage percentage
--    arrays, an ITC's live-activity list, custom activity trees, the
--    schedule S-curve) live in jsonb columns. Decomposing a fixed
--    5-element civil-stage array into an EAV table would add joins and
--    drift risk while helping no query this app makes. This is a
--    deliberate call, stated per the brief's "say so explicitly" rule.
--
--  • module_state is a small key→jsonb table for the handful of
--    singleton config blobs the old RTDB kept at fixed paths
--    (ganttRows, schedule, wtg/zeroPoint, wtg/customActs,
--    wtg/kpiOverrides, solar/meta, solar/customActs, solar/itcMaps).
--
--  • audit_log is populated TWO ways, per the brief:
--      1. Row-change TRIGGERS on every business table (cannot be
--         forgotten by any code path).
--      2. The app's semantic audit events (action names like
--         'po.status') which the existing Audit viewer displays.
--
--  • stock is NEVER stored as a mutable total: current_stock is a VIEW
--    over the append-only stock_movements ledger, and RLS (Phase 6)
--    grants no UPDATE/DELETE on the ledger.
--
--  • Multi-tenancy: organizations → projects → sites exist and every
--    business table carries project_id defaulting to the seeded demo
--    project, so a second project can be added without a migration.
--    The UI is still single-project; queries do not filter yet.
--
--  Compatible with Supabase (auth.uid()) AND a plain local Postgres:
--  the DO block below stubs auth.uid() when the auth schema is absent,
--  which is how the automated test suite runs against Postgres 16.
-- =====================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ---------------------------------------------------------------
-- auth.uid() stub for LOCAL testing only. On Supabase the auth
-- schema already exists and this block is a no-op.
-- ---------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    create schema auth;
    create function auth.uid() returns uuid
      language sql stable as
      $f$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
    create function auth.role() returns text
      language sql stable as
      $f$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $f$;
    -- Supabase grants these to anon/authenticated out of the box; the
    -- local stub must match or SECURITY INVOKER functions break.
    grant usage on schema auth to public;
    grant execute on all functions in schema auth to public;
  end if;
end $$;

-- =====================================================================
--  1. TENANCY
-- =====================================================================
create table if not exists organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists projects (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  code       text not null unique,
  name       text not null,
  capacity_mw numeric,
  created_at timestamptz not null default now()
);

create table if not exists sites (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name       text not null,
  lat        double precision,
  lng        double precision,
  created_at timestamptz not null default now()
);

-- Fixed demo IDs so client code and seed data can reference them.
insert into organizations (id, name)
  values ('00000000-0000-4000-8000-000000000001', 'Continuum Green Energy')
  on conflict (id) do nothing;
insert into projects (id, org_id, code, name, capacity_mw)
  values ('00000000-0000-4000-8000-000000000002',
          '00000000-0000-4000-8000-000000000001',
          'SWPPL', 'SWPPL 140MW Hybrid (Solar + Wind)', 140)
  on conflict (id) do nothing;
insert into sites (id, project_id, name)
  values ('00000000-0000-4000-8000-000000000003',
          '00000000-0000-4000-8000-000000000002', 'Main Site')
  on conflict (id) do nothing;

create or replace function demo_project_id() returns uuid
  language sql immutable as
  $$ select '00000000-0000-4000-8000-000000000002'::uuid $$;

-- =====================================================================
--  2. USERS & ROLES
--  One role per user — that is the app's real permission model
--  (auth.canEdit compares a single role string). roles is a lookup
--  table; a user_roles join table would misrepresent the model, so it
--  is deliberately not created (stated per the brief). Adding one
--  later is a 5-line migration.
-- =====================================================================
create table if not exists roles (
  key   text primary key,
  label text not null
);
insert into roles (key, label) values
  ('solar','Solar Engineer'), ('wtg','WTG Engineer'), ('bop','BOP Engineer'),
  ('land','Land Coordinator'), ('procurement','Procurement Officer'),
  ('store','Store Keeper'), ('planner','Planning Engineer'),
  ('viewer','Viewer (read-only)'), ('admin','Site Manager')
on conflict (key) do nothing;

-- Mirrors auth.users. id = auth.users.id. Role changes are admin-only
-- (enforced by RLS in Phase 6 and by the handle_new_user trigger which
-- always starts people as viewer).
create table if not exists users (
  id    uuid primary key,
  email text,
  name  text,
  role  text not null default 'viewer' references roles(key),
  created_at timestamptz not null default now()
);

-- Convenience for RLS policies and RPCs.
create or replace function my_role() returns text
  language sql stable security definer set search_path = public as
  $$ select coalesce((select role from users where id = auth.uid()), 'anon') $$;

create or replace function my_name() returns text
  language sql stable security definer set search_path = public as
  $$ select coalesce((select name from users where id = auth.uid()), 'Anonymous') $$;

-- On Supabase, keep public.users in sync with auth.users signups.
-- (No-op locally: auth.users doesn't exist, so the trigger is skipped.)
do $$
begin
  if exists (select 1 from pg_tables where schemaname='auth' and tablename='users') then
    create or replace function public.handle_new_user()
      returns trigger language plpgsql security definer set search_path = public as
      $f$
      begin
        insert into public.users (id, email, name, role)
        values (new.id, new.email,
                coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
                'viewer')
        on conflict (id) do nothing;
        return new;
      end $f$;
    if not exists (select 1 from pg_trigger where tgname = 'on_auth_user_created') then
      create trigger on_auth_user_created
        after insert on auth.users
        for each row execute function public.handle_new_user();
    end if;
  end if;
end $$;

-- =====================================================================
--  3. AUDIT LOG (trigger-populated + app semantic events)
-- =====================================================================
create table if not exists audit_log (
  id       bigint generated always as identity primary key,
  uid      uuid,
  role     text,
  action   text not null,           -- 'row.insert'/'row.update'/'row.delete' or app event
  path     text not null,           -- table/rowid or legacy-style path
  before   jsonb,
  after    jsonb,
  ts       timestamptz not null default now()
);
create index if not exists audit_log_ts_idx on audit_log (ts desc);

-- Semantic audit events from the app (action names like 'po.status'
-- that the Audit viewer displays). Clients call this RPC; there is no
-- direct INSERT grant on audit_log.
create or replace function log_audit(p_action text, p_path text, p_before jsonb, p_after jsonb)
  returns void language sql security definer set search_path = public as
$$
  insert into audit_log (uid, role, action, path, before, after)
  select auth.uid(), my_role(), p_action, p_path, p_before, p_after
  where auth.uid() is not null;
$$;

-- Generic row-change trigger. Attached to every business table below,
-- so no application code path can forget to audit.
create or replace function audit_row_change()
  returns trigger language plpgsql security definer set search_path = public as
$$
declare
  v_path text := tg_table_name || '/' ||
                 coalesce( case when tg_op = 'DELETE'
                                then (to_jsonb(old)->>'id')
                                else (to_jsonb(new)->>'id') end, '?');
begin
  insert into audit_log (uid, role, action, path, before, after)
  values (auth.uid(), my_role(),
          'row.' || lower(tg_op), v_path,
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

-- Helper to attach it uniformly.
create or replace procedure attach_audit(t regclass)
  language plpgsql as
$$
begin
  execute format(
    'drop trigger if exists audit_changes on %s;
     create trigger audit_changes
       after insert or update or delete on %s
       for each row execute function audit_row_change()', t, t);
end $$;

-- =====================================================================
--  4. SHARED: updated-stamp helper
-- =====================================================================
create or replace function touch_last()
  returns trigger language plpgsql as
$$
begin
  new.last_at := now();
  if new.last_by is null or new.last_by = old.last_by then
    new.last_by := coalesce(auth.uid()::text, new.last_by);
  end if;
  return new;
end $$;

-- =====================================================================
--  5. POD / DAILY PROGRESS / NEXT-DAY PLAN
-- =====================================================================
create table if not exists pod_entries (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null default demo_project_id() references projects(id),
  pod_date    date not null,
  module      text not null default '',          -- 's'|'w'|'l'|'b'
  activity    text not null default '',
  qty         numeric not null default 0,
  mp          numeric not null default 0,
  resources   jsonb   not null default '[]',     -- [{type,qty}]
  contractor  text not null default '',
  notes       text not null default '',
  photo_url   text,
  by_uid      text,                              -- null for anonymous submissions
  by_name     text not null default 'Anonymous',
  status      text not null default 'nys' check (status in ('nys','wip','done')),
  progress    numeric not null default 0,
  remark      text not null default '',
  status_by   text,
  status_by_name text,
  status_at   timestamptz,
  ts          timestamptz not null default now()
);
create index if not exists pod_entries_date_idx on pod_entries (pod_date desc, ts);

create table if not exists next_day_plans (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null default demo_project_id() references projects(id),
  for_date   date not null,
  module     text not null default '',
  activity   text not null default '',
  qty        numeric not null default 0,
  mp         numeric not null default 0,
  contractor text not null default '',
  notes      text not null default '',
  by_uid     text,
  by_name    text not null default 'Anonymous',
  ts         timestamptz not null default now()
);
create index if not exists next_day_plans_date_idx on next_day_plans (for_date desc);

create table if not exists daily_progress (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null default demo_project_id() references projects(id),
  module     text not null default '',
  itc        text,
  turbine    text,
  activity   text not null default '',
  sub        text,
  val        numeric,
  pct        numeric,
  today      numeric,
  qty        numeric,
  unit       text,
  remarks    text,
  entry_date date not null default current_date,
  by_uid     text,
  by_name    text not null default 'Anonymous',
  ts         timestamptz not null default now()
);
create index if not exists daily_progress_ts_idx on daily_progress (ts desc);

-- =====================================================================
--  6. SOLAR
-- =====================================================================
create table if not exists solar_itcs (
  id         text primary key,                -- 'ITC-1' …
  project_id uuid not null default demo_project_id() references projects(id),
  data       jsonb not null default '{}',     -- live{}, mw, solActs{}, … (everything except acts)
  last_by    text,
  last_at    timestamptz
);

create table if not exists solar_activities (
  itc_id    text not null references solar_itcs(id) on delete cascade,
  idx       int  not null check (idx between 0 and 50),
  done      numeric not null default 0,
  today     numeric not null default 0,
  sub_scope numeric,
  sub_done  jsonb,                            -- number[] per sub-activity
  extra     jsonb not null default '{}',
  last_by   text,
  last_at   timestamptz,
  primary key (itc_id, idx)
);

-- =====================================================================
--  7. WTG
--  A turbine row is a document the UI always consumes whole (per-stage
--  arrays, date maps, local activity trees) → jsonb payload + indexed
--  generated column for status.
-- =====================================================================
create table if not exists wtg_turbines (
  id         text primary key,                -- 'MBI-12' …
  project_id uuid not null default demo_project_id() references projects(id),
  data       jsonb not null default '{}',
  status     text generated always as (data->>'status') stored,
  last_by    text,
  last_at    timestamptz
);
create index if not exists wtg_turbines_status_idx on wtg_turbines (status);

-- =====================================================================
--  8. BOP (33kV / 66kV / PSS / GSS)
--  bop_assets   = physical line infrastructure (feeders, lines, poles)
--  bop_activities = activity progress per section
--  Value shapes vary per section (stage-percentage arrays vs
--  {scope,done,wip,bal,col,unit}) and are consumed whole → jsonb data.
-- =====================================================================
create table if not exists bop_assets (
  section   text not null check (section in ('feeders33','lines33','poles33')),
  asset_key text not null,                    -- feeder index or feeder id
  data      jsonb not null default '{}',
  last_by   text,
  last_at   timestamptz,
  primary key (section, asset_key)
);

create table if not exists bop_activities (
  section  text not null check (section in ('33kv','66kv','pss','gss')),
  act_key  text not null,                     -- activity / feeder name (RTDB-safe-key form)
  data     jsonb not null default '{}',
  last_by  text,
  last_at  timestamptz,
  primary key (section, act_key)
);

-- =====================================================================
--  9. LAND
-- =====================================================================
create table if not exists land_wtg_locs (
  id      text primary key,
  project_id uuid not null default demo_project_id() references projects(id),
  data    jsonb not null default '{}',
  last_by text,
  last_at timestamptz
);

create table if not exists land_sol_blocks (
  id      text primary key,
  project_id uuid not null default demo_project_id() references projects(id),
  acts    jsonb not null default '[]',        -- number[] per land activity
  data    jsonb not null default '{}',
  last_by text,
  last_at timestamptz
);

create table if not exists land_leases (
  id       uuid primary key default gen_random_uuid(),
  block_id text not null references land_sol_blocks(id) on delete cascade,
  own      text not null default '',
  svy      text not null default '',
  dur      text not null default '',
  ls       text not null default 'Pending',
  doc      text not null default 'Pending',
  reg      text not null default 'Pending',
  rem      text not null default '',
  by_uid   text,
  by_name  text,
  ts       timestamptz not null default now()
);
create index if not exists land_leases_block_idx on land_leases (block_id);

create table if not exists land_parcels (
  id       uuid primary key default gen_random_uuid(),
  project_id uuid not null default demo_project_id() references projects(id),
  module   text not null default '',
  name     text not null default '',
  lat      double precision not null default 0,
  lng      double precision not null default 0,
  area     numeric not null default 0,
  notes    text not null default '',
  by_uid   text,
  by_name  text,
  ts       timestamptz not null default now(),
  last_by  text,
  last_at  timestamptz
);

-- =====================================================================
--  10. HSE
--  Columns cover every key the code reads/writes (two historical
--  observation shapes exist); anything else from legacy imports lands
--  in extra.
-- =====================================================================
create table if not exists hse_observations (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null default demo_project_id() references projects(id),
  legacy_id    text unique,                   -- '-hse_obs_001' style seed keys
  type         text,
  severity     text,
  description  text,                          -- dataApi 'desc'
  obs          text,                          -- legacy field name
  area         text,
  loc          text,
  vendor       text,
  action       text,
  photo_url    text,
  closed_by    text,
  status       text not null default 'open',
  extra        jsonb not null default '{}',
  by_uid       text,
  by_name      text,
  ts           timestamptz not null default now()
);

create table if not exists hse_employees (
  id       uuid primary key default gen_random_uuid(),
  project_id uuid not null default demo_project_id() references projects(id),
  legacy_id text unique,
  code     text not null default '',
  name     text not null default '',
  score    numeric not null default 0 check (score between 0 and 100),
  photo    text,
  ts       timestamptz not null default now()
);

-- =====================================================================
--  11. LISTS: milestones / blockers / ROW issues / snapshots
-- =====================================================================
create table if not exists milestones (
  id       uuid primary key default gen_random_uuid(),
  project_id uuid not null default demo_project_id() references projects(id),
  legacy_id text unique,
  title    text not null default '',
  mdate    date,
  mod      text not null default 'Overall',
  by_uid   text,
  by_name  text,
  ts       timestamptz not null default now(),
  last_by  text,
  last_at  timestamptz
);

create table if not exists blockers (
  id       uuid primary key default gen_random_uuid(),
  project_id uuid not null default demo_project_id() references projects(id),
  title    text not null default '',
  severity text not null default '',
  module   text not null default '',
  description text not null default '',
  by_uid   text,
  ts       timestamptz not null default now()
);

create table if not exists row_issues (
  id       uuid primary key default gen_random_uuid(),
  project_id uuid not null default demo_project_id() references projects(id),
  legacy_id text unique,
  loc      text not null default '',
  issue    text not null default '',
  -- No CHECK on type/status: historical data contains values ('33kV',
  -- 'EHV') beyond the entry form's whitelist. data-api validates NEW rows.
  type     text not null default 'Other',
  status   text not null default 'Open',
  opened   text not null default '',
  exp_clear text not null default '',
  raised_by text,
  by_uid   text,
  by_name  text,
  ts       timestamptz not null default now(),
  last_by  text,
  last_at  timestamptz
);

create table if not exists snapshots (
  snap_date date primary key,
  project_id uuid not null default demo_project_id() references projects(id),
  data      jsonb not null default '{}',
  saved_by  text,
  saved_at  timestamptz not null default now()
);

-- =====================================================================
--  11½. SECURITY SWITCH
--  Phase 2 runs "permissive" (matching the old public demo DB).
--  rls-policies.sql (Phase 6) sets security_enforced = true, at which
--  point every RPC guard below starts enforcing roles. This makes the
--  brief's phase order an explicit, auditable database state instead
--  of an accident of which file was run.
-- =====================================================================
create table if not exists app_settings (
  key   text primary key,
  value jsonb not null
);
insert into app_settings (key, value) values ('security_enforced', 'false')
  on conflict (key) do nothing;

create or replace function security_enforced() returns boolean
  language sql stable security definer set search_path = public as
$$ select coalesce((select value::text = 'true' from app_settings
                    where key = 'security_enforced'), false) $$;

create or replace function rpc_require(variadic p_roles text[]) returns void
  language plpgsql stable security definer set search_path = public as
$$
begin
  if not security_enforced() then return; end if;
  if auth.uid() is null then raise exception '🔒 Sign in required.'; end if;
  if not (my_role() = any (p_roles) or my_role() = 'admin') then
    raise exception 'This action needs % (or Site Manager).',
      array_to_string(p_roles, '/');
  end if;
end $$;

-- =====================================================================
--  12. SINGLETON MODULE STATE (config blobs at fixed legacy paths)
-- =====================================================================
create table if not exists module_state (
  key     text primary key,   -- 'ganttRows','schedule','wtg/zeroPoint',…
  value   jsonb not null default '{}',
  last_by text,
  last_at timestamptz not null default now()
);

-- Atomic partial patch (replaces the fetch-merge-write race).
create or replace function merge_module_state(p_key text, p_patch jsonb)
  returns void language sql security definer set search_path = public as
$$
  insert into module_state (key, value, last_by, last_at)
  values (p_key, p_patch, auth.uid()::text, now())
  on conflict (key) do update
    set value = module_state.value || excluded.value,
        last_by = auth.uid()::text, last_at = now();
$$;

create or replace function set_module_state(p_key text, p_value jsonb)
  returns void language sql security definer set search_path = public as
$$
  insert into module_state (key, value, last_by, last_at)
  values (p_key, coalesce(p_value,'{}'::jsonb), auth.uid()::text, now())
  on conflict (key) do update
    set value = excluded.value, last_by = auth.uid()::text, last_at = now();
$$;

-- =====================================================================
--  13. NOTIFICATIONS
-- =====================================================================
create table if not exists notifications (
  id       uuid primary key default gen_random_uuid(),
  project_id uuid not null default demo_project_id() references projects(id),
  module   text not null default 'general',
  action   text not null default '',
  descr    text not null default '',
  by_name  text not null default 'Anonymous',
  read_by  jsonb not null default '{}',
  ts       timestamptz not null default now()
);
create index if not exists notifications_ts_idx on notifications (ts desc);

-- Atomic per-user mark-read (no read-modify-write from the client).
create or replace function notification_mark_read(p_id uuid)
  returns void language plpgsql security definer set search_path = public as
$$
begin
  if security_enforced() and auth.uid() is null then
    raise exception '🔒 Sign in required.';
  end if;
  update notifications
     set read_by = read_by || jsonb_build_object(coalesce(auth.uid()::text,'anon'), true)
   where id = p_id;
end $$;

-- =====================================================================
--  14. PROCUREMENT
-- =====================================================================
create table if not exists vendors (
  id       uuid primary key default gen_random_uuid(),
  project_id uuid not null default demo_project_id() references projects(id),
  name     text not null,
  category text not null default 'General',
  contact  text not null default '',
  phone    text not null default '',
  email    text not null default '',
  gstin    text not null default '',
  address  text not null default '',
  rating   numeric not null default 0 check (rating between 0 and 5),
  status   text not null default 'active' check (status in ('active','archived')),
  by_uid   text,
  by_name  text,
  ts       timestamptz not null default now(),
  last_by  text,
  last_at  timestamptz
);

create table if not exists purchase_orders (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null default demo_project_id() references projects(id),
  po_number     text not null,
  vendor_id     uuid not null references vendors(id),
  vendor_name   text not null,               -- denormalized as-of-issue, on purpose (commercial record)
  module        text not null default 'general',
  description   text not null default '',
  expected_date date,
  currency      text not null default 'INR',
  total_value   numeric not null default 0 check (total_value >= 0),
  status        text not null default 'draft'
                check (status in ('draft','approved','delivered','closed','cancelled')),
  attachment_url text,
  by_uid        text,
  by_name       text,
  ts            timestamptz not null default now(),
  last_by       text,
  last_at       timestamptz
);
create index if not exists purchase_orders_vendor_idx on purchase_orders (vendor_id);
create index if not exists purchase_orders_status_idx on purchase_orders (status);

create table if not exists po_line_items (
  id        uuid primary key default gen_random_uuid(),
  po_id     uuid not null references purchase_orders(id) on delete cascade,
  item_name text not null,
  item_id   uuid,                             -- optional link to inventory_items
  unit      text not null default 'nos',
  qty       numeric not null check (qty > 0),
  rate      numeric not null check (rate >= 0),
  amount    numeric not null,
  by_uid    text,
  ts        timestamptz not null default now()
);
create index if not exists po_line_items_po_idx on po_line_items (po_id);

create table if not exists po_status_history (
  id      uuid primary key default gen_random_uuid(),
  po_id   uuid not null references purchase_orders(id) on delete cascade,
  status  text not null,
  note    text not null default '',
  by_uid  text,
  by_name text,
  ts      timestamptz not null default now()
);
create index if not exists po_status_history_po_idx on po_status_history (po_id, ts);

-- The initial 'draft' history row is written by trigger, not by the
-- client: po_status_history is RPC/trigger-only under Phase-6 RLS.
create or replace function po_on_create()
  returns trigger language plpgsql security definer set search_path = public as
$$
begin
  insert into po_status_history (po_id, status, by_uid, by_name)
  values (new.id, 'draft', coalesce(new.by_uid, auth.uid()::text), coalesce(new.by_name, my_name()));
  return new;
end $$;
drop trigger if exists po_create_history on purchase_orders;
create trigger po_create_history after insert on purchase_orders
  for each row execute function po_on_create();

-- ---- Atomic PO operations (RPCs) ------------------------------------
-- These replace the RTDB read-then-write sequences with single
-- transactions: line-item + total stay consistent, and the status
-- state-machine check cannot race two concurrent approvers.
create or replace function po_add_line_item(
  p_po_id uuid, p_item_name text, p_item_id uuid,
  p_unit text, p_qty numeric, p_rate numeric)
  returns uuid language plpgsql security definer set search_path = public as
$$
declare v_status text; v_id uuid; v_amount numeric;
begin
  perform rpc_require('procurement');
  select status into v_status from purchase_orders where id = p_po_id for update;
  if v_status is null then raise exception 'PO not found.'; end if;
  if v_status <> 'draft' then
    raise exception 'Line items can only be edited while the PO is a draft.';
  end if;
  v_amount := round(p_qty * p_rate, 2);
  insert into po_line_items (po_id, item_name, item_id, unit, qty, rate, amount, by_uid)
  values (p_po_id, p_item_name, p_item_id, coalesce(p_unit,'nos'), p_qty, p_rate, v_amount, auth.uid()::text)
  returning id into v_id;
  update purchase_orders
     set total_value = round(total_value + v_amount, 2),
         last_by = auth.uid()::text, last_at = now()
   where id = p_po_id;
  return v_id;
end $$;

create or replace function po_delete_line_item(p_po_id uuid, p_item_id uuid)
  returns void language plpgsql security definer set search_path = public as
$$
declare v_status text; v_amount numeric;
begin
  perform rpc_require('procurement');
  select status into v_status from purchase_orders where id = p_po_id for update;
  if v_status is distinct from 'draft' then
    raise exception 'Line items can only be edited while the PO is a draft.';
  end if;
  delete from po_line_items where id = p_item_id and po_id = p_po_id
    returning amount into v_amount;
  if v_amount is null then return; end if;
  update purchase_orders
     set total_value = greatest(0, round(total_value - v_amount, 2)),
         last_by = auth.uid()::text, last_at = now()
   where id = p_po_id;
end $$;

create or replace function po_set_status(p_po_id uuid, p_next text, p_note text)
  returns void language plpgsql security definer set search_path = public as
$$
declare
  v_cur text;
  v_allowed text[];
begin
  perform rpc_require('procurement');
  select status into v_cur from purchase_orders where id = p_po_id for update;
  if v_cur is null then raise exception 'PO not found.'; end if;
  v_allowed := case v_cur
    when 'draft'     then array['approved','cancelled']
    when 'approved'  then array['delivered','cancelled']
    when 'delivered' then array['closed']
    else array[]::text[] end;
  if not p_next = any(v_allowed) then
    raise exception 'Invalid transition: % → %. Allowed: %',
      v_cur, p_next, coalesce(array_to_string(v_allowed, ', '), 'none');
  end if;
  -- approval is Site Manager only — enforced server-side, not just UX
  -- (active once Phase 6 flips security_enforced)
  if security_enforced() and p_next = 'approved' and my_role() <> 'admin' then
    raise exception 'PO approval requires Site Manager.';
  end if;
  update purchase_orders
     set status = p_next, last_by = auth.uid()::text, last_at = now()
   where id = p_po_id;
  insert into po_status_history (po_id, status, note, by_uid, by_name)
  values (p_po_id, p_next, coalesce(p_note,''), auth.uid()::text, my_name());
end $$;

-- Vendor performance rollup (was a full client-side scan on RTDB).
create or replace view vendor_performance as
select v.id as vendor_id,
       v.name,
       count(po.id)                                        as total_pos,
       count(po.id) filter (where po.status in ('delivered','closed')) as delivered_pos,
       count(po.id) filter (where po.status = 'cancelled') as cancelled_pos,
       coalesce(sum(po.total_value) filter (where po.status <> 'cancelled'), 0) as total_spend,
       round(100.0 * count(po.id) filter (
           where po.status in ('delivered','closed')
             and (po.expected_date is null or (
                   select min(h.ts)::date from po_status_history h
                    where h.po_id = po.id and h.status = 'delivered'
                 ) <= po.expected_date))
         / nullif(count(po.id) filter (where po.status in ('delivered','closed')), 0), 0)
         as on_time_pct
from vendors v
left join purchase_orders po on po.vendor_id = v.id
group by v.id, v.name;

-- =====================================================================
--  15. INVENTORY (append-only ledger; stock is a VIEW, never a column)
-- =====================================================================
create table if not exists inventory_items (
  id        uuid primary key default gen_random_uuid(),
  project_id uuid not null default demo_project_id() references projects(id),
  name      text not null,
  category  text not null default 'General',
  unit      text not null default 'nos',
  min_stock numeric not null default 0 check (min_stock >= 0),
  location  text not null default 'Main Store',
  status    text not null default 'active' check (status in ('active','archived')),
  by_uid    text,
  by_name   text,
  ts        timestamptz not null default now(),
  last_by   text,
  last_at   timestamptz
);

create table if not exists stock_movements (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null default demo_project_id() references projects(id),
  item_id     uuid not null references inventory_items(id),
  mv_date     date not null default current_date,
  type        text not null check (type in ('in','out','adjust')),
  qty         numeric not null,
  ref         text not null default '',
  dest        text not null default '',   -- legacy 'to'
  notes       text not null default '',
  location    text,
  transfer_id uuid,
  by_uid      text,
  by_name     text,
  ts          timestamptz not null default now(),
  constraint qty_positive_unless_adjust check (type = 'adjust' or qty > 0),
  constraint no_future_date check (mv_date <= current_date)
);
create index if not exists stock_movements_item_idx on stock_movements (item_id, mv_date);
create index if not exists stock_movements_date_idx on stock_movements (mv_date desc);

-- Ledger is append-only even for admins at the database level.
create or replace function forbid_ledger_mutation()
  returns trigger language plpgsql as
$$ begin raise exception 'stock_movements is an append-only ledger — record a compensating ''adjust'' movement instead.'; end $$;
drop trigger if exists ledger_no_update on stock_movements;
create trigger ledger_no_update before update or delete on stock_movements
  for each row execute function forbid_ledger_mutation();

-- Stock = Σ(ledger): in:+qty, out:−qty, adjust:signed qty.
create or replace view current_stock as
select i.id as item_id, i.name, i.unit, i.min_stock, i.location, i.status,
       coalesce(sum(case m.type when 'in' then m.qty
                                when 'out' then -m.qty
                                else m.qty end), 0) as stock
from inventory_items i
left join stock_movements m on m.item_id = i.id
group by i.id;

-- Site-to-site transfer: both legs in ONE transaction (the RTDB build
-- used a multi-path update; this is the SQL equivalent).
create or replace function record_transfer(
  p_item_id uuid, p_qty numeric, p_from text, p_to text,
  p_date date, p_notes text)
  returns jsonb language plpgsql security definer set search_path = public as
$$
declare v_tid uuid := gen_random_uuid(); v_out uuid; v_in uuid; v_note text;
begin
  perform rpc_require('store');
  if p_qty is null or p_qty <= 0 then raise exception 'Quantity must be > 0.'; end if;
  if coalesce(p_from,'') = '' or coalesce(p_to,'') = '' then
    raise exception 'From and To locations are required.';
  end if;
  if p_from = p_to then raise exception 'From and To locations must differ.'; end if;
  v_note := coalesce(nullif(p_notes,''), 'Transfer ' || p_from || ' → ' || p_to);
  -- both legs share v_tid and are inserted in ONE transaction; the
  -- ledger's append-only trigger means no post-hoc updates are possible.
  insert into stock_movements (item_id, mv_date, type, qty, ref, dest, notes, location, transfer_id, by_uid, by_name)
  values (p_item_id, coalesce(p_date, current_date), 'out', p_qty, 'TRANSFER', p_to, v_note, p_from, v_tid,
          auth.uid()::text, my_name())
  returning id into v_out;
  insert into stock_movements (item_id, mv_date, type, qty, ref, dest, notes, location, transfer_id, by_uid, by_name)
  values (p_item_id, coalesce(p_date, current_date), 'in', p_qty, 'TRANSFER', p_to, v_note, p_to, v_tid,
          auth.uid()::text, my_name())
  returning id into v_in;
  return jsonb_build_object('outId', v_out, 'inId', v_in, 'transferId', v_tid,
                            'date', coalesce(p_date, current_date));
end $$;

-- =====================================================================
--  16. PLANNING
-- =====================================================================
create table if not exists plan_tasks (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null default demo_project_id() references projects(id),
  name       text not null,
  module     text not null default 'general',
  start_date date not null,
  end_date   date not null,
  progress   numeric not null default 0 check (progress between 0 and 100),
  by_uid     text,
  by_name    text,
  ts         timestamptz not null default now(),
  last_by    text,
  last_at    timestamptz,
  constraint dates_ordered check (end_date >= start_date)
);

create table if not exists task_dependencies (
  task_id        uuid not null references plan_tasks(id) on delete cascade,
  predecessor_id uuid not null references plan_tasks(id) on delete restrict,
  primary key (task_id, predecessor_id),
  constraint no_self_dependency check (task_id <> predecessor_id)
);
-- ON DELETE RESTRICT on predecessor_id gives the "cannot delete a task
-- others depend on" guard for free — the RTDB build needed a manual
-- reverse index (/planning/dependents) to do this; the index and its
-- drift risk are gone.

create table if not exists plan_baselines (
  task_id    uuid primary key references plan_tasks(id) on delete cascade,
  start_date date not null,
  end_date   date not null,
  set_by     text,
  set_at     timestamptz not null default now()
);

create or replace function set_plan_baseline()
  returns int language plpgsql security definer set search_path = public as
$$
declare n int;
begin
  perform rpc_require('admin');
  insert into plan_baselines (task_id, start_date, end_date, set_by, set_at)
  select id, start_date, end_date, auth.uid()::text, now() from plan_tasks
  on conflict (task_id) do update
    set start_date = excluded.start_date, end_date = excluded.end_date,
        set_by = excluded.set_by, set_at = excluded.set_at;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'No tasks to baseline.'; end if;
  return n;
end $$;

-- =====================================================================
--  17. DOCUMENTS
-- =====================================================================
create table if not exists documents (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null default demo_project_id() references projects(id),
  title           text not null,
  category        text not null default 'General',
  module          text not null default 'general',
  status          text not null default 'active' check (status in ('active','archived')),
  current_version uuid,
  by_uid          text,
  by_name         text,
  ts              timestamptz not null default now(),
  last_by         text,
  last_at         timestamptz
);

create table if not exists document_versions (
  id        uuid primary key default gen_random_uuid(),
  doc_id    uuid not null references documents(id) on delete cascade,
  file_url  text not null,
  file_name text not null default 'file',
  size      numeric not null default 0,
  note      text not null default '',
  by_uid    text,
  by_name   text,
  ts        timestamptz not null default now()
);
create index if not exists document_versions_doc_idx on document_versions (doc_id, ts);

-- Create doc + v1 atomically; add-version + pointer-bump atomically.
create or replace function document_create(
  p_title text, p_category text, p_module text,
  p_file_url text, p_file_name text, p_size numeric, p_note text)
  returns jsonb language plpgsql security definer set search_path = public as
$$
declare v_doc uuid; v_ver uuid;
begin
  perform rpc_require('solar','wtg','bop','land','procurement','store','planner');
  insert into documents (title, category, module, by_uid, by_name)
  values (p_title, coalesce(p_category,'General'), coalesce(p_module,'general'),
          auth.uid()::text, my_name())
  returning id into v_doc;
  insert into document_versions (doc_id, file_url, file_name, size, note, by_uid, by_name)
  values (v_doc, p_file_url, coalesce(p_file_name,'file'), coalesce(p_size,0),
          coalesce(nullif(p_note,''),'Initial upload'), auth.uid()::text, my_name())
  returning id into v_ver;
  update documents set current_version = v_ver where id = v_doc;
  return jsonb_build_object('id', v_doc, 'versionId', v_ver);
end $$;

create or replace function document_add_version(
  p_doc_id uuid, p_file_url text, p_file_name text, p_size numeric, p_note text)
  returns uuid language plpgsql security definer set search_path = public as
$$
declare v_ver uuid;
begin
  perform rpc_require('solar','wtg','bop','land','procurement','store','planner');
  if not exists (select 1 from documents where id = p_doc_id) then
    raise exception 'Document not found.';
  end if;
  insert into document_versions (doc_id, file_url, file_name, size, note, by_uid, by_name)
  values (p_doc_id, p_file_url, coalesce(p_file_name,'file'), coalesce(p_size,0),
          coalesce(p_note,''), auth.uid()::text, my_name())
  returning id into v_ver;
  update documents
     set current_version = v_ver, last_by = auth.uid()::text, last_at = now()
   where id = p_doc_id;
  return v_ver;
end $$;

-- =====================================================================
--  17½. ATOMIC JSONB PATCH HELPERS
--  The RTDB build did per-leaf multi-path updates; these RPCs are the
--  Postgres equivalent: one round-trip, no read-modify-write race.
-- =====================================================================

-- Shallow-merge a document row's data (upserting if absent).
-- Table name is whitelisted — this is not a generic SQL runner.
create or replace function merge_doc(p_table text, p_id text, p_patch jsonb)
  returns void language plpgsql security definer set search_path = public as
$$
begin
  if p_table not in ('solar_itcs','wtg_turbines','land_wtg_locs') then
    raise exception 'merge_doc: table % not allowed', p_table;
  end if;
  perform rpc_require(case p_table when 'solar_itcs' then 'solar'
                                   when 'wtg_turbines' then 'wtg'
                                   else 'land' end);
  execute format(
    'insert into %I (id, data, last_by, last_at) values ($1, $2, $3, now())
     on conflict (id) do update
       set data = %I.data || excluded.data, last_by = $3, last_at = now()',
    p_table, p_table)
  using p_id, coalesce(p_patch, '{}'::jsonb), auth.uid()::text;
end $$;

-- Replace a document row's data wholesale (setSolarItc / render-wtg full save).
create or replace function set_doc(p_table text, p_id text, p_value jsonb)
  returns void language plpgsql security definer set search_path = public as
$$
begin
  if p_table not in ('solar_itcs','wtg_turbines','land_wtg_locs') then
    raise exception 'set_doc: table % not allowed', p_table;
  end if;
  perform rpc_require(case p_table when 'solar_itcs' then 'solar'
                                   when 'wtg_turbines' then 'wtg'
                                   else 'land' end);
  execute format(
    'insert into %I (id, data, last_by, last_at) values ($1, $2, $3, now())
     on conflict (id) do update
       set data = excluded.data, last_by = $3, last_at = now()',
    p_table, p_table)
  using p_id, coalesce(p_value, '{}'::jsonb), auth.uid()::text;
end $$;

-- Merge into an ITC's live{} sub-object (updateItcLiveActivities).
create or replace function merge_itc_live(p_id text, p_patch jsonb)
  returns void language plpgsql security definer set search_path = public as
$$
begin
  perform rpc_require('solar');
  insert into solar_itcs (id, data, last_by, last_at)
  values (p_id, jsonb_build_object('live', coalesce(p_patch,'{}'::jsonb)),
          auth.uid()::text, now())
  on conflict (id) do update
    set data = jsonb_set(solar_itcs.data, '{live}',
                         coalesce(solar_itcs.data->'live','{}'::jsonb) || coalesce(p_patch,'{}'::jsonb)),
        last_by = auth.uid()::text, last_at = now();
end $$;

-- Set one index of a land sol-block's acts array (updateSolLand),
-- padding with zeros when the array is shorter than idx.
create or replace function set_sol_block_act(p_id text, p_idx int, p_val numeric)
  returns void language plpgsql security definer set search_path = public as
$$
declare cur jsonb;
begin
  perform rpc_require('land');
  insert into land_sol_blocks (id) values (p_id) on conflict (id) do nothing;
  select acts into cur from land_sol_blocks where id = p_id for update;
  cur := coalesce(cur, '[]'::jsonb);
  while jsonb_array_length(cur) <= p_idx loop
    cur := cur || to_jsonb(0);
  end loop;
  update land_sol_blocks
     set acts = jsonb_set(cur, array[p_idx::text], to_jsonb(p_val)),
         last_by = auth.uid()::text, last_at = now()
   where id = p_id;
end $$;

-- Upsert a BOP activity/asset node. mode 'merge' shallow-merges object
-- data; mode 'replace' overwrites (used for whole stage arrays).
create or replace function merge_bop(p_kind text, p_section text, p_key text,
                                     p_value jsonb, p_mode text default 'merge')
  returns void language plpgsql security definer set search_path = public as
$$
begin
  perform rpc_require('bop');
  if p_kind = 'activity' then
    insert into bop_activities (section, act_key, data, last_by, last_at)
    values (p_section, p_key, coalesce(p_value,'{}'::jsonb), auth.uid()::text, now())
    on conflict (section, act_key) do update
      set data = case when p_mode = 'replace'
                        or jsonb_typeof(bop_activities.data) <> 'object'
                        or jsonb_typeof(excluded.data) <> 'object'
                      then excluded.data
                      else bop_activities.data || excluded.data end,
          last_by = auth.uid()::text, last_at = now();
  elsif p_kind = 'asset' then
    insert into bop_assets (section, asset_key, data, last_by, last_at)
    values (p_section, p_key, coalesce(p_value,'{}'::jsonb), auth.uid()::text, now())
    on conflict (section, asset_key) do update
      set data = case when p_mode = 'replace'
                        or jsonb_typeof(bop_assets.data) <> 'object'
                        or jsonb_typeof(excluded.data) <> 'object'
                      then excluded.data
                      else bop_assets.data || excluded.data end,
          last_by = auth.uid()::text, last_at = now();
  else
    raise exception 'merge_bop: kind must be activity|asset';
  end if;
end $$;

-- Set one index of a 66kV feeder's stage array (updateBop66Act).
create or replace function set_bop66_act(p_key text, p_idx int, p_val numeric)
  returns void language plpgsql security definer set search_path = public as
$$
declare cur jsonb;
begin
  perform rpc_require('bop');
  insert into bop_activities (section, act_key, data)
  values ('66kv', p_key, '[]'::jsonb)
  on conflict (section, act_key) do nothing;
  select data into cur from bop_activities
   where section = '66kv' and act_key = p_key for update;
  if jsonb_typeof(cur) <> 'array' then cur := '[]'::jsonb; end if;
  while jsonb_array_length(cur) <= p_idx loop
    cur := cur || to_jsonb(0);
  end loop;
  update bop_activities
     set data = jsonb_set(cur, array[p_idx::text], to_jsonb(p_val)),
         last_by = auth.uid()::text, last_at = now()
   where section = '66kv' and act_key = p_key;
end $$;

-- =====================================================================
--  18. ATTACH ROW-CHANGE AUDIT TRIGGERS (every business table)
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'pod_entries','next_day_plans','daily_progress',
    'solar_itcs','solar_activities','wtg_turbines',
    'bop_assets','bop_activities',
    'land_wtg_locs','land_sol_blocks','land_leases','land_parcels',
    'hse_observations','hse_employees',
    'milestones','blockers','row_issues','snapshots','module_state',
    'vendors','purchase_orders','po_line_items','po_status_history',
    'inventory_items','stock_movements',
    'plan_tasks','task_dependencies','plan_baselines',
    'documents','document_versions','users'
  ] loop
    call attach_audit(t::regclass);
  end loop;
end $$;

-- =====================================================================
--  19. REALTIME PUBLICATION (Supabase)
--  On Supabase, tables must be in the supabase_realtime publication for
--  postgres_changes to stream. No-op on a plain local Postgres.
-- =====================================================================
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array[
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
      begin
        execute format('alter publication supabase_realtime add table %I', t);
      exception when duplicate_object then null;
      end;
    end loop;
  end if;
end $$;
