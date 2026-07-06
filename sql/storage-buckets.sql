-- =====================================================================
--  storage-buckets.sql — Supabase Storage setup (replaces Firebase
--  security/storage.rules). Run in the Supabase SQL editor AFTER
--  schema.sql. Safe to re-run.
--
--  Two buckets:
--    photos     — HSE/POD/ITC/sub-activity images. Public READ (the
--                 dashboard shows photos to signed-out visitors is no
--                 longer true post-Phase-6, but photo URLs embedded in
--                 rows must render without signed-URL churn).
--    documents  — document-management files + PO attachments.
--                 Public READ of the file given its (unguessable
--                 timestamp+random) path; listing is not public.
--
--  WRITES require a signed-in non-viewer, mirroring the Firebase
--  storage.rules this replaces. Size/type limits are enforced in TWO
--  places: bucket config below (server-side) and js/storage.js (UX).
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('photos', 'photos', true, 5242880,
   array['image/png','image/jpeg','image/webp','image/gif']),
  ('documents', 'documents', true, 10485760,
   array['image/png','image/jpeg','image/webp','image/gif',
         'application/pdf','application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'application/vnd.openxmlformats-officedocument.presentationml.presentation',
         'text/csv','text/plain'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Upload: any signed-in non-viewer.
drop policy if exists "swppl upload" on storage.objects;
create policy "swppl upload" on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('photos','documents')
    and coalesce((select role from public.users where id = auth.uid()), 'viewer')
        not in ('viewer')
  );

-- Delete: uploader or admin.
drop policy if exists "swppl delete" on storage.objects;
create policy "swppl delete" on storage.objects for delete
  to authenticated
  using (
    bucket_id in ('photos','documents')
    and (owner = auth.uid()
         or (select role from public.users where id = auth.uid()) = 'admin')
  );

-- Read: buckets are public (URL-based access); authenticated may list.
drop policy if exists "swppl list" on storage.objects;
create policy "swppl list" on storage.objects for select
  to authenticated
  using (bucket_id in ('photos','documents'));
