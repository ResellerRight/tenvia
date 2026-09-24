-- PesanLunas v0.2.11-r9
-- Team invitation fix: do not depend on pgcrypto/gen_random_bytes/digest.
-- Uses PostgreSQL core gen_random_uuid() + md5() instead.

begin;

create or replace function public.create_business_invitation(
  p_business_id uuid,
  p_email text,
  p_role public.member_role default 'staff'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_hash text;
  v_id uuid;
  v_expires_at timestamptz := now() + interval '7 days';
begin
  if not public.is_business_owner(p_business_id) then
    raise exception 'Only the business owner may invite team members';
  end if;
  if nullif(trim(p_email),'') is null then raise exception 'Email is required'; end if;
  if p_role = 'owner' then raise exception 'Owner role cannot be invited'; end if;

  update public.business_invitations
     set revoked_at = now()
   where business_id = p_business_id
     and lower(email) = lower(trim(p_email))
     and accepted_at is null
     and revoked_at is null;

  -- 64 hex characters = 256 bits of UUID randomness.
  -- No pgcrypto extension is required.
  v_token := replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', '');
  v_hash := md5(v_token);

  insert into public.business_invitations(
    business_id, email, role, token_hash, expires_at, invited_by
  )
  values(
    p_business_id, lower(trim(p_email)), p_role, v_hash, v_expires_at, auth.uid()
  )
  returning id into v_id;

  insert into public.activity_logs(
    business_id, actor_user_id, action, entity_type, entity_id, metadata
  )
  values(
    p_business_id,
    auth.uid(),
    'team.invited',
    'business_invitation',
    v_id,
    jsonb_build_object('email', lower(trim(p_email)), 'role', p_role)
  );

  return jsonb_build_object(
    'invitation_id', v_id,
    'token', v_token,
    'expires_at', v_expires_at
  );
end;
$$;

create or replace function public.accept_business_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text := md5(coalesce(p_token, ''));
  v_inv public.business_invitations%rowtype;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then raise exception 'Login is required'; end if;

  select * into v_inv
  from public.business_invitations
  where token_hash = v_hash
    and accepted_at is null
    and revoked_at is null
    and expires_at > now()
  for update;

  if not found then raise exception 'Invitation is invalid or expired'; end if;
  if v_inv.email is not null and lower(v_inv.email) <> v_email then
    raise exception 'This invitation belongs to another email address';
  end if;

  insert into public.business_members(business_id, user_id, role, status, joined_at)
  values(v_inv.business_id, auth.uid(), v_inv.role, 'active', now())
  on conflict (business_id, user_id)
  do update set role = excluded.role, status = 'active', joined_at = coalesce(public.business_members.joined_at, excluded.joined_at);

  update public.business_invitations
  set accepted_at = now()
  where id = v_inv.id;

  insert into public.activity_logs(
    business_id, actor_user_id, action, entity_type, entity_id, metadata
  )
  values(
    v_inv.business_id,
    auth.uid(),
    'team.joined',
    'profile',
    auth.uid(),
    jsonb_build_object('role', v_inv.role)
  );

  return jsonb_build_object('business_id', v_inv.business_id, 'role', v_inv.role);
end;
$$;

revoke all on function public.create_business_invitation(uuid, text, public.member_role) from public;
revoke all on function public.accept_business_invitation(text) from public;
grant execute on function public.create_business_invitation(uuid, text, public.member_role) to authenticated;
grant execute on function public.accept_business_invitation(text) to authenticated;

commit;
