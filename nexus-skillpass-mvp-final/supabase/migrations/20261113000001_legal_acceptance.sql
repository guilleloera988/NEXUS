-- Acceptance of the terms and the privacy notice (pilot readiness).
--
-- The legal texts live in the app (src/lib/legal) under a dated version. This table records who accepted
-- which version and when: at sign-up (the form's checkbox travels in the user metadata and the trigger below
-- records it) or later, when the app asks an existing account to accept a new version (sp_accept_legal).
-- The app decides which version is current and asks again when it changes; the rows are never edited.

create table public.legal_acceptances (
  user_id uuid not null references public.profiles(id) on delete cascade,
  version text not null check (version ~ '^20[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'),
  source text not null check (source in ('signup', 'prompt')),
  locale text not null default 'es' check (locale in ('es', 'en')),
  accepted_at timestamptz not null default now(),
  primary key (user_id, version)
);
alter table public.legal_acceptances enable row level security;
revoke all on public.legal_acceptances from public, anon, authenticated;
grant select on public.legal_acceptances to authenticated;
create policy legal_acceptances_select on public.legal_acceptances for select to authenticated
  using (user_id = (select auth.uid()) or (select public.sp_is_admin()));

-- A version is the date its text was written: a real date, from 2026 on and not in the future.
create function public.sp_legal_version_ok(p_version text) returns boolean
language plpgsql stable set search_path = public, pg_temp as $$
begin
  if p_version is null or p_version !~ '^20[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' then return false; end if;
  return p_version::date between date '2026-01-01' and current_date + 1;
exception when others then
  return false;
end $$;

-- p = {version, locale}: the signed-in user accepts that version of the terms and the privacy notice.
create function public.sp_accept_legal(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.profiles := public.sp_actor(); v_version text := p ->> 'version'; v_at timestamptz;
begin
  if not public.sp_legal_version_ok(v_version) then perform public.sp_raise('invalid_field', 'version'); end if;
  insert into public.legal_acceptances(user_id, version, source, locale)
  values (a.id, v_version, 'prompt', case when p ->> 'locale' = 'en' then 'en' else 'es' end)
  on conflict (user_id, version) do nothing;
  select accepted_at into v_at from public.legal_acceptances where user_id = a.id and version = v_version;
  return jsonb_build_object('version', v_version, 'accepted_at', v_at);
end $$;

-- p = {version}: whether the signed-in user accepted exactly that version (RLS limits the read to their rows).
create function public.sp_legal_status(p jsonb) returns jsonb
language sql stable security invoker set search_path = public, pg_temp as $$
  select jsonb_build_object('accepted', a.user_id is not null, 'accepted_at', a.accepted_at)
  from (select 1) one
  left join public.legal_acceptances a on a.user_id = auth.uid() and a.version = p ->> 'version'
$$;

-- Sign-up: the form's acceptance arrives as raw_user_meta_data.legal_version. It never blocks a sign-up:
-- without a row here the app simply asks at the first sign-in.
create function public.sp_record_signup_consent() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_version text := new.raw_user_meta_data ->> 'legal_version';
begin
  begin
    if public.sp_legal_version_ok(v_version) and exists(select 1 from public.profiles where id = new.id) then
      insert into public.legal_acceptances(user_id, version, source, locale)
      values (new.id, v_version, 'signup', case when new.raw_user_meta_data ->> 'legal_locale' = 'en' then 'en' else 'es' end)
      on conflict (user_id, version) do nothing;
    end if;
  exception when others then
    raise warning 'sp_record_signup_consent: %', sqlerrm;
  end;
  return new;
end $$;
-- Named to fire after sp_on_auth_user_created (same event; triggers run in name order), which creates the profile.
create trigger sp_on_auth_user_created_consent after insert on auth.users
  for each row execute function public.sp_record_signup_consent();

revoke all on function public.sp_legal_version_ok(text), public.sp_accept_legal(jsonb), public.sp_legal_status(jsonb),
  public.sp_record_signup_consent() from public, anon, authenticated;
grant execute on function public.sp_accept_legal(jsonb), public.sp_legal_status(jsonb) to authenticated;
