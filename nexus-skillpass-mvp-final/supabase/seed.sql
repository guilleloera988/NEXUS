-- FICTIONAL DEMO FIXTURES ONLY. Requires the four DEMO Auth UUIDs.
-- Local PGlite creates them in demo-bootstrap.sql. Do not run bootstrap in Supabase.
-- Never load this fixture in a production project. There are no real partnerships or outcomes here.
begin;
insert into public.profiles(id,full_name,role,slug,headline,location,university,career,bio,interests,semester,is_public,is_demo) values
('10000000-0000-4000-8000-000000000001','Ana Martínez','student','ana-martinez-demo','Construyendo soluciones con datos y tecnología','Aguascalientes, México','Universidad DEMO','Ingeniería en Tecnologías de Información','Perfil ficticio para demostrar experiencia aplicada con evidencia y revisión humana.','Datos, transformación digital, producto',6,true,true),
('10000000-0000-4000-8000-000000000002','Supervisor Demo','supervisor','supervisor-demo','Supervisor de proyectos DEMO','','','','','',null,false,true),
('10000000-0000-4000-8000-000000000003','Observatorio Demo','university','universidad-demo','','','','','','',null,false,true),
('10000000-0000-4000-8000-000000000004','Admin Demo','admin','admin-demo','','','','','','',null,false,true);
insert into public.organizations(id,name,type,is_demo) values
('20000000-0000-4000-8000-000000000001','Empresa Demo Aguascalientes','company',true),
('20000000-0000-4000-8000-000000000002','Universidad DEMO · Campus Alpha','university',true);
insert into public.organization_members(organization_id,user_id,role) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','student'),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','supervisor'),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','student'),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003','university');
insert into public.skills(id,name,category) values
('30000000-0000-4000-8000-000000000001','Business Analysis','business'),
('30000000-0000-4000-8000-000000000002','Digital Transformation','technical'),
('30000000-0000-4000-8000-000000000003','Communication','human'),
('30000000-0000-4000-8000-000000000004','Data Analysis','technical'),
('30000000-0000-4000-8000-000000000005','Problem Solving','human'),
('30000000-0000-4000-8000-000000000006','Project Management','business');
insert into public.challenges(id,organization_id,title,description,problem,expected_outcome,modality,start_date,end_date,created_by,is_demo) values
('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Digital Transformation Challenge for SMEs','Reto DEMO: analiza el proceso digital de una PYME ficticia y propone mejoras medibles.','La información de ventas está fragmentada.','Mapa del proceso, diagnóstico y prototipo de un dashboard.','Híbrida','2026-09-01','2026-12-15','10000000-0000-4000-8000-000000000004',true);
insert into public.challenge_skills(challenge_id,skill_id) select '40000000-0000-4000-8000-000000000001',id from public.skills;
insert into public.experiences(id,student_id,organization_id,title,description,responsibilities,deliverables,start_date,end_date,hours,verified_hours,status,is_demo) values
('50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Diagnóstico digital de una PYME · DEMO','Experiencia ficticia precargada: análisis de un proceso de ventas y propuesta de mejora.','Mapear el proceso y analizar datos de ejemplo.','Reporte, presentación y dashboard conceptual.','2026-08-01','2026-08-30',32,28,'verified',true);
insert into public.experience_skills(experience_id,skill_id) select '50000000-0000-4000-8000-000000000001',id from public.skills where id<>'30000000-0000-4000-8000-000000000006';
insert into public.evidence(experience_id,title,description,url,kind,is_public) values
('50000000-0000-4000-8000-000000000001','Reporte DEMO','URL ilustrativa. No representa un entregable empresarial real.','https://example.com/demo-report','document',true),
('50000000-0000-4000-8000-000000000001','Presentación DEMO','URL ilustrativa de presentación.','https://example.com/demo-presentation','presentation',true),
('50000000-0000-4000-8000-000000000001','Dashboard DEMO','URL ilustrativa del resultado de un proyecto ficticio.','https://example.com/demo-dashboard','result',true),
('50000000-0000-4000-8000-000000000001','Notas privadas DEMO','Esta evidencia es privada y debe quedar fuera de páginas públicas.','https://example.com/private-notes','document',false);
insert into public.validation_requests(id,experience_id,requested_by,status,completed_at) values
('70000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','completed',now());
insert into public.validations(id,experience_id,request_id,reviewer_id,decision,comment,rating,verified_hours) values
('80000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','approve','Validación ficticia DEMO; no acredita trabajo real.',4,28);
insert into public.credentials(id,experience_id,student_id,issuer_id,validation_id,is_demo) values
('60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','80000000-0000-4000-8000-000000000001',true);
insert into public.credential_skills(credential_id,skill_id,level) select '60000000-0000-4000-8000-000000000001',skill_id,4 from public.experience_skills;
insert into public.activity_events(actor_id,subject_id,organization_id,action,entity_id,details) values
('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','experience_verified','50000000-0000-4000-8000-000000000001','{"is_demo":true,"source":"seed"}');
commit;
