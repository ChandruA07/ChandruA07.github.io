-- =====================================================================
--  seed-users.sql — assign roles to the demo accounts (Phase 6 step 4).
--
--  PREREQUISITE: create the users first in the Supabase dashboard
--  (Authentication → Users → Add user) with the emails below — see
--  docs/supabase/DEPLOYMENT.md §4. The handle_new_user trigger gives
--  every new account role 'viewer'; this file promotes them.
--
--  Edit the email→role pairs to match your organisation, then run in
--  the Supabase SQL editor. Idempotent.
-- =====================================================================

with wanted (email, role) as (
  values
    ('solar@swppl.demo', 'solar'),
    ('wtg@swppl.demo',   'wtg'),
    ('bop@swppl.demo',   'bop'),
    ('land@swppl.demo',  'land'),
    ('proc@swppl.demo',  'procurement'),
    ('store@swppl.demo', 'store'),
    ('plan@swppl.demo',  'planner'),
    ('admin@swppl.demo', 'admin')
)
update users u
   set role = w.role
  from wanted w
 where lower(u.email) = lower(w.email);

-- Report what happened (and which accounts are still missing in auth):
select w.email,
       coalesce(u.role, '⚠ NOT CREATED IN SUPABASE AUTH YET') as assigned_role
  from (values
    ('solar@swppl.demo'), ('wtg@swppl.demo'), ('bop@swppl.demo'),
    ('land@swppl.demo'), ('proc@swppl.demo'), ('store@swppl.demo'),
    ('plan@swppl.demo'), ('admin@swppl.demo')
  ) w(email)
  left join users u on lower(u.email) = lower(w.email)
 order by w.email;
