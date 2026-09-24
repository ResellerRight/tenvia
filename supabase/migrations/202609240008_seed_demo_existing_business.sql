-- iMersOrder r20 — Seed demo data into an existing business
-- Safe/idempotent: a business can receive the demo set only once.

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
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1 from public.business_members
    where business_id = p_business_id
      and user_id = v_user
      and role = 'owner'
      and status = 'active'
  ) then
    raise exception 'Hanya Owner yang dapat mengisi data contoh';
  end if;

  select template_slug into v_template
  from public.businesses
  where id = p_business_id;

  if v_template is null then
    raise exception 'Usaha tidak ditemukan';
  end if;

  if v_template <> 'catering' then
    raise exception 'Data contoh saat ini hanya tersedia untuk template Katering';
  end if;

  select coalesce((value->>'enabled')::boolean, false)
    into v_already
  from public.business_settings
  where business_id = p_business_id
    and key = 'demo_data'
  limit 1;

  if v_already then
    return jsonb_build_object('seeded', false, 'already_seeded', true, 'customers', 10, 'receivables', 3, 'products', 6);
  end if;

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
    (p_business_id,'Joko Saputra','081234560010','joko@example.com','Jakarta Selatan','Contoh pelanggan catering',v_user);

  insert into public.catalog_items(business_id,name,sku,unit,price,description,category,created_by) values
    (p_business_id,'Nasi Box Ayam Bakar','CAT-000001','box',25000,'Nasi, ayam bakar, tumis sayur, sambal, buah.','Nasi Box',v_user),
    (p_business_id,'Nasi Box Ayam Geprek','CAT-000002','box',22000,'Nasi, ayam geprek, lalapan, sambal.','Nasi Box',v_user),
    (p_business_id,'Nasi Box Rendang','CAT-000003','box',30000,'Nasi, rendang sapi, sayur, sambal, buah.','Nasi Box',v_user),
    (p_business_id,'Snack Box Standard','CAT-000004','box',18000,'Snack box isi 3 snack dan air mineral.','Snack Box',v_user),
    (p_business_id,'Snack Box Premium','CAT-000005','box',25000,'Snack box premium isi 4 snack dan minuman.','Snack Box',v_user),
    (p_business_id,'Tumpeng Mini','CAT-000006','set',350000,'Tumpeng mini untuk acara keluarga atau kantor.','Tumpeng',v_user);

  insert into public.debt_records(business_id,type,person_name,whatsapp,email,reference,original_amount,balance_amount,transaction_date,due_date,notes,status,created_by) values
    (p_business_id,'receivable','Andi Pratama','081234560001','andi@example.com','PIUTANG-DEMO-001',850000,850000,current_date-5,current_date+2,'Contoh piutang catering — belum jatuh tempo.','open',v_user),
    (p_business_id,'receivable','Dedi Kurniawan','081234560004','dedi@example.com','PIUTANG-DEMO-002',1250000,1250000,current_date-12,current_date-2,'Contoh piutang catering — sudah melewati jatuh tempo.','open',v_user),
    (p_business_id,'receivable','Gita Maharani','081234560007','gita@example.com','PIUTANG-DEMO-003',2400000,2400000,current_date-3,current_date+7,'Contoh piutang catering — jatuh tempo minggu depan.','open',v_user);

  insert into public.business_settings(business_id,key,value)
  values (p_business_id,'demo_data',jsonb_build_object(
    'enabled',true,
    'template','catering',
    'customers',10,
    'receivables',3,
    'products',6,
    'label','Data Contoh Katering',
    'seeded_at',now()
  ))
  on conflict (business_id,key) do update set value = excluded.value;

  return jsonb_build_object('seeded', true, 'already_seeded', false, 'customers', 10, 'receivables', 3, 'products', 6);
end;
$$;

revoke all on function public.seed_catering_demo_data(uuid) from public;
grant execute on function public.seed_catering_demo_data(uuid) to authenticated;
