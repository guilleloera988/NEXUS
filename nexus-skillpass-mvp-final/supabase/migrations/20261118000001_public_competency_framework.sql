-- Public competency framework (Open Badges 3.0).
--
-- A SkillPass credential exported as an Open Badge aligns each verified competency to a public page that
-- describes it (Alignment.targetUrl = /competencies#<slug>). The catalog is reference data, the same for
-- everyone, but until now only signed-in users could read it. This function lets the public page read it.
-- Competencies that are no longer active stay listed, marked as such: credentials issued with them keep
-- pointing to their description.
create function public.sp_public_competencies(p jsonb default '{}'::jsonb) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'slug', k.slug, 'name_es', k.name_es, 'name_en', k.name_en, 'category', k.category,
      'description_es', k.description_es, 'description_en', k.description_en, 'is_active', k.is_active)
    order by k.name_es, k.slug), '[]'::jsonb)
  from public.competencies k
$$;

revoke all on function public.sp_public_competencies(jsonb) from public, anon, authenticated;
grant execute on function public.sp_public_competencies(jsonb) to anon, authenticated;
