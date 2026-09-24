-- iMersOrders Cloud multi-tenant foundation, based on iMersOrder r28
-- Run after the r28 MASTER SQL. Safe/idempotent where practical.

alter table public.businesses alter column owner_user_id drop not null;
alter table public.businesses add column if not exists tenant_status text not null default 'active' check (tenant_status in ('active','expiring','expired','suspended'));
alter table public.businesses add column if not exists subscription_plan text not null default 'starter';
alter table public.businesses add column if not exists subscription_started_at timestamptz;
alter table public.businesses add column if not exists subscription_ends_at timestamptz;
alter table public.businesses add column if not exists max_products integer not null default 100;
alter table public.businesses add column if not exists max_users integer not null default 5;
alter table public.businesses add column if not exists directory_visible boolean not null default true;
alter table public.businesses add column if not exists cloud_notes text;

create table if not exists public.cloud_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.cloud_admins enable row level security;

create or replace function public.is_cloud_super_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.cloud_admins where user_id=auth.uid());
$$;

create table if not exists public.cloud_guides (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  content text,
  youtube_url text,
  external_url text,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.cloud_guides enable row level security;

create or replace function public.get_cloud_directory()
returns jsonb language sql security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',b.id,'name',b.name,'slug',b.slug,'logo_url',b.logo_url,
    'description',coalesce((select value->>'text' from public.business_settings where business_id=b.id and key='catalog_description' limit 1),''),
    'plan',b.subscription_plan
  ) order by b.name), '[]'::jsonb)
  from public.businesses b
  where b.is_active=true and b.deleted_at is null and b.tenant_status <> 'suspended' and b.directory_visible=true;
$$;

create or replace function public.get_published_cloud_guides()
returns jsonb language sql security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'title',title,'description',description,'content',content,
    'youtube_url',youtube_url,'external_url',external_url,'sort_order',sort_order
  ) order by sort_order,created_at), '[]'::jsonb)
  from public.cloud_guides where is_published=true;
$$;

create or replace function public.get_public_catalog_by_slug(p_slug text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.businesses%rowtype; s jsonb:='{}'; items jsonb:='[]'; fields jsonb:='[]'; enabled boolean:=false;
begin
 select * into b from public.businesses where lower(slug)=lower(trim(p_slug)) and is_active=true and deleted_at is null and tenant_status not in ('suspended','expired') limit 1;
 if not found then return jsonb_build_object('enabled',false); end if;
 select coalesce((value->>'enabled')::boolean,false) into enabled from public.business_settings where business_id=b.id and key='catalog_enabled';
 if not enabled then return jsonb_build_object('enabled',false); end if;
 select coalesce(jsonb_object_agg(key,value),'{}') into s from public.business_settings where business_id=b.id and key in ('catalog_description','catalog_show_prices','catalog_accept_orders','appearance_theme','promo_popup','promo_marquee');
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'sku',sku,'unit',unit,'price',price,'description',description,'category',coalesce(nullif(trim(category),''),'Lainnya'),'image_url',image_url) order by category nulls last,name),'[]') into items from public.catalog_items where business_id=b.id and is_active=true and deleted_at is null;
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'key',d.field_key,'label',d.label,'type',d.field_type,'help_text',d.help_text,'placeholder',d.placeholder,'required',d.is_required,'sort_order',d.sort_order,'options',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'label',o.label,'value',o.value) order by o.sort_order) from public.custom_field_options o where o.definition_id=d.id),'[]')) order by d.sort_order,d.created_at),'[]') into fields from public.custom_field_definitions d where d.business_id=b.id and d.entity_type='order' and d.is_active=true and d.customer_visible=true and d.internal_only=false;
 return jsonb_build_object('enabled',true,'business',jsonb_build_object('id',b.id,'name',b.name,'logo_url',b.logo_url,'address',b.address,'whatsapp',b.whatsapp,'email',b.email),'settings',s,'items',items,'fields',fields);
end $$;

create or replace function public.submit_public_catalog_order_by_slug(p_slug text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.businesses%rowtype; result jsonb;
begin
 select * into b from public.businesses where lower(slug)=lower(trim(p_slug)) and is_active=true and deleted_at is null and tenant_status not in ('suspended','expired') limit 1;
 if not found then raise exception 'Tenant tidak ditemukan atau tidak aktif'; end if;
 -- Reuse the proven public-order engine by setting the tenant-safe payload marker.
 -- The body below mirrors the existing function's contract while forcing the selected business.
 result := public.submit_public_catalog_order(jsonb_set(coalesce(p_payload,'{}'::jsonb),'{_cloud_business_id}',to_jsonb(b.id),true));
 return result;
end $$;

-- The master public-order function honors the _cloud_business_id marker for tenant-safe public orders.

drop policy if exists cloud_admins_self on public.cloud_admins;
create policy cloud_admins_self on public.cloud_admins for select to authenticated using (user_id=auth.uid());
create policy cloud_guides_public on public.cloud_guides for select to anon,authenticated using (is_published=true);
create policy cloud_guides_admin_all on public.cloud_guides for all to authenticated using (public.is_cloud_super_admin()) with check (public.is_cloud_super_admin());

-- Super admin can manage tenant metadata, but operational tables remain protected by normal tenant membership RLS.
drop policy if exists businesses_cloud_admin_read on public.businesses;
create policy businesses_cloud_admin_read on public.businesses for select to authenticated using (public.is_cloud_super_admin());
drop policy if exists businesses_cloud_admin_update on public.businesses;
create policy businesses_cloud_admin_update on public.businesses for update to authenticated using (public.is_cloud_super_admin()) with check (public.is_cloud_super_admin());
drop policy if exists businesses_cloud_admin_insert on public.businesses;
create policy businesses_cloud_admin_insert on public.businesses for insert to authenticated with check (public.is_cloud_super_admin());

grant select on public.cloud_admins to authenticated;
grant select on public.cloud_guides to anon,authenticated;
grant insert,update,delete on public.cloud_guides to authenticated;
grant select,insert,update on public.businesses to authenticated;


create or replace function public.cloud_create_tenant(
  p_name text, p_slug text, p_plan text default 'starter', p_max_products integer default 100,
  p_max_users integer default 5, p_subscription_ends_at timestamptz default null
)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if not public.is_cloud_super_admin() then raise exception 'SUPER_ADMIN_REQUIRED'; end if;
  if nullif(trim(p_name),'') is null or nullif(trim(p_slug),'') is null then raise exception 'Nama dan slug wajib diisi'; end if;
  if exists(select 1 from public.businesses where lower(slug)=lower(trim(p_slug)) and deleted_at is null) then raise exception 'Slug sudah digunakan'; end if;
  insert into public.businesses(owner_user_id,name,slug,is_active,tenant_status,subscription_plan,max_products,max_users,subscription_started_at,subscription_ends_at,directory_visible)
  values(null,trim(p_name),lower(trim(p_slug)),true,'active',coalesce(nullif(trim(p_plan),''),'starter'),greatest(1,p_max_products),greatest(1,p_max_users),now(),p_subscription_ends_at,true)
  returning id into v_id;
  insert into public.business_settings(business_id,key,value) values
    (v_id,'catalog_enabled','{"enabled":false}'::jsonb),
    (v_id,'catalog_description','{"text":"Katalog online & pesanan"}'::jsonb),
    (v_id,'catalog_show_prices','{"enabled":true}'::jsonb),
    (v_id,'catalog_accept_orders','{"enabled":true}'::jsonb)
  on conflict (business_id,key) do nothing;
  return v_id;
end $$;

create or replace function public.cloud_update_tenant(
  p_tenant_id uuid, p_status text default null, p_plan text default null,
  p_max_products integer default null, p_max_users integer default null,
  p_subscription_ends_at timestamptz default null, p_directory_visible boolean default null
)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not public.is_cloud_super_admin() then raise exception 'SUPER_ADMIN_REQUIRED'; end if;
  update public.businesses set
    tenant_status=coalesce(p_status,tenant_status), subscription_plan=coalesce(p_plan,subscription_plan),
    max_products=coalesce(p_max_products,max_products), max_users=coalesce(p_max_users,max_users),
    subscription_ends_at=case when p_subscription_ends_at is null then subscription_ends_at else p_subscription_ends_at end,
    directory_visible=coalesce(p_directory_visible,directory_visible), updated_at=now()
  where id=p_tenant_id and deleted_at is null;
  return found;
end $$;

create or replace function public.cloud_assign_owner(p_tenant_id uuid,p_email text)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_user uuid;
begin
  if not public.is_cloud_super_admin() then raise exception 'SUPER_ADMIN_REQUIRED'; end if;
  select id into v_user from auth.users where lower(email)=lower(trim(p_email)) limit 1;
  if v_user is null then raise exception 'USER_EMAIL_NOT_FOUND'; end if;
  update public.businesses set owner_user_id=v_user,updated_at=now() where id=p_tenant_id;
  insert into public.business_members(business_id,user_id,role,status,joined_at) values(p_tenant_id,v_user,'owner','active',now())
  on conflict(business_id,user_id) do update set role='owner',status='active',joined_at=now();
  return true;
end $$;

create or replace function public.cloud_upsert_guide(
  p_id uuid, p_title text, p_description text, p_content text, p_youtube_url text, p_external_url text,
  p_sort_order integer default 0, p_is_published boolean default true
)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if not public.is_cloud_super_admin() then raise exception 'SUPER_ADMIN_REQUIRED'; end if;
  if nullif(trim(p_title),'') is null then raise exception 'Judul panduan wajib diisi'; end if;
  if p_id is null then
    insert into public.cloud_guides(title,description,content,youtube_url,external_url,sort_order,is_published,created_by)
    values(trim(p_title),nullif(trim(p_description),''),nullif(trim(p_content),''),nullif(trim(p_youtube_url),''),nullif(trim(p_external_url),''),coalesce(p_sort_order,0),coalesce(p_is_published,true),auth.uid()) returning id into v_id;
  else
    update public.cloud_guides set title=trim(p_title),description=nullif(trim(p_description),''),content=nullif(trim(p_content),''),youtube_url=nullif(trim(p_youtube_url),''),external_url=nullif(trim(p_external_url),''),sort_order=coalesce(p_sort_order,0),is_published=coalesce(p_is_published,true),updated_at=now() where id=p_id returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public.cloud_delete_guide(p_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not public.is_cloud_super_admin() then raise exception 'SUPER_ADMIN_REQUIRED'; end if;
  delete from public.cloud_guides where id=p_id;
  return found;
end $$;

grant execute on function public.cloud_create_tenant(text,text,text,integer,integer,timestamptz) to authenticated;
grant execute on function public.cloud_update_tenant(uuid,text,text,integer,integer,timestamptz,boolean) to authenticated;
grant execute on function public.cloud_assign_owner(uuid,text) to authenticated;
grant execute on function public.cloud_upsert_guide(uuid,text,text,text,text,text,integer,boolean) to authenticated;
grant execute on function public.cloud_delete_guide(uuid) to authenticated;


create or replace function public.get_public_branding_by_slug(p_slug text)
returns jsonb language sql security definer set search_path=public as $$
  select jsonb_build_object(
    'id',b.id,'name',b.name,'logo_url',b.logo_url,
    'favicon_url',coalesce((select value->>'url' from public.business_settings where business_id=b.id and key='favicon_url' limit 1),''),
    'use_logo_as_favicon',coalesce(((select value->>'enabled' from public.business_settings where business_id=b.id and key='use_logo_as_favicon' limit 1))::boolean,true)
  )
  from public.businesses b
  where lower(b.slug)=lower(trim(p_slug)) and b.is_active=true and b.deleted_at is null and b.tenant_status not in ('suspended','expired')
  limit 1;
$$;
grant execute on function public.get_public_branding_by_slug(text) to anon,authenticated;

grant execute on function public.get_cloud_directory() to anon,authenticated;
grant execute on function public.get_published_cloud_guides() to anon,authenticated;
grant execute on function public.get_public_catalog_by_slug(text) to anon,authenticated;
grant execute on function public.submit_public_catalog_order_by_slug(text,jsonb) to anon,authenticated;
