-- iMersOrder r18: use uploaded business branding everywhere.
-- Login is pre-auth, so it needs a tiny public RPC that exposes branding only.
-- Public invoices use the current uploaded logo so print/save-to-PDF never keeps
-- an old bundled logo after a branding change.

create or replace function public.get_public_branding()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business public.businesses%rowtype;
  v_favicon text := '';
  v_use_logo boolean := true;
begin
  select * into v_business
  from public.businesses
  where deleted_at is null
  order by created_at asc
  limit 1;

  if not found then return null; end if;

  select coalesce(value ->> 'url','')
    into v_favicon
  from public.business_settings
  where business_id = v_business.id and key = 'favicon_url'
  limit 1;

  select coalesce((value ->> 'enabled')::boolean,true)
    into v_use_logo
  from public.business_settings
  where business_id = v_business.id and key = 'use_logo_as_favicon'
  limit 1;

  return jsonb_build_object(
    'id', v_business.id,
    'name', v_business.name,
    'logo_url', v_business.logo_url,
    'favicon_url', coalesce(v_favicon,''),
    'use_logo_as_favicon', coalesce(v_use_logo,true)
  );
end;
$$;

revoke all on function public.get_public_branding() from public;
grant execute on function public.get_public_branding() to anon, authenticated;

create or replace function public.resolve_public_invoice(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.invoice_public_links%rowtype;
  v_invoice public.invoices%rowtype;
  v_items jsonb;
  v_payments jsonb;
  v_current_logo text;
  v_business_snapshot jsonb;
begin
  if nullif(trim(p_token),'') is null then return null; end if;

  select * into v_link
  from public.invoice_public_links
  where token_hash = encode(digest(p_token, 'sha256'),'hex')
    and revoked_at is null
    and (expires_at is null or expires_at > now())
  limit 1;

  if not found then return null; end if;

  select * into v_invoice
  from public.invoices
  where id = v_link.invoice_id
    and deleted_at is null
    and payment_status <> 'void';

  if not found then return null; end if;

  select logo_url into v_current_logo
  from public.businesses
  where id = v_invoice.business_id and deleted_at is null;

  v_business_snapshot := coalesce(v_invoice.business_snapshot,'{}'::jsonb);
  v_business_snapshot := jsonb_set(
    v_business_snapshot,
    '{logo_url}',
    to_jsonb(coalesce(v_current_logo, v_business_snapshot->>'logo_url')),
    true
  );

  select coalesce(jsonb_agg(jsonb_build_object(
    'name', ii.name,
    'description', ii.description,
    'qty', ii.qty,
    'unit', ii.unit,
    'unit_price', ii.unit_price,
    'line_discount', ii.line_discount,
    'line_total', ii.line_total,
    'custom_fields', ii.custom_fields_snapshot
  ) order by ii.sort_order, ii.created_at), '[]'::jsonb)
  into v_items
  from public.invoice_items ii
  where ii.invoice_id = v_invoice.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'kind', p.kind,
    'amount', p.amount,
    'method', p.method,
    'paid_at', p.paid_at
  ) order by p.paid_at), '[]'::jsonb)
  into v_payments
  from public.payments p
  where p.invoice_id = v_invoice.id and p.status = 'posted';

  update public.invoice_public_links
  set view_count = view_count + 1, last_viewed_at = now()
  where id = v_link.id;

  return jsonb_build_object(
    'invoice_id', v_invoice.id,
    'invoice_number', v_invoice.invoice_number,
    'issue_date', v_invoice.issue_date,
    'due_date', v_invoice.due_date,
    'subtotal', v_invoice.subtotal,
    'discount_total', v_invoice.discount_total,
    'additional_fee_total', v_invoice.additional_fee_total,
    'tax_total', v_invoice.tax_total,
    'grand_total', v_invoice.grand_total,
    'amount_paid', v_invoice.amount_paid,
    'balance_due', v_invoice.balance_due,
    'payment_status', case
      when v_invoice.payment_status not in ('paid','void','refunded')
       and v_invoice.due_date is not null
       and v_invoice.due_date < current_date then 'overdue'
      else v_invoice.payment_status::text
    end,
    'business', v_business_snapshot,
    'customer', v_invoice.customer_snapshot,
    'payment_methods', v_invoice.payment_methods_snapshot,
    'custom_fields', v_invoice.custom_fields_snapshot,
    'customer_notes', v_invoice.customer_notes_snapshot,
    'items', v_items,
    'payments', v_payments
  );
end;
$$;

revoke all on function public.resolve_public_invoice(text) from public;
grant execute on function public.resolve_public_invoice(text) to anon, authenticated;
