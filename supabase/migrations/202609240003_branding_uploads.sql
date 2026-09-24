-- iMersOrder branding assets: public, non-sensitive logo/favicon only.
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do update set public = true;

drop policy if exists branding_public_read on storage.objects;
create policy branding_public_read on storage.objects
for select to public
using (bucket_id = 'branding');

drop policy if exists branding_owner_insert on storage.objects;
create policy branding_owner_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'branding'
  and (storage.foldername(name))[1] in (
    select bm.business_id::text
    from public.business_members bm
    where bm.user_id = auth.uid() and bm.role = 'owner' and bm.status = 'active'
  )
);

drop policy if exists branding_owner_update on storage.objects;
create policy branding_owner_update on storage.objects
for update to authenticated
using (
  bucket_id = 'branding'
  and (storage.foldername(name))[1] in (
    select bm.business_id::text
    from public.business_members bm
    where bm.user_id = auth.uid() and bm.role = 'owner' and bm.status = 'active'
  )
)
with check (
  bucket_id = 'branding'
  and (storage.foldername(name))[1] in (
    select bm.business_id::text
    from public.business_members bm
    where bm.user_id = auth.uid() and bm.role = 'owner' and bm.status = 'active'
  )
);

drop policy if exists branding_owner_delete on storage.objects;
create policy branding_owner_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'branding'
  and (storage.foldername(name))[1] in (
    select bm.business_id::text
    from public.business_members bm
    where bm.user_id = auth.uid() and bm.role = 'owner' and bm.status = 'active'
  )
);
