-- iMersOrder r22: product image upload + square catalog presentation
alter table public.catalog_items add column if not exists image_url text;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('product-images','product-images',true,2097152,array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public=true,file_size_limit=2097152,allowed_mime_types=array['image/png','image/jpeg','image/webp'];

drop policy if exists product_images_public_read on storage.objects;
create policy product_images_public_read on storage.objects for select to public using (bucket_id='product-images');

drop policy if exists product_images_member_insert on storage.objects;
create policy product_images_member_insert on storage.objects for insert to authenticated with check (bucket_id='product-images' and (storage.foldername(name))[1] in (select bm.business_id::text from public.business_members bm where bm.user_id=auth.uid() and bm.status='active'));

drop policy if exists product_images_owner_update on storage.objects;
create policy product_images_owner_update on storage.objects for update to authenticated using (bucket_id='product-images' and (storage.foldername(name))[1] in (select bm.business_id::text from public.business_members bm where bm.user_id=auth.uid() and bm.status='active' and bm.role in ('owner','admin'))) with check (bucket_id='product-images' and (storage.foldername(name))[1] in (select bm.business_id::text from public.business_members bm where bm.user_id=auth.uid() and bm.status='active' and bm.role in ('owner','admin')));

drop policy if exists product_images_owner_delete on storage.objects;
create policy product_images_owner_delete on storage.objects for delete to authenticated using (bucket_id='product-images' and (storage.foldername(name))[1] in (select bm.business_id::text from public.business_members bm where bm.user_id=auth.uid() and bm.status='active' and bm.role in ('owner','admin')));

create or replace function public.get_public_catalog()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business public.businesses%rowtype;
  v_enabled boolean := false;
  v_settings jsonb := '{}'::jsonb;
  v_items jsonb := '[]'::jsonb;
  v_fields jsonb := '[]'::jsonb;
begin
  select * into v_business
  from public.businesses
  where is_active = true and deleted_at is null
  order by created_at
  limit 1;

  if not found then return jsonb_build_object('enabled',false); end if;

  select coalesce((value ->> 'enabled')::boolean,false)
    into v_enabled
  from public.business_settings
  where business_id = v_business.id and key = 'catalog_enabled';

  if not v_enabled then return jsonb_build_object('enabled',false); end if;

  select coalesce(jsonb_object_agg(key,value), '{}'::jsonb)
    into v_settings
  from public.business_settings
  where business_id = v_business.id
    and key in ('catalog_description','catalog_show_prices','catalog_accept_orders','appearance_theme');

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'name',name,'sku',sku,'unit',unit,'price',price,
    'description',description,'category',coalesce(nullif(trim(category),''),'Lainnya'),'image_url',image_url
  ) order by category nulls last, name), '[]'::jsonb)
    into v_items
  from public.catalog_items
  where business_id = v_business.id and is_active = true and deleted_at is null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',d.id,'key',d.field_key,'label',d.label,'type',d.field_type,
    'help_text',d.help_text,'placeholder',d.placeholder,'required',d.is_required,
    'sort_order',d.sort_order,
    'options',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'label',o.label,'value',o.value) order by o.sort_order)
      from public.custom_field_options o where o.definition_id=d.id), '[]'::jsonb)
  ) order by d.sort_order,d.created_at), '[]'::jsonb)
    into v_fields
  from public.custom_field_definitions d
  where d.business_id=v_business.id
    and d.entity_type='order'
    and d.is_active=true
    and d.customer_visible=true
    and d.internal_only=false;

  return jsonb_build_object(
    'enabled',true,
    'business',jsonb_build_object('id',v_business.id,'name',v_business.name,'logo_url',v_business.logo_url,'address',v_business.address,'whatsapp',v_business.whatsapp,'email',v_business.email),
    'settings',v_settings,
    'items',v_items,
    'fields',v_fields
  );
end;
$$;

create or replace function public.submit_public_catalog_order(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business public.businesses%rowtype;
  v_enabled boolean := false;
  v_accept boolean := true;
  v_customer_id uuid;
  v_order_id uuid;
  v_order_number text;
  v_item jsonb;
  v_cf jsonb;
  v_count integer := 0;
begin
  select * into v_business from public.businesses
  where is_active=true and deleted_at is null order by created_at limit 1;
  if not found then raise exception 'Business not found'; end if;

  select coalesce((value ->> 'enabled')::boolean,false) into v_enabled
  from public.business_settings where business_id=v_business.id and key='catalog_enabled';
  if not v_enabled then raise exception 'Katalog online sedang tidak aktif'; end if;

  select coalesce((value ->> 'enabled')::boolean,true) into v_accept
  from public.business_settings where business_id=v_business.id and key='catalog_accept_orders';
  if not v_accept then raise exception 'Pesanan online sedang tidak tersedia'; end if;

  if nullif(trim(p_payload->>'name'),'') is null then raise exception 'Nama wajib diisi'; end if;
  if nullif(trim(p_payload->>'whatsapp'),'') is null then raise exception 'WhatsApp wajib diisi'; end if;
  if jsonb_typeof(coalesce(p_payload->'items','[]'::jsonb)) <> 'array' then raise exception 'Item pesanan tidak valid'; end if;

  select id into v_customer_id from public.customers
  where business_id=v_business.id and deleted_at is null and whatsapp=trim(p_payload->>'whatsapp')
  order by created_at desc limit 1;

  if v_customer_id is null then
    insert into public.customers(business_id,name,whatsapp,email,address,notes,created_by)
    values(v_business.id,trim(p_payload->>'name'),trim(p_payload->>'whatsapp'),nullif(trim(p_payload->>'email'),''),nullif(trim(p_payload->>'address'),''),nullif(trim(p_payload->>'note'),''),null)
    returning id into v_customer_id;
  else
    update public.customers set name=trim(p_payload->>'name'), email=nullif(trim(p_payload->>'email'),''), address=nullif(trim(p_payload->>'address'),''), updated_at=now()
    where id=v_customer_id;
  end if;

  v_order_number := public.next_document_number(v_business.id,'order');
  insert into public.orders(business_id,customer_id,order_number,status,order_date,expected_date,customer_notes,created_by)
  values(v_business.id,v_customer_id,v_order_number,'confirmed',current_date,nullif(p_payload->>'expected_date','')::date,nullif(trim(p_payload->>'note'),''),null)
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_payload->'items') loop
    if v_item->>'catalog_item_id' is null then continue; end if;
    insert into public.order_items(business_id,order_id,catalog_item_id,name,description,qty,unit,unit_price,line_discount,sort_order)
    select v_business.id,v_order_id,c.id,c.name,c.description,
      greatest(least(coalesce((v_item->>'qty')::numeric,1),10000),0.001),c.unit,c.price,0,v_count
    from public.catalog_items c
    where c.id=(v_item->>'catalog_item_id')::uuid and c.business_id=v_business.id and c.is_active=true and c.deleted_at is null;
    if not found then raise exception 'Produk tidak tersedia'; end if;
    v_count := v_count + 1;
  end loop;

  if v_count=0 then raise exception 'Minimal satu produk harus dipilih'; end if;

  for v_cf in select value from jsonb_array_elements(coalesce(p_payload->'custom_fields','[]'::jsonb)) loop
    if not exists(select 1 from public.custom_field_definitions d where d.id=(v_cf->>'definition_id')::uuid and d.business_id=v_business.id and d.entity_type='order' and d.is_active=true and d.customer_visible=true and d.internal_only=false) then
      raise exception 'Field pesanan tidak valid';
    end if;
    insert into public.custom_field_values(business_id,definition_id,entity_type,entity_id,value_json,created_by)
    values(v_business.id,(v_cf->>'definition_id')::uuid,'order',v_order_id,coalesce(v_cf->'value','null'::jsonb),null);
  end loop;

  if exists(select 1 from public.custom_field_definitions d where d.business_id=v_business.id and d.entity_type='order' and d.is_active=true and d.customer_visible=true and d.internal_only=false and d.is_required=true and not exists(select 1 from public.custom_field_values cv where cv.definition_id=d.id and cv.entity_id=v_order_id and cv.value_json is not null and cv.value_json <> 'null'::jsonb and cv.value_json <> '""'::jsonb)) then
    raise exception 'Lengkapi field pesanan yang wajib diisi';
  end if;

  perform public.recalculate_order_totals(v_order_id);
  insert into public.activity_logs(business_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(v_business.id,null,'public_order.created','order',v_order_id,jsonb_build_object('order_number',v_order_number,'source','catalog'));

  return jsonb_build_object('success',true,'order_id',v_order_id,'order_number',v_order_number,'total',(select grand_total from public.orders where id=v_order_id));
end;
$$;

grant execute on function public.get_public_catalog() to anon, authenticated;
