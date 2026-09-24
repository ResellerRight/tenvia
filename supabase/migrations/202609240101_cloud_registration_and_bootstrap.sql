-- iMersOrders Cloud r31: public tenant registration toggle + first-user Super Admin bootstrap

create table if not exists public.cloud_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.cloud_settings enable row level security;

insert into public.cloud_settings(key,value)
values ('tenant_registration', '{"enabled":true}'::jsonb)
on conflict (key) do nothing;

create or replace function public.is_cloud_registration_enabled()
returns boolean
language sql stable security definer set search_path=public
as $$
  select coalesce((select (value->>'enabled')::boolean from public.cloud_settings where key='tenant_registration' limit 1), true);
$$;

grant execute on function public.is_cloud_registration_enabled() to anon, authenticated;

drop policy if exists cloud_settings_admin_all on public.cloud_settings;
create policy cloud_settings_admin_all on public.cloud_settings
for all to authenticated
using (public.is_cloud_super_admin())
with check (public.is_cloud_super_admin());

grant select, insert, update, delete on public.cloud_settings to authenticated;

create or replace function public.set_cloud_registration_enabled(p_enabled boolean)
returns boolean
language plpgsql security definer set search_path=public
as $$
begin
  if not public.is_cloud_super_admin() then raise exception 'SUPER_ADMIN_REQUIRED'; end if;
  insert into public.cloud_settings(key,value,updated_at)
  values ('tenant_registration',jsonb_build_object('enabled',coalesce(p_enabled,true)),now())
  on conflict (key) do update set value=excluded.value, updated_at=now();
  return coalesce(p_enabled,true);
end;
$$;
grant execute on function public.set_cloud_registration_enabled(boolean) to authenticated;

-- The very first Supabase Auth user becomes the global Cloud Super Admin automatically.
-- Super Admin is intentionally tenantless.
create or replace function public.bootstrap_first_cloud_admin()
returns trigger
language plpgsql security definer set search_path=public
as $$
begin
  if not exists (select 1 from public.cloud_admins) then
    insert into public.cloud_admins(user_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bootstrap_first_cloud_admin on auth.users;
create trigger trg_bootstrap_first_cloud_admin
after insert on auth.users
for each row execute function public.bootstrap_first_cloud_admin();

-- Enforce the registration switch at the database boundary as well as in the UI.
create or replace function public.create_business(
  p_name text, p_slug text, p_template_slug text default 'catering', p_seed_demo boolean default false
)
returns uuid
language plpgsql security definer set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_business_id uuid;
  v_template_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.is_cloud_super_admin() and not public.is_cloud_registration_enabled() then
    raise exception 'TENANT_REGISTRATION_DISABLED';
  end if;
  if nullif(trim(p_name),'') is null or nullif(trim(p_slug),'') is null then
    raise exception 'Business name and slug are required';
  end if;
  if not exists (select 1 from public.profiles where id=v_user) then
    insert into public.profiles(id) values(v_user) on conflict do nothing;
  end if;
  select id into v_template_id from public.business_templates where slug=p_template_slug and is_active=true;
  if v_template_id is null and p_template_slug <> 'blank' then raise exception 'Unknown or inactive business template: %', p_template_slug; end if;
  insert into public.businesses(owner_user_id,template_slug,name,slug)
  values(v_user,p_template_slug,trim(p_name),lower(trim(p_slug))) returning id into v_business_id;
  insert into public.business_members(business_id,user_id,role,status,joined_at)
  values(v_business_id,v_user,'owner','active',now());
  if v_template_id is not null then
    insert into public.custom_field_definitions(business_id,field_key,label,field_type,entity_type,placeholder,is_required,show_on_invoice,customer_visible,internal_only,sort_order)
    select v_business_id,tf.field_key,tf.label,tf.field_type,tf.entity_type,tf.placeholder,tf.is_required,tf.show_on_invoice,tf.customer_visible,tf.internal_only,tf.sort_order
    from public.business_template_fields tf where tf.template_id=v_template_id order by tf.sort_order;
    insert into public.custom_field_options(business_id,definition_id,label,value,sort_order)
    select v_business_id,d.id,x.value->>'label',coalesce(x.value->>'value',x.value->>'label'),(x.ordinality-1)::integer
    from public.business_template_fields tf join public.custom_field_definitions d on d.business_id=v_business_id and d.field_key=tf.field_key and d.entity_type=tf.entity_type
    cross join lateral jsonb_array_elements(tf.options) with ordinality as x(value,ordinality)
    where tf.template_id=v_template_id and jsonb_array_length(tf.options)>0;
  end if;
  insert into public.message_templates(business_id,event_key,name,body) values
    (v_business_id,'invoice_issued','Invoice Baru','Halo {{customer_name}}, invoice {{invoice_number}} sebesar {{grand_total}} sudah dibuat. Sisa tagihan: {{balance_due}}. {{invoice_url}}'),
    (v_business_id,'due_reminder','Pengingat Jatuh Tempo','Halo {{customer_name}}, pengingat untuk tagihan {{invoice_number}} dengan sisa {{balance_due}} yang jatuh tempo {{due_date}}. {{invoice_url}}'),
    (v_business_id,'payment_received','Pembayaran Diterima','Terima kasih {{customer_name}}. Pembayaran {{payment_amount}} untuk {{invoice_number}} sudah kami catat. Sisa tagihan: {{balance_due}}.'),
    (v_business_id,'order_ready','Pesanan Siap','Halo {{customer_name}}, pesanan {{order_number}} sudah siap. Terima kasih sudah berbelanja bersama kami.');
  insert into public.business_settings(business_id,key,value) values
    (v_business_id,'ui',jsonb_build_object('theme','emerald','mobile_first',true)),
    (v_business_id,'whatsapp',jsonb_build_object('provider','manual','auto_send_enabled',false)),
    (v_business_id,'invoice',jsonb_build_object('show_logo',true,'show_payment_history',true));
  return v_business_id;
end;
$$;
grant execute on function public.create_business(text,text,text,boolean) to authenticated;


-- Tenant owner invitation flow. This remains available even when public tenant registration is disabled.
create table if not exists public.cloud_tenant_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.businesses(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.cloud_tenant_invitations enable row level security;

create or replace function public.cloud_create_owner_invitation(p_tenant_id uuid,p_email text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_token text; v_hash text; v_id uuid; v_exp timestamptz := now()+interval '7 days'; v_slug text;
begin
  if not public.is_cloud_super_admin() then raise exception 'SUPER_ADMIN_REQUIRED'; end if;
  if nullif(trim(p_email),'') is null then raise exception 'Email wajib diisi'; end if;
  select slug into v_slug from public.businesses where id=p_tenant_id and deleted_at is null;
  if v_slug is null then raise exception 'TENANT_NOT_FOUND'; end if;
  update public.cloud_tenant_invitations set revoked_at=now() where tenant_id=p_tenant_id and lower(email)=lower(trim(p_email)) and accepted_at is null and revoked_at is null;
  v_token := replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
  v_hash := md5(v_token);
  insert into public.cloud_tenant_invitations(tenant_id,email,token_hash,expires_at,invited_by) values(p_tenant_id,lower(trim(p_email)),v_hash,v_exp,auth.uid()) returning id into v_id;
  return jsonb_build_object('invitation_id',v_id,'token',v_token,'expires_at',v_exp,'slug',v_slug,'email',lower(trim(p_email)));
end;
$$;

create or replace function public.get_cloud_owner_invitation_preview(p_token text)
returns jsonb language sql security definer set search_path=public as $$
  select jsonb_build_object('email',i.email,'tenant_id',i.tenant_id,'tenant_name',b.name,'slug',b.slug,'expires_at',i.expires_at)
  from public.cloud_tenant_invitations i join public.businesses b on b.id=i.tenant_id
  where i.token_hash=md5(coalesce(p_token,'')) and i.accepted_at is null and i.revoked_at is null and i.expires_at>now() and b.deleted_at is null
  limit 1;
$$;

create or replace function public.accept_cloud_owner_invitation(p_token text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_inv public.cloud_tenant_invitations%rowtype; v_email text:=lower(coalesce(auth.jwt()->>'email','')); v_slug text;
begin
  if auth.uid() is null then raise exception 'Login is required'; end if;
  select * into v_inv from public.cloud_tenant_invitations where token_hash=md5(coalesce(p_token,'')) and accepted_at is null and revoked_at is null and expires_at>now() for update;
  if not found then raise exception 'Invitation tidak valid atau sudah kedaluwarsa'; end if;
  if lower(v_inv.email)<>v_email then raise exception 'Undangan ini ditujukan untuk email lain'; end if;
  update public.businesses set owner_user_id=auth.uid(),updated_at=now() where id=v_inv.tenant_id and deleted_at is null;
  insert into public.business_members(business_id,user_id,role,status,joined_at) values(v_inv.tenant_id,auth.uid(),'owner','active',now()) on conflict(business_id,user_id) do update set role='owner',status='active',joined_at=coalesce(public.business_members.joined_at,now());
  update public.cloud_tenant_invitations set accepted_at=now() where id=v_inv.id;
  select slug into v_slug from public.businesses where id=v_inv.tenant_id;
  return jsonb_build_object('tenant_id',v_inv.tenant_id,'slug',v_slug,'role','owner');
end;
$$;

drop policy if exists cloud_tenant_invitation_admin on public.cloud_tenant_invitations;
create policy cloud_tenant_invitation_admin on public.cloud_tenant_invitations for all to authenticated using (public.is_cloud_super_admin()) with check (public.is_cloud_super_admin());
grant select,insert,update,delete on public.cloud_tenant_invitations to authenticated;
grant execute on function public.cloud_create_owner_invitation(uuid,text) to authenticated;
grant execute on function public.get_cloud_owner_invitation_preview(text) to anon,authenticated;
grant execute on function public.accept_cloud_owner_invitation(text) to authenticated;
