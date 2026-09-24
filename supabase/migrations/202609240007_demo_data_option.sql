-- iMersOrder r19 — Optional first-install demo data for Catering
-- Existing installations only: run this migration once.
-- It adds an optional p_seed_demo flag to create_business.

drop function if exists public.create_business(text,text,text);

create or replace function public.create_business(
  p_name text,
  p_slug text,
  p_template_slug text default 'catering',
  p_seed_demo boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_business_id uuid;
  v_template_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_name),'') is null or nullif(trim(p_slug),'') is null then
    raise exception 'Business name and slug are required';
  end if;
  if not exists (select 1 from public.profiles where id=v_user) then
    insert into public.profiles(id) values(v_user) on conflict do nothing;
  end if;
  select id into v_template_id from public.business_templates
  where slug=p_template_slug and is_active=true;
  if v_template_id is null and p_template_slug <> 'blank' then
    raise exception 'Unknown or inactive business template: %', p_template_slug;
  end if;
  insert into public.businesses(owner_user_id,template_slug,name,slug)
  values(v_user,p_template_slug,trim(p_name),lower(trim(p_slug)))
  returning id into v_business_id;
  insert into public.business_members(business_id,user_id,role,status,joined_at)
  values(v_business_id,v_user,'owner','active',now());

  if v_template_id is not null then
    insert into public.custom_field_definitions(
      business_id,field_key,label,field_type,entity_type,placeholder,
      is_required,show_on_invoice,customer_visible,internal_only,sort_order)
    select v_business_id,tf.field_key,tf.label,tf.field_type,tf.entity_type,tf.placeholder,
      tf.is_required,tf.show_on_invoice,tf.customer_visible,tf.internal_only,tf.sort_order
    from public.business_template_fields tf
    where tf.template_id=v_template_id order by tf.sort_order;

    insert into public.custom_field_options(business_id,definition_id,label,value,sort_order)
    select v_business_id,d.id,x.value->>'label',coalesce(x.value->>'value',x.value->>'label'),(x.ordinality-1)::integer
    from public.business_template_fields tf
    join public.custom_field_definitions d on d.business_id=v_business_id
      and d.field_key=tf.field_key and d.entity_type=tf.entity_type
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

  if coalesce(p_seed_demo,false) then
    if p_template_slug <> 'catering' then
      raise exception 'Demo data is currently available for the Catering template only';
    end if;
    insert into public.customers(business_id,name,whatsapp,email,address,notes,created_by) values
      (v_business_id,'Andi Pratama','081234560001','andi@example.com','Jakarta Selatan','Contoh pelanggan catering',v_user),
      (v_business_id,'Budi Santoso','081234560002','budi@example.com','Jakarta Timur','Contoh pelanggan catering',v_user),
      (v_business_id,'Citra Lestari','081234560003','citra@example.com','Jakarta Pusat','Contoh pelanggan catering',v_user),
      (v_business_id,'Dedi Kurniawan','081234560004','dedi@example.com','Depok','Contoh pelanggan catering',v_user),
      (v_business_id,'Eka Putri','081234560005','eka@example.com','Bekasi','Contoh pelanggan catering',v_user),
      (v_business_id,'Fajar Hidayat','081234560006','fajar@example.com','Tangerang','Contoh pelanggan catering',v_user),
      (v_business_id,'Gita Maharani','081234560007','gita@example.com','Jakarta Barat','Contoh pelanggan catering',v_user),
      (v_business_id,'Hendra Wijaya','081234560008','hendra@example.com','Jakarta Utara','Contoh pelanggan catering',v_user),
      (v_business_id,'Intan Permata','081234560009','intan@example.com','Bogor','Contoh pelanggan catering',v_user),
      (v_business_id,'Joko Saputra','081234560010','joko@example.com','Jakarta Selatan','Contoh pelanggan catering',v_user);

    insert into public.catalog_items(business_id,name,sku,unit,price,description,category,created_by) values
      (v_business_id,'Nasi Box Ayam Bakar','CAT-000001','box',25000,'Nasi, ayam bakar, tumis sayur, sambal, buah.','Nasi Box',v_user),
      (v_business_id,'Nasi Box Ayam Geprek','CAT-000002','box',22000,'Nasi, ayam geprek, lalapan, sambal.','Nasi Box',v_user),
      (v_business_id,'Nasi Box Rendang','CAT-000003','box',30000,'Nasi, rendang sapi, sayur, sambal, buah.','Nasi Box',v_user),
      (v_business_id,'Snack Box Standard','CAT-000004','box',18000,'Snack box isi 3 snack dan air mineral.','Snack Box',v_user),
      (v_business_id,'Snack Box Premium','CAT-000005','box',25000,'Snack box premium isi 4 snack dan minuman.','Snack Box',v_user),
      (v_business_id,'Tumpeng Mini','CAT-000006','set',350000,'Tumpeng mini untuk acara keluarga atau kantor.','Tumpeng',v_user);

    insert into public.debt_records(business_id,type,person_name,whatsapp,email,reference,original_amount,balance_amount,transaction_date,due_date,notes,status,created_by) values
      (v_business_id,'receivable','Andi Pratama','081234560001','andi@example.com','PIUTANG-DEMO-001',850000,850000,current_date-5,current_date+2,'Contoh piutang catering — belum jatuh tempo.','open',v_user),
      (v_business_id,'receivable','Dedi Kurniawan','081234560004','dedi@example.com','PIUTANG-DEMO-002',1250000,1250000,current_date-12,current_date-2,'Contoh piutang catering — sudah melewati jatuh tempo.','open',v_user),
      (v_business_id,'receivable','Gita Maharani','081234560007','gita@example.com','PIUTANG-DEMO-003',2400000,2400000,current_date-3,current_date+7,'Contoh piutang catering — jatuh tempo minggu depan.','open',v_user);

    insert into public.business_settings(business_id,key,value) values
      (v_business_id,'demo_data',jsonb_build_object('enabled',true,'template','catering','customers',10,'receivables',3,'products',6,'label','Data Contoh Katering'));
  end if;
  return v_business_id;
end;
$$;

revoke all on function public.create_business(text,text,text,boolean) from public;
grant execute on function public.create_business(text,text,text,boolean) to authenticated;
