-- iMersOrder r17: harden branding upload storage for existing installations.
-- Safe to run repeatedly. Branding assets are public, non-sensitive logo/favicon files only.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branding', 'branding', true, 2097152, array['image/png','image/jpeg','image/webp','image/x-icon']::text[])
on conflict (id) do update
set public = true,
    file_size_limit = 2097152,
    allowed_mime_types = array['image/png','image/jpeg','image/webp','image/x-icon']::text[];

drop policy if exists branding_public_read on storage.objects;
create policy branding_public_read on storage.objects
for select to public
using (bucket_id = 'branding');

drop policy if exists branding_owner_insert on storage.objects;
create policy branding_owner_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'branding'
  and exists (
    select 1
    from public.business_members bm
    where bm.user_id = auth.uid()
      and bm.business_id::text = (storage.foldername(name))[1]
      and bm.role = 'owner'
      and bm.status = 'active'
  )
);

drop policy if exists branding_owner_update on storage.objects;
create policy branding_owner_update on storage.objects
for update to authenticated
using (
  bucket_id = 'branding'
  and exists (
    select 1
    from public.business_members bm
    where bm.user_id = auth.uid()
      and bm.business_id::text = (storage.foldername(name))[1]
      and bm.role = 'owner'
      and bm.status = 'active'
  )
)
with check (
  bucket_id = 'branding'
  and exists (
    select 1
    from public.business_members bm
    where bm.user_id = auth.uid()
      and bm.business_id::text = (storage.foldername(name))[1]
      and bm.role = 'owner'
      and bm.status = 'active'
  )
);

drop policy if exists branding_owner_delete on storage.objects;
create policy branding_owner_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'branding'
  and exists (
    select 1
    from public.business_members bm
    where bm.user_id = auth.uid()
      and bm.business_id::text = (storage.foldername(name))[1]
      and bm.role = 'owner'
      and bm.status = 'active'
  )
);
