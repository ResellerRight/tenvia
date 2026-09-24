

-- ============================================================
-- DEMO TRANSACTION SEED — CATERING
-- Creates realistic orders, invoices and payments for the 10 demo customers.
-- Safe/idempotent via business_settings.demo_transactions.
-- ============================================================
create or replace function public.seed_catering_demo_transactions(p_business_id uuid, p_user_id uuid default auth.uid())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := coalesce(p_user_id, auth.uid());
  v_already boolean := false;
  v_customer uuid;
  v_item uuid;
  v_result jsonb;
  v_count integer := 0;
  v_specs jsonb := jsonb_build_array(
    jsonb_build_object('wa','081234560001','sku','CAT-000001','qty',50,'status','completed','days',8,'expected',6,'due',5,'pay',1250000,'note','Pesanan catering acara kantor — selesai dan lunas.'),
    jsonb_build_object('wa','081234560002','sku','CAT-000002','qty',40,'status','in_progress','days',6,'expected',2,'due',1,'pay',300000,'note','Pesanan catering — DP masuk, masih diproses.'),
    jsonb_build_object('wa','081234560003','sku','CAT-000003','qty',30,'status','completed','days',5,'expected',3,'due',2,'pay',900000,'note','Pesanan catering — selesai dan lunas.'),
    jsonb_build_object('wa','081234560004','sku','CAT-000005','qty',60,'status','confirmed','days',4,'expected',5,'due',-2,'pay',0,'note','Pesanan snack box — belum dibayar, sudah jatuh tempo.'),
    jsonb_build_object('wa','081234560005','sku','CAT-000006','qty',2,'status','ready','days',3,'expected',1,'due',4,'pay',350000,'note','Tumpeng mini — DP/sebagian, siap dikirim.'),
    jsonb_build_object('wa','081234560006','sku','CAT-000004','qty',80,'status','completed','days',2,'expected',1,'due',3,'pay',1440000,'note','Snack box — selesai dan lunas.'),
    jsonb_build_object('wa','081234560007','sku','CAT-000001','qty',70,'status','confirmed','days',1,'expected',4,'due',7,'pay',500000,'note','Nasi box — DP masuk, sisa menjadi piutang.'),
    jsonb_build_object('wa','081234560008','sku','CAT-000003','qty',45,'status','in_progress','days',0,'expected',3,'due',8,'pay',450000,'note','Nasi box rendang — DP 50%, masih diproses.'),
    jsonb_build_object('wa','081234560009','sku','CAT-000005','qty',35,'status','completed','days',0,'expected',0,'due',5,'pay',875000,'note','Snack box premium — selesai dan lunas hari ini.'),
    jsonb_build_object('wa','081234560010','sku','CAT-000006','qty',3,'status','confirmed','days',0,'expected',6,'due',10,'pay',300000,'note','Tumpeng mini — DP, acara mendatang.')
  );
  v_spec jsonb;
  v_order jsonb;
  v_customer_name text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.has_business_role(p_business_id, array['owner'::public.member_role,'admin'::public.member_role,'staff'::public.member_role]) then
    raise exception 'Not authorized to seed demo transactions';
  end if;
  if not exists (select 1 from public.businesses where id=p_business_id and template_slug='catering' and deleted_at is null) then
    raise exception 'Data transaksi demo hanya tersedia untuk usaha Katering';
  end if;

  select coalesce((value->>'enabled')::boolean,false) into v_already
  from public.business_settings where business_id=p_business_id and key='demo_transactions' limit 1;
  if v_already then
    return jsonb_build_object('seeded',false,'already_seeded',true,'orders',10);
  end if;

  for v_spec in select value from jsonb_array_elements(v_specs) loop
    select id into v_customer from public.customers
    where business_id=p_business_id and whatsapp=v_spec->>'wa' and deleted_at is null
    order by created_at limit 1;
    select id into v_item from public.catalog_items
    where business_id=p_business_id and sku=v_spec->>'sku' and deleted_at is null and is_active=true
    limit 1;
    if v_customer is null or v_item is null then
      raise exception 'Data demo pelanggan/produk belum lengkap untuk % / %', v_spec->>'wa', v_spec->>'sku';
    end if;

    select public.create_order(p_business_id, jsonb_build_object(
      'customer_id',v_customer,
      'status',v_spec->>'status',
      'order_date',current_date-(v_spec->>'days')::integer,
      'expected_date',current_date+(v_spec->>'expected')::integer,
      'due_date',current_date+(v_spec->>'due')::integer,
      'customer_notes',v_spec->>'note',
      'items',jsonb_build_array(jsonb_build_object(
        'catalog_item_id',v_item,
        'name',(select name from public.catalog_items where id=v_item),
        'description',(select description from public.catalog_items where id=v_item),
        'qty',(v_spec->>'qty')::numeric,
        'unit',(select unit from public.catalog_items where id=v_item),
        'unit_price',(select price from public.catalog_items where id=v_item),
        'line_discount',0,
        'sort_order',0
      )),
      'initial_payment',jsonb_build_object('amount',(v_spec->>'pay')::bigint,'method','cash','note','Pembayaran demo')
    )) into v_order;
    v_count := v_count + 1;
  end loop;

  insert into public.business_settings(business_id,key,value)
  values (p_business_id,'demo_transactions',jsonb_build_object('enabled',true,'orders',v_count,'label','Transaksi Contoh Katering','seeded_at',now()))
  on conflict (business_id,key) do update set value=excluded.value;

  return jsonb_build_object('seeded',true,'already_seeded',false,'orders',v_count);
end;
$$;

revoke all on function public.seed_catering_demo_transactions(uuid,uuid) from public;
grant execute on function public.seed_catering_demo_transactions(uuid,uuid) to authenticated;


-- Upgrade the existing r20 seed function so existing businesses receive
-- realistic orders/invoices/payments together with the 10 customers/products.
create or replace function public.seed_catering_demo_data(p_business_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_template text;
  v_already boolean := false;
  v_tx boolean := false;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.business_members where business_id=p_business_id and user_id=v_user and role='owner' and status='active') then
    raise exception 'Hanya Owner yang dapat mengisi data contoh';
  end if;
  select template_slug into v_template from public.businesses where id=p_business_id;
  if v_template is null then raise exception 'Usaha tidak ditemukan'; end if;
  if v_template <> 'catering' then raise exception 'Data contoh saat ini hanya tersedia untuk template Katering'; end if;

  select coalesce((value->>'enabled')::boolean,false) into v_already from public.business_settings where business_id=p_business_id and key='demo_data' limit 1;
  if not v_already then
    insert into public.customers(business_id,name,whatsapp,email,address,notes,created_by) values
      (p_business_id,'Andi Pratama','081234560001','andi@example.com','Jakarta Selatan','Contoh pelanggan catering',v_user),
      (p_business_id,'Budi Santoso','081234560002','budi@example.com','Jakarta Timur','Contoh pelanggan catering',v_user),
      (p_business_id,'Citra Lestari','081234560003','citra@example.com','Jakarta Pusat','Contoh pelanggan catering',v_user),
      (p_business_id,'Dedi Kurniawan','081234560004','dedi@example.com','Depok','Contoh pelanggan catering',v_user),
      (p_business_id,'Eka Putri','081234560005','eka@example.com','Bekasi','Contoh pelanggan catering',v_user),
      (p_business_id,'Fajar Hidayat','081234560006','fajar@example.com','Tangerang','Contoh pelanggan catering',v_user),
      (p_business_id,'Gita Maharani','081234560007','gita@example.com','Jakarta Barat','Contoh pelanggan catering',v_user),
      (p_business_id,'Hendra Wijaya','081234560008','hendra@example.com','Jakarta Utara','Contoh pelanggan catering',v_user),
      (p_business_id,'Intan Permata','081234560009','intan@example.com','Bogor','Contoh pelanggan catering',v_user),
      (p_business_id,'Joko Saputra','081234560010','joko@example.com','Jakarta Selatan','Contoh pelanggan catering',v_user)
    on conflict do nothing;

    insert into public.catalog_items(business_id,name,sku,unit,price,description,category,created_by) values
      (p_business_id,'Nasi Box Ayam Bakar','CAT-000001','box',25000,'Nasi, ayam bakar, tumis sayur, sambal, buah.','Nasi Box',v_user),
      (p_business_id,'Nasi Box Ayam Geprek','CAT-000002','box',22000,'Nasi, ayam geprek, lalapan, sambal.','Nasi Box',v_user),
      (p_business_id,'Nasi Box Rendang','CAT-000003','box',30000,'Nasi, rendang sapi, sayur, sambal, buah.','Nasi Box',v_user),
      (p_business_id,'Snack Box Standard','CAT-000004','box',18000,'Snack box isi 3 snack dan air mineral.','Snack Box',v_user),
      (p_business_id,'Snack Box Premium','CAT-000005','box',25000,'Snack box premium isi 4 snack dan minuman.','Snack Box',v_user),
      (p_business_id,'Tumpeng Mini','CAT-000006','set',350000,'Tumpeng mini untuk acara keluarga atau kantor.','Tumpeng',v_user)
    on conflict (business_id, lower(sku)) do nothing;

    delete from public.debt_records where business_id=p_business_id and reference like 'PIUTANG-DEMO-%';
    insert into public.business_settings(business_id,key,value)
    values (p_business_id,'demo_data',jsonb_build_object('enabled',true,'template','catering','customers',10,'receivables',3,'products',6,'label','Data Contoh Katering','seeded_at',now()))
    on conflict (business_id,key) do update set value=excluded.value;
  end if;

  select coalesce((value->>'enabled')::boolean,false) into v_tx from public.business_settings where business_id=p_business_id and key='demo_transactions' limit 1;
  if not v_tx then
    perform public.seed_catering_demo_transactions(p_business_id,v_user);
  end if;

  return jsonb_build_object('seeded',not v_already,'already_seeded',v_already,'customers',10,'products',6,'orders',10,'transactions_seeded',true);
end;
$$;
revoke all on function public.seed_catering_demo_data(uuid) from public;
grant execute on function public.seed_catering_demo_data(uuid) to authenticated;
