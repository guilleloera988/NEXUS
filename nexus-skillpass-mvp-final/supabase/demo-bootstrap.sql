-- DEMO ONLY. Never execute in an existing Supabase project.
-- PGlite has no Supabase Auth service; the server sets this claim per transaction.
create role anon nologin;
create role authenticated nologin;
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
insert into auth.users(id,email,raw_user_meta_data) values
('10000000-0000-4000-8000-000000000001','student@demo.invalid','{"full_name":"Ana Martínez"}'),
('10000000-0000-4000-8000-000000000002','supervisor@demo.invalid','{"full_name":"Supervisor Demo"}'),
('10000000-0000-4000-8000-000000000003','university@demo.invalid','{"full_name":"Observatorio Demo"}'),
('10000000-0000-4000-8000-000000000004','admin@demo.invalid','{"full_name":"Admin Demo"}');
