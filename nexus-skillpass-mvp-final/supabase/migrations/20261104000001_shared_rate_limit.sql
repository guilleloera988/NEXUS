-- Shared attempt limits (pilot readiness): sign-in, sign-up, e-mail links, second-factor codes, uploads.
--
-- The app runs on many serverless instances, and a counter kept in memory starts again on each one. These
-- counters live in the database instead. Only the app's server can use them: it proves it holds
-- RATE_LIMIT_SECRET by sending a token derived from it, whose SHA-256 is stored in platform_settings under
-- 'rate_limit_gate'. Without that row (local DEMO, the public demo project, a new database) sp_rate_limit
-- refuses and the app keeps its per-instance limiter.
-- The server sends each key as an HMAC-SHA256 digest: no e-mail address or IP address is stored here.

create table public.rate_limit_hits (
  key text not null check (key ~ '^[0-9a-f]{64}$'),
  window_start timestamptz not null,
  expires_at timestamptz not null,
  hits integer not null default 1 check (hits > 0),
  primary key (key, window_start)
);
create index rate_limit_hits_expires_at_idx on public.rate_limit_hits (expires_at);
alter table public.rate_limit_hits enable row level security;
revoke all on public.rate_limit_hits from public, anon, authenticated;

-- p = {gate, checks: [{key, window, hit}]}, at most 5 checks. window is in seconds (1 to 3600) and counts in
-- fixed windows; hit = false only reads the counter. Returns one {hits, reset_in} per check, in order.
create function public.sp_rate_limit(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_gate text := (select value #>> '{}' from public.platform_settings where key = 'rate_limit_gate');
  v_check jsonb;
  v_key text;
  v_window integer;
  v_start timestamptz;
  v_hits integer;
  v_out jsonb := '[]'::jsonb;
begin
  if v_gate is null or v_gate !~ '^[0-9a-f]{64}$' or jsonb_typeof(p -> 'gate') is distinct from 'string'
     or encode(sha256(convert_to(p ->> 'gate', 'UTF8')), 'hex') <> v_gate then
    perform public.sp_raise('rate_limit_unavailable');
  end if;
  if jsonb_typeof(p -> 'checks') is distinct from 'array' or jsonb_array_length(p -> 'checks') not between 1 and 5 then
    perform public.sp_raise('invalid_data', 'checks');
  end if;

  -- Expired windows go a few at a time, so no call does more than a bounded amount of cleanup.
  delete from public.rate_limit_hits h
  using (select key, window_start from public.rate_limit_hits where expires_at < now()
         order by expires_at limit 20 for update skip locked) old
  where h.key = old.key and h.window_start = old.window_start;

  for v_check in select value from jsonb_array_elements(p -> 'checks') loop
    v_key := v_check ->> 'key';
    if jsonb_typeof(v_check) is distinct from 'object' or v_key is null or v_key !~ '^[0-9a-f]{64}$' then
      perform public.sp_raise('invalid_data', 'key');
    end if;
    if jsonb_typeof(v_check -> 'window') is distinct from 'number' or (v_check ->> 'window') !~ '^[0-9]{1,4}$' then
      perform public.sp_raise('invalid_data', 'window');
    end if;
    if (v_check ->> 'window')::integer not between 1 and 3600 then
      perform public.sp_raise('invalid_data', 'window');
    end if;
    if v_check ? 'hit' and jsonb_typeof(v_check -> 'hit') is distinct from 'boolean' then
      perform public.sp_raise('invalid_data', 'hit');
    end if;
    v_window := (v_check ->> 'window')::integer;
    v_start := to_timestamp(floor(extract(epoch from now()) / v_window) * v_window);
    if v_check -> 'hit' = 'false'::jsonb then
      v_hits := coalesce((select hits from public.rate_limit_hits where key = v_key and window_start = v_start), 0);
    else
      insert into public.rate_limit_hits as h (key, window_start, expires_at, hits)
      values (v_key, v_start, v_start + make_interval(secs => v_window), 1)
      on conflict (key, window_start) do update set hits = least(h.hits + 1, 1000000)
      returning h.hits into v_hits;
    end if;
    v_out := v_out || jsonb_build_object('hits', v_hits,
      'reset_in', greatest(ceil(extract(epoch from (v_start + make_interval(secs => v_window) - now())))::integer, 0));
  end loop;
  return v_out;
end $$;

revoke all on function public.sp_rate_limit(jsonb) from public, anon, authenticated;
grant execute on function public.sp_rate_limit(jsonb) to anon, authenticated;
