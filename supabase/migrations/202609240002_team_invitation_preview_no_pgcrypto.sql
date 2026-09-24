-- PesanLunas v0.2.11-r10
-- Fix invitation preview: remove remaining digest()/pgcrypto dependency.

begin;

create or replace function public.get_business_invitation_preview(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text := md5(coalesce(p_token,''));
  v_inv public.business_invitations%rowtype;
  v_business_name text;
begin
  select * into v_inv
  from public.business_invitations
  where token_hash = v_hash
    and accepted_at is null
    and revoked_at is null
    and expires_at > now();

  if not found then raise exception 'Invitation is invalid or expired'; end if;

  select b.name into v_business_name
  from public.businesses b
  where b.id = v_inv.business_id
    and b.deleted_at is null
    and b.is_active = true;

  if v_business_name is null then raise exception 'Business is not active'; end if;

  return jsonb_build_object(
    'email', lower(coalesce(v_inv.email,'')),
    'role', v_inv.role::text,
    'business_name', v_business_name,
    'expires_at', v_inv.expires_at
  );
end;
$$;

revoke all on function public.get_business_invitation_preview(text) from public;
grant execute on function public.get_business_invitation_preview(text) to anon, authenticated;

commit;
