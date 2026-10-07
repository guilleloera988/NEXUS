-- SkillPass — organization invitations (security review H-1, docs/SECURITY.md §6).
--
-- 1. sp_invite_member only records a pending invitation. It no longer looks the address up in
--    auth.users, never inserts or updates organization_members and answers {"status":"invited"}
--    for every new address. Before, it (a) overwrote the role of an existing member, so a manager
--    could demote the owner and then remove them past the last-owner guard, (b) told the caller
--    whether an account existed and which role it had, and (c) added existing accounts to the
--    organization on the spot.
-- 2. sp_remove_member: only an owner (or an AINDEV admin) may remove an owner.
-- 3. sp_handle_new_user: at sign-up an invitation is honoured only when the chosen account type
--    matches the organization kind (company / university). A "student" sign-up is never turned
--    into staff of an organization by an invitation someone else created for that address.
-- 4. sp_accept_invitations (called after sign-in): accepts the most recent compatible invitation
--    only while the person belongs to no organization of that kind. The app works with one
--    organization per account, so an invitation can no longer pull an established member or owner
--    into another organization.
-- CREATE OR REPLACE keeps each function's owner and EXECUTE grants.

create or replace function public.sp_invite_member(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  a public.profiles := public.sp_actor(); o public.organizations;
  v_email text := lower(public.sp_text(p, 'email', 5, 254)); v_role text;
begin
  select * into o from public.organizations where id = public.sp_uuid(p, 'organization_id');
  if not found or not public.sp_is_org_manager(o.id) or o.kind = 'aindev' then perform public.sp_forbidden(); end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then perform public.sp_raise('invalid_field', 'email'); end if;
  v_role := public.sp_choice(p, 'member_role', case when o.kind = 'company' then array['manager','supervisor'] else array['manager','staff'] end);

  -- Only facts about the caller's own organization are revealed.
  if exists(select 1 from public.organization_members m join auth.users u on u.id = m.user_id
            where m.organization_id = o.id and lower(u.email) = v_email) then
    perform public.sp_raise('already_member', 'email');
  end if;
  if exists(select 1 from public.invitations where organization_id = o.id and email = v_email and status = 'pending') then
    perform public.sp_raise('already_invited', 'email');
  end if;
  insert into public.invitations(organization_id, email, member_role, invited_by) values (o.id, v_email, v_role, a.id);
  perform public.sp_audit('member_invited', 'organization', o.id, o.id, null, null, '{}'::jsonb, jsonb_build_object('email', v_email, 'member_role', v_role));
  return jsonb_build_object('status', 'invited');
end $$;

create or replace function public.sp_remove_member(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_org uuid := public.sp_uuid(p, 'organization_id'); v_user uuid := public.sp_uuid(p, 'user_id'); v_role text;
begin
  perform public.sp_actor();
  if not public.sp_is_org_manager(v_org) then perform public.sp_forbidden(); end if;
  select member_role into v_role from public.organization_members where organization_id = v_org and user_id = v_user;
  if v_role is null then perform public.sp_raise('not_found'); end if;
  if v_role = 'owner' and not public.sp_is_admin() and not exists(select 1 from public.organization_members
      where organization_id = v_org and user_id = auth.uid() and member_role = 'owner') then
    perform public.sp_forbidden();
  end if;
  if v_role = 'owner' and (select count(*) from public.organization_members where organization_id = v_org and member_role = 'owner') <= 1 then
    perform public.sp_raise('last_owner');
  end if;
  if exists(select 1 from public.challenges where organization_id = v_org and supervisor_id = v_user and status not in ('completed','archived')) then
    perform public.sp_raise('member_supervises_challenges');
  end if;
  delete from public.organization_members where organization_id = v_org and user_id = v_user;
  perform public.sp_audit('member_removed', 'organization', v_org, v_org, null, v_user, jsonb_build_object('member_role', v_role));
  return jsonb_build_object('id', v_user);
end $$;

create or replace function public.sp_handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_type text := coalesce(new.raw_user_meta_data->>'account_type', 'student');
  v_name text := left(btrim(coalesce(new.raw_user_meta_data->>'full_name', '')), 160);
  v_inv public.invitations; v_role text;
begin
  if v_type not in ('student','company','university') then v_type := 'student'; end if;
  if v_name = '' then v_name := left(split_part(coalesce(new.email, 'usuario'), '@', 1), 160); end if;
  if v_name = '' then v_name := 'Usuario'; end if;

  -- Only an invitation from an organization of the kind the person chose is honoured.
  select i.* into v_inv from public.invitations i join public.organizations o on o.id = i.organization_id
    where i.status = 'pending' and i.email = lower(coalesce(new.email, '')) and o.kind = v_type
    order by i.created_at desc limit 1;
  v_role := case when v_inv.id is not null and v_inv.member_role = 'supervisor' then 'supervisor' else v_type end;

  insert into public.profiles(id, role, full_name, slug)
  values (new.id, v_role, v_name, left(public.sp_slugify(v_name), 70) || '-' || lower(public.sp_random_hex(6)));

  if v_inv.id is not null then
    insert into public.organization_members(organization_id, user_id, member_role)
    values (v_inv.organization_id, new.id, v_inv.member_role) on conflict do nothing;
    update public.invitations set status = 'accepted', accepted_by = new.id, accepted_at = now() where id = v_inv.id;
  end if;
  return new;
end $$;

create or replace function public.sp_accept_invitations(p jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.profiles := public.sp_actor(); v_inv record;
begin
  select i.id, i.organization_id, i.member_role into v_inv
    from public.invitations i join public.organizations o on o.id = i.organization_id
    where i.status = 'pending' and i.email = public.sp_auth_email()
      and ((o.kind = 'company' and a.role in ('company','supervisor')) or (o.kind = 'university' and a.role = 'university'))
      and not exists(select 1 from public.organization_members m join public.organizations mo on mo.id = m.organization_id
                     where m.user_id = a.id and mo.kind = o.kind)
    order by i.created_at desc limit 1;
  if v_inv.id is null then return jsonb_build_object('accepted', 0); end if;
  insert into public.organization_members(organization_id, user_id, member_role)
  values (v_inv.organization_id, a.id, v_inv.member_role) on conflict do nothing;
  update public.invitations set status = 'accepted', accepted_by = a.id, accepted_at = now() where id = v_inv.id;
  perform public.sp_audit('invitation_accepted', 'organization', v_inv.organization_id, v_inv.organization_id, null, a.id);
  return jsonb_build_object('accepted', 1);
end $$;
