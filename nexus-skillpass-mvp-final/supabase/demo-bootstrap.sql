-- LOCAL DEMO / TESTS ONLY. Never execute in a Supabase project.
-- PGlite has no Supabase Auth service. This file emulates the minimum surface the
-- migrations rely on: the anon/authenticated roles, auth.users and auth.uid().
-- The server sets request.jwt.claim.sub per transaction and switches role, so
-- row level security is evaluated exactly as it would be for a Supabase JWT.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth;
create table auth.users (
  id uuid primary key,
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
