-- iMersOrder r21: Public catalog inherits the business appearance theme
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
  select * into v_business from public.businesses where is_active=true and deleted_at is null order by created_at limit 1;
  if not found then return jsonb_build_object('enabled',false); end if;
  select coalesce((value ->> 'enabled')::boolean,false) into v_enabled from public.business_settings where business_id=v_business.id and key='catalog_enabled';
  if not v_enabled then return jsonb_build_object('enabled',false); end if;
  select coalesce(jsonb_object_agg(key,value), '{}'::jsonb) into v_settings
  from public.business_settings where business_id=v_business.id and key in ('catalog_description','catalog_show_prices','catalog_accept_orders','appearance_theme');
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'sku',sku,'unit',unit,'price',price,'description',description,'category',coalesce(nullif(trim(category),''),'Lainnya')) order by category nulls last,name), '[]'::jsonb)
    into v_items from public.catalog_items where business_id=v_business.id and is_active=true and deleted_at is null;
  select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'key',d.field_key,'label',d.label,'type',d.field_type,'help_text',d.help_text,'placeholder',d.placeholder,'required',d.is_required,'sort_order',d.sort_order,'options',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'label',o.label,'value',o.value) order by o.sort_order) from public.custom_field_options o where o.definition_id=d.id),'[]'::jsonb)) order by d.sort_order,d.created_at),'[]'::jsonb)
    into v_fields from public.custom_field_definitions d where d.business_id=v_business.id and d.entity_type='order' and d.is_active=true and d.customer_visible=true and d.internal_only=false;
  return jsonb_build_object('enabled',true,'business',jsonb_build_object('id',v_business.id,'name',v_business.name,'logo_url',v_business.logo_url,'address',v_business.address,'whatsapp',v_business.whatsapp,'email',v_business.email),'settings',v_settings,'items',v_items,'fields',v_fields);
end; $$;

grant execute on function public.get_public_catalog() to anon, authenticated;
