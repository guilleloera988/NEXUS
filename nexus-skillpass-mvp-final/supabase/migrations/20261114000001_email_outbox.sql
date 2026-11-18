-- E-mail notices (pilot readiness).
--
-- The workflow already tells people what happened with rows in public.notifications, which they only see when
-- they open the platform. This migration queues an e-mail for the notices a person should not miss, and for
-- invitations to people who have no account yet. The app server claims the queue, sends through its mail
-- provider and reports back. Only the app server can do that: it proves it holds EMAIL_GATE_SECRET with a
-- token whose SHA-256 is stored in platform_settings ('email_gate'). Without that row (local DEMO, the public
-- demo project, a new database) nothing is queued and nothing is sent.

-- A person's choice about e-mail notices. No row means: on, in the language they signed up in.
create table public.email_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default true,
  locale text check (locale in ('es', 'en')),
  updated_at timestamptz not null default now()
);
alter table public.email_settings enable row level security;
revoke all on public.email_settings from public, anon, authenticated;
grant select on public.email_settings to authenticated;
create policy email_settings_select on public.email_settings for select to authenticated using (user_id = (select auth.uid()));

-- The queue. A row is for an account (user_id) or, for invitations, for an address without one (to_email).
create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  to_email text check (to_email is null or (to_email = lower(to_email) and char_length(to_email) <= 254
    and to_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  notification_id uuid references public.notifications(id) on delete cascade,
  kind text not null check (char_length(kind) <= 60),
  params jsonb not null default '{}'::jsonb,
  link text not null default '' check (link = '' or (link ~ '^/[^/]' and char_length(link) <= 300)),
  status text not null default 'pending' check (status in ('pending', 'sent', 'skipped', 'failed')),
  attempts smallint not null default 0,
  batch_id uuid,
  claimed_at timestamptz,
  -- After a failed attempt: not to be tried again before this time (2, 4, 8 and 16 minutes).
  retry_at timestamptz,
  sent_at timestamptz,
  error text check (error is null or char_length(error) <= 300),
  created_at timestamptz not null default now(),
  check ((user_id is null) <> (to_email is null))
);
create index email_outbox_pending_idx on public.email_outbox (created_at) where status = 'pending';
create index email_outbox_user_sent_idx on public.email_outbox (user_id, sent_at);
create index email_outbox_address_sent_idx on public.email_outbox (to_email, sent_at) where to_email is not null;
create index email_outbox_batch_idx on public.email_outbox (batch_id) where batch_id is not null;
create index email_outbox_notification_idx on public.email_outbox (notification_id);
alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from public, anon, authenticated;

create function public.sp_email_gate_ok(p_token text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(p_token is not null and exists(
    select 1 from public.platform_settings
    where key = 'email_gate' and value #>> '{}' ~ '^[0-9a-f]{64}$'
      and value #>> '{}' = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')), false)
$$;

-- E-mail is on for this database once the app server's gate is stored.
create function public.sp_email_active() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists(select 1 from public.platform_settings where key = 'email_gate' and value #>> '{}' ~ '^[0-9a-f]{64}$')
$$;

-- Notices worth an e-mail: something to do, or an answer the person is waiting for. Status changes of a
-- challenge stay inside the platform. A failure here never undoes the notice or the action behind it.
create function public.sp_queue_notification_email() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  begin
    if new.kind in ('application_received', 'application_shortlisted', 'application_rejected', 'challenge_assigned',
        'validation_requested', 'validation_completed', 'credential_issued', 'credential_revoked', 'challenge_invitation',
        'organization_membership', 'organization_status', 'assignment_ended', 'university_request',
        'university_membership_approved', 'university_membership_rejected', 'university_membership_removed')
       and public.sp_email_active() then
      insert into public.email_outbox(user_id, notification_id, kind, params, link)
      values (new.user_id, new.id, new.kind, new.params, new.link);
    end if;
  exception when others then
    raise warning 'sp_queue_notification_email: %', sqlerrm;
  end;
  return new;
end $$;
create trigger sp_notifications_queue_email after insert on public.notifications
  for each row execute function public.sp_queue_notification_email();

-- Invitations go to an address that may have no account. An organization can cause at most 50 a day.
create function public.sp_queue_invitation_email() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare o public.organizations;
begin
  begin
    if new.status = 'pending' and public.sp_email_active() then
      select * into o from public.organizations where id = new.organization_id;
      if (select count(*) from public.email_outbox where kind = 'invitation' and params ->> 'organization_id' = new.organization_id::text
            and created_at > now() - interval '24 hours') < 50 then
        insert into public.email_outbox(to_email, kind, params, link)
        values (new.email, 'invitation',
          jsonb_build_object('organization', o.name, 'organization_id', o.id, 'member_role', new.member_role,
            'invited_by', (select full_name from public.profiles where id = new.invited_by)),
          '/signup?type=' || case when o.kind = 'university' then 'university' else 'company' end);
      end if;
    end if;
  exception when others then
    raise warning 'sp_queue_invitation_email: %', sqlerrm;
  end;
  return new;
end $$;
create trigger sp_invitations_queue_email after insert on public.invitations
  for each row execute function public.sp_queue_invitation_email();

-- p = {gate, limit, cooldown}: the app server takes what is ready to send, grouped by recipient: at most `limit`
-- recipients (1 to 50, default 20), skipping anyone who got an e-mail in the last `cooldown` seconds (default
-- 900) so a busy hour becomes one message, not twenty. Returns [{batch_id, to, name, locale, items}].
create function public.sp_email_claim(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_limit integer := 20; v_cooldown integer := 900;
  r record; v_batch uuid; v_items jsonb; v_to text; v_name text; v_locale text; v_out jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p -> 'gate') is distinct from 'string' or not public.sp_email_gate_ok(p ->> 'gate') then
    perform public.sp_raise('email_unavailable');
  end if;
  if p ? 'limit' then
    if jsonb_typeof(p -> 'limit') is distinct from 'number' or (p ->> 'limit') !~ '^[0-9]{1,2}$' then perform public.sp_raise('invalid_data', 'limit'); end if;
    v_limit := least(greatest((p ->> 'limit')::integer, 1), 50);
  end if;
  if p ? 'cooldown' then
    if jsonb_typeof(p -> 'cooldown') is distinct from 'number' or (p ->> 'cooldown') !~ '^[0-9]{1,5}$' then perform public.sp_raise('invalid_data', 'cooldown'); end if;
    v_cooldown := least((p ->> 'cooldown')::integer, 86400);
  end if;

  -- Housekeeping: old notices are not worth sending, abandoned claims go back to the queue, history is kept 30 days.
  update public.email_outbox set status = 'skipped', error = 'expired' where status = 'pending' and created_at < now() - interval '3 days';
  update public.email_outbox set claimed_at = null, batch_id = null where status = 'pending' and claimed_at < now() - interval '10 minutes';
  delete from public.email_outbox where id in (
    select id from public.email_outbox where status <> 'pending' and created_at < now() - interval '30 days' limit 200);
  -- Not worth an e-mail any more: already read in the platform, e-mails turned off, DEMO account, or no confirmed address.
  update public.email_outbox o set status = 'skipped', error = 'read'
  from public.notifications n
  where o.status = 'pending' and o.claimed_at is null and n.id = o.notification_id and n.read_at is not null;
  update public.email_outbox o set status = 'skipped', error = 'disabled'
  where o.status = 'pending' and o.claimed_at is null and o.user_id is not null
    and exists(select 1 from public.email_settings s where s.user_id = o.user_id and not s.enabled);
  update public.email_outbox o set status = 'skipped', error = 'no_address'
  where o.status = 'pending' and o.claimed_at is null and o.user_id is not null
    and (exists(select 1 from public.profiles pr where pr.id = o.user_id and pr.is_demo)
         or not exists(select 1 from auth.users u where u.id = o.user_id and u.email is not null and u.email_confirmed_at is not null));

  for r in
    select o.user_id, o.to_email, min(o.created_at) as first_at
    from public.email_outbox o
    where o.status = 'pending' and o.claimed_at is null and o.attempts < 5 and (o.retry_at is null or o.retry_at <= now())
      and not exists(
        select 1 from public.email_outbox s
        where s.sent_at > now() - make_interval(secs => v_cooldown)
          and ((o.user_id is not null and s.user_id = o.user_id) or (o.to_email is not null and s.to_email = o.to_email)))
    group by o.user_id, o.to_email
    order by first_at
    limit v_limit
  loop
    v_batch := gen_random_uuid();
    with claimed as (
      update public.email_outbox o set claimed_at = now(), batch_id = v_batch, attempts = o.attempts + 1
      where o.id in (
        select id from public.email_outbox
        where status = 'pending' and claimed_at is null and attempts < 5 and (retry_at is null or retry_at <= now())
          and ((r.user_id is not null and user_id = r.user_id) or (r.to_email is not null and to_email = r.to_email))
        order by created_at limit 20 for update skip locked)
      returning o.id, o.kind, o.params, o.link, o.created_at)
    select jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'params', params, 'link', link, 'created_at', created_at) order by created_at)
    into v_items from claimed;
    if v_items is null then continue; end if;

    if r.user_id is not null then
      select u.email, pr.full_name,
        coalesce(s.locale,
          case when u.raw_user_meta_data ->> 'locale' in ('es', 'en') then u.raw_user_meta_data ->> 'locale' end,
          case when u.raw_user_meta_data ->> 'legal_locale' in ('es', 'en') then u.raw_user_meta_data ->> 'legal_locale' end,
          'es')
      into v_to, v_name, v_locale
      from auth.users u join public.profiles pr on pr.id = u.id left join public.email_settings s on s.user_id = u.id
      where u.id = r.user_id;
    else
      v_to := r.to_email; v_name := null; v_locale := 'es';
    end if;
    v_out := v_out || jsonb_build_object('batch_id', v_batch, 'to', lower(v_to), 'name', v_name, 'locale', v_locale, 'items', v_items);
  end loop;
  return v_out;
end $$;

-- p = {gate, results: [{batch_id, ok, error}]}: what happened to each claimed batch. A failed batch goes back
-- to the queue and waits 2, 4, 8 and 16 minutes before its next attempts (a provider's bad minute must not
-- use them all up); after five attempts it is given up.
create function public.sp_email_done(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_result jsonb; v_batch text; v_sent integer := 0; v_failed integer := 0; v_rows integer;
begin
  if jsonb_typeof(p -> 'gate') is distinct from 'string' or not public.sp_email_gate_ok(p ->> 'gate') then
    perform public.sp_raise('email_unavailable');
  end if;
  if jsonb_typeof(p -> 'results') is distinct from 'array' or jsonb_array_length(p -> 'results') > 50 then
    perform public.sp_raise('invalid_data', 'results');
  end if;
  for v_result in select value from jsonb_array_elements(p -> 'results') loop
    v_batch := v_result ->> 'batch_id';
    if v_batch is null or v_batch !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      perform public.sp_raise('invalid_data', 'batch_id');
    end if;
    if v_result -> 'ok' = 'true'::jsonb then
      update public.email_outbox set status = 'sent', sent_at = now(), error = null, retry_at = null
      where batch_id = v_batch::uuid and status = 'pending';
      get diagnostics v_rows = row_count; v_sent := v_sent + v_rows;
    else
      update public.email_outbox
      set status = case when attempts >= 5 then 'failed' else 'pending' end, claimed_at = null, batch_id = null,
          retry_at = now() + make_interval(mins => (2 ^ least(attempts, 4))::integer),
          error = nullif(left(regexp_replace(coalesce(v_result ->> 'error', ''), '[^[:print:]]', '', 'g'), 300), '')
      where batch_id = v_batch::uuid and status = 'pending';
      get diagnostics v_rows = row_count; v_failed := v_failed + v_rows;
    end if;
  end loop;
  return jsonb_build_object('sent', v_sent, 'failed', v_failed);
end $$;

-- The signed-in person's choice (RLS limits the read to their row).
create function public.sp_email_settings(p jsonb default '{}'::jsonb) returns jsonb
language sql stable security invoker set search_path = public, pg_temp as $$
  select jsonb_build_object('enabled', coalesce(s.enabled, true), 'locale', s.locale)
  from (select 1) one left join public.email_settings s on s.user_id = auth.uid()
$$;

-- p = {enabled, locale}: either or both.
create function public.sp_set_email_settings(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.profiles := public.sp_actor(); s public.email_settings;
begin
  if p ? 'enabled' and jsonb_typeof(p -> 'enabled') is distinct from 'boolean' then perform public.sp_raise('invalid_field', 'enabled'); end if;
  if p ? 'locale' and (p ->> 'locale') is not null and (p ->> 'locale') not in ('es', 'en') then perform public.sp_raise('invalid_field', 'locale'); end if;
  select * into s from public.email_settings where user_id = a.id;
  insert into public.email_settings(user_id, enabled, locale)
  values (a.id,
    case when p ? 'enabled' then (p ->> 'enabled')::boolean else coalesce(s.enabled, true) end,
    case when p ? 'locale' then p ->> 'locale' else s.locale end)
  on conflict (user_id) do update set enabled = excluded.enabled, locale = excluded.locale, updated_at = now();
  return public.sp_email_settings();
end $$;

revoke all on function public.sp_email_gate_ok(text), public.sp_email_active(), public.sp_queue_notification_email(),
  public.sp_queue_invitation_email(), public.sp_email_claim(jsonb), public.sp_email_done(jsonb),
  public.sp_email_settings(jsonb), public.sp_set_email_settings(jsonb) from public, anon, authenticated;
-- The queue is worked by the app server, with or without a signed-in user (the gate is the control).
grant execute on function public.sp_email_claim(jsonb), public.sp_email_done(jsonb) to anon, authenticated;
grant execute on function public.sp_email_settings(jsonb), public.sp_set_email_settings(jsonb) to authenticated;
