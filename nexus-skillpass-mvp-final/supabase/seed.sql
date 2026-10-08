-- =============================================================================
-- SkillPass by AINDEV NEXUS — DEMO DATA ONLY
-- Every person, organization, challenge, number and file below is FICTIONAL and
-- flagged with is_demo = true. It exists so evaluators can walk the full flow.
-- It is NOT traction, NOT real partnerships and NOT real outcomes.
-- Never load this file into a production project that holds real users.
--
-- Prerequisite: the 16 demo auth users (see supabase/seed/demo-auth-users.sql for
-- the local PGlite DEMO, or `npm run seed -- --supabase` for a Supabase demo project).
-- Dates are relative to current_date so the scenario always looks current.
-- =============================================================================

do $$
begin
  if (select count(*) from auth.users where id::text like '10000000-0000-4000-8000-0000000000%') < 16 then
    raise exception 'Demo auth users are missing. Create them first (see supabase/seed/demo-auth-users.sql or npm run seed -- --supabase).';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Competency catalog (also useful outside the demo)
-- ---------------------------------------------------------------------------
insert into public.competencies (id, slug, name_es, name_en, category, description_es, description_en) values
  ('30000000-0000-4000-8000-000000000001','python','Python','Python','technical','Programación en Python para análisis, automatización o prototipos.','Python programming for analysis, automation or prototypes.'),
  ('30000000-0000-4000-8000-000000000002','data-analysis','Análisis de datos','Data Analysis','technical','Limpiar, analizar e interpretar datos para tomar decisiones.','Clean, analyze and interpret data to support decisions.'),
  ('30000000-0000-4000-8000-000000000003','sql','SQL y bases de datos','SQL & Databases','technical','Modelar y consultar bases de datos relacionales.','Model and query relational databases.'),
  ('30000000-0000-4000-8000-000000000004','web-development','Desarrollo web','Web Development','technical','Construir aplicaciones o prototipos web funcionales.','Build working web applications or prototypes.'),
  ('30000000-0000-4000-8000-000000000005','process-automation','Automatización de procesos','Process Automation','technical','Automatizar tareas repetitivas con herramientas digitales.','Automate repetitive work with digital tools.'),
  ('30000000-0000-4000-8000-000000000006','cad-design','Diseño CAD','CAD Design','technical','Modelado y documentación técnica en herramientas CAD.','Modelling and technical documentation in CAD tools.'),
  ('30000000-0000-4000-8000-000000000007','quality-control','Control de calidad','Quality Control','technical','Medición, inspección y mejora de la calidad.','Measuring, inspecting and improving quality.'),
  ('30000000-0000-4000-8000-000000000008','lean-manufacturing','Manufactura esbelta','Lean Manufacturing','technical','Herramientas lean para eliminar desperdicios.','Lean tools to remove waste.'),
  ('30000000-0000-4000-8000-000000000009','supply-chain','Cadena de suministro','Supply Chain','business','Planeación, abastecimiento y logística.','Planning, sourcing and logistics.'),
  ('30000000-0000-4000-8000-000000000010','business-intelligence','Inteligencia de negocios (BI)','Business Intelligence','digital','Tableros e indicadores para la toma de decisiones.','Dashboards and KPIs for decision making.'),
  ('30000000-0000-4000-8000-000000000011','ux-design','Diseño UX/UI','UX/UI Design','digital','Investigación de usuarios y diseño de interfaces.','User research and interface design.'),
  ('30000000-0000-4000-8000-000000000012','digital-marketing','Marketing digital','Digital Marketing','digital','Estrategia y ejecución en canales digitales.','Strategy and execution in digital channels.'),
  ('30000000-0000-4000-8000-000000000013','erp-systems','Sistemas ERP','ERP Systems','digital','Operación y configuración de sistemas ERP.','Operating and configuring ERP systems.'),
  ('30000000-0000-4000-8000-000000000014','project-management','Gestión de proyectos','Project Management','business','Planear, dar seguimiento y cerrar proyectos.','Plan, track and close projects.'),
  ('30000000-0000-4000-8000-000000000015','process-mapping','Mapeo de procesos','Process Mapping','business','Documentar y analizar procesos actuales y futuros.','Document and analyze current and future processes.'),
  ('30000000-0000-4000-8000-000000000016','financial-analysis','Análisis financiero','Financial Analysis','business','Evaluar costos, beneficios y viabilidad.','Assess costs, benefits and feasibility.'),
  ('30000000-0000-4000-8000-000000000017','market-research','Investigación de mercado','Market Research','business','Diseñar y analizar estudios de mercado.','Design and analyze market studies.'),
  ('30000000-0000-4000-8000-000000000018','communication','Comunicación','Communication','human','Comunicar ideas con claridad a distintas audiencias.','Communicate ideas clearly to different audiences.'),
  ('30000000-0000-4000-8000-000000000019','teamwork','Trabajo en equipo','Teamwork','human','Colaborar y coordinarse para lograr objetivos comunes.','Collaborate and coordinate towards shared goals.'),
  ('30000000-0000-4000-8000-000000000020','problem-solving','Resolución de problemas','Problem Solving','human','Identificar causas y proponer soluciones viables.','Identify causes and propose workable solutions.'),
  ('30000000-0000-4000-8000-000000000021','critical-thinking','Pensamiento crítico','Critical Thinking','human','Evaluar información y argumentos con rigor.','Evaluate information and arguments rigorously.'),
  ('30000000-0000-4000-8000-000000000022','adaptability','Adaptabilidad','Adaptability','human','Ajustarse a cambios de alcance, contexto o prioridades.','Adjust to changes in scope, context or priorities.'),
  ('30000000-0000-4000-8000-000000000023','leadership','Liderazgo','Leadership','human','Guiar y motivar a un equipo.','Guide and motivate a team.')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Organizations (fictional)
-- ---------------------------------------------------------------------------
insert into public.organizations (id, kind, name, slug, industry, size, location, website, description, needs, campus, programs, verification_status, verified_at, created_by, is_demo) values
  ('20000000-0000-4000-8000-000000000001','company','Nova Manufacturing (DEMO)','nova-manufacturing-demo','manufacturing','201-1000','Aguascalientes, Ags.','',
   'Empresa ficticia de manufactura de componentes metálicos para la industria automotriz, creada sólo para esta demostración.',
   'Digitalizar procesos comerciales y de planta; conocer talento joven con experiencia comprobable.', '', '{}', 'verified', now() - interval '150 days', '10000000-0000-4000-8000-000000000003', true),
  ('20000000-0000-4000-8000-000000000002','university','Demo University','demo-university','education','','Aguascalientes, Ags.','',
   'Universidad ficticia para la demostración de SkillPass.', '', 'Campus Centro',
   array['Ingeniería en Sistemas Computacionales','Ingeniería Industrial','Ingeniería Mecatrónica','Licenciatura en Mercadotecnia','Administración de Empresas'],
   'verified', now() - interval '160 days', '10000000-0000-4000-8000-000000000004', true),
  ('20000000-0000-4000-8000-000000000003','company','Bajío Logistics Hub (DEMO)','bajio-logistics-hub-demo','logistics','51-200','León, Gto.','',
   'Operador logístico ficticio del Bajío, creado sólo para esta demostración.',
   'Analítica de proveedores, rutas y comunicación comercial.', '', '{}', 'verified', now() - interval '140 days', '10000000-0000-4000-8000-000000000006', true),
  ('20000000-0000-4000-8000-000000000004','university','Instituto Tecnológico Demo','instituto-tecnologico-demo','education','','León, Gto.','',
   'Institución ficticia para la demostración de SkillPass.', '', 'Campus León', array['Ingeniería Industrial','Ingeniería en Logística'],
   'verified', now() - interval '130 days', '10000000-0000-4000-8000-000000000008', true),
  ('20000000-0000-4000-8000-000000000006','company','Agroindustrias del Centro (DEMO)','agroindustrias-centro-demo','agribusiness','11-50','Zacatecas, Zac.','',
   'Empresa ficticia en espera de verificación por AINDEV, para mostrar el flujo de aprobación de organizaciones.',
   'Trazabilidad de lotes agrícolas.', '', '{}', 'pending', null, '10000000-0000-4000-8000-000000000009', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Profiles (created by the auth trigger; completed here)
-- ---------------------------------------------------------------------------
update public.profiles set role = 'student', slug = 'maria-torres-demo', headline = 'Estudiante de Sistemas · automatización y datos',
  bio = 'Me interesa usar la tecnología para simplificar procesos en empresas de manufactura. (Perfil ficticio de demostración.)',
  location = 'Aguascalientes, Ags.', university_id = '20000000-0000-4000-8000-000000000002', career = 'Ingeniería en Sistemas Computacionales',
  semester = 7, interests = array['data','software','manufacturing'], availability = 'part_time', hours_per_week = 15,
  onboarding_completed = true, skillpass_public = true, open_to_opportunities = true, is_demo = true
  where id = '10000000-0000-4000-8000-000000000001';
update public.profiles set role = 'supervisor', slug = 'carlos-mendez-demo', headline = 'Gerente de Mejora Continua · Nova Manufacturing (DEMO)',
  onboarding_completed = true, is_demo = true where id = '10000000-0000-4000-8000-000000000002';
update public.profiles set role = 'company', slug = 'laura-rios-demo', headline = 'Líder de Talento e Innovación · Nova Manufacturing (DEMO)',
  onboarding_completed = true, is_demo = true where id = '10000000-0000-4000-8000-000000000003';
update public.profiles set role = 'university', slug = 'elena-vazquez-demo', headline = 'Coordinación de Vinculación · Demo University',
  onboarding_completed = true, is_demo = true where id = '10000000-0000-4000-8000-000000000004';
update public.profiles set role = 'admin', slug = 'aindev-admin-demo', headline = 'Operación de la plataforma (DEMO)',
  onboarding_completed = true, is_demo = true where id = '10000000-0000-4000-8000-000000000005';
update public.profiles set role = 'company', slug = 'mariana-solis-demo', headline = 'Directora de Operaciones · Bajío Logistics Hub (DEMO)',
  onboarding_completed = true, is_demo = true where id = '10000000-0000-4000-8000-000000000006';
update public.profiles set role = 'supervisor', slug = 'hector-aguilar-demo', headline = 'Jefe de Analítica · Bajío Logistics Hub (DEMO)',
  onboarding_completed = true, is_demo = true where id = '10000000-0000-4000-8000-000000000007';
update public.profiles set role = 'university', slug = 'luis-cardenas-demo', headline = 'Vinculación · Instituto Tecnológico Demo',
  onboarding_completed = true, is_demo = true where id = '10000000-0000-4000-8000-000000000008';
update public.profiles set role = 'company', slug = 'ruben-ibarra-demo', headline = 'Director General · Agroindustrias del Centro (DEMO)',
  onboarding_completed = true, is_demo = true where id = '10000000-0000-4000-8000-000000000009';

update public.profiles set slug = 'diego-ramirez-demo', headline = 'Estudiante de Ingeniería Industrial', university_id = '20000000-0000-4000-8000-000000000002',
  career = 'Ingeniería Industrial', semester = 8, interests = array['operations','manufacturing','logistics'], availability = 'part_time', hours_per_week = 12,
  bio = 'Perfil ficticio de demostración.', onboarding_completed = true, open_to_opportunities = true, is_demo = true
  where id = '10000000-0000-4000-8000-000000000011';
update public.profiles set slug = 'sofia-herrera-demo', headline = 'Estudiante de Mercadotecnia', university_id = '20000000-0000-4000-8000-000000000002',
  career = 'Licenciatura en Mercadotecnia', semester = 6, interests = array['marketing','strategy'], availability = 'flexible', hours_per_week = 10,
  bio = 'Perfil ficticio de demostración.', onboarding_completed = true, open_to_opportunities = true, is_demo = true
  where id = '10000000-0000-4000-8000-000000000012';
update public.profiles set slug = 'andres-castillo-demo', headline = 'Estudiante de Mecatrónica', university_id = '20000000-0000-4000-8000-000000000002',
  career = 'Ingeniería Mecatrónica', semester = 7, interests = array['energy','manufacturing','data'], availability = 'part_time', hours_per_week = 15,
  bio = 'Perfil ficticio de demostración.', onboarding_completed = true, skillpass_public = true, open_to_opportunities = true, is_demo = true
  where id = '10000000-0000-4000-8000-000000000013';
update public.profiles set slug = 'valeria-nunez-demo', headline = 'Estudiante de Sistemas · BI', university_id = '20000000-0000-4000-8000-000000000002',
  career = 'Ingeniería en Sistemas Computacionales', semester = 9, interests = array['data','software'], availability = 'part_time', hours_per_week = 20,
  bio = 'Perfil ficticio de demostración.', onboarding_completed = true, skillpass_public = true, open_to_opportunities = true, is_demo = true
  where id = '10000000-0000-4000-8000-000000000014';
update public.profiles set slug = 'jorge-lozano-demo', headline = 'Estudiante de Administración', university_id = '20000000-0000-4000-8000-000000000002',
  career = 'Administración de Empresas', semester = 8, interests = array['logistics','strategy','finance'], availability = 'weekends', hours_per_week = 8,
  bio = 'Perfil ficticio de demostración.', onboarding_completed = true, open_to_opportunities = false, is_demo = true
  where id = '10000000-0000-4000-8000-000000000015';
update public.profiles set slug = 'camila-ortiz-demo', headline = 'Estudiante de Ingeniería Industrial', university_id = '20000000-0000-4000-8000-000000000004',
  career = 'Ingeniería Industrial', semester = 6, interests = array['logistics','operations'], availability = 'part_time', hours_per_week = 15,
  bio = 'Perfil ficticio de demostración.', onboarding_completed = true, open_to_opportunities = true, is_demo = true
  where id = '10000000-0000-4000-8000-000000000016';
update public.profiles set slug = 'ricardo-pena-demo', headline = 'Estudiante de Logística', university_id = '20000000-0000-4000-8000-000000000004',
  career = 'Ingeniería en Logística', semester = 9, interests = array['logistics','data'], availability = 'full_time', hours_per_week = 30,
  bio = 'Perfil ficticio de demostración.', onboarding_completed = true, skillpass_public = true, open_to_opportunities = true, is_demo = true
  where id = '10000000-0000-4000-8000-000000000017';

insert into public.organization_members (organization_id, user_id, member_role) values
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','owner'),
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','supervisor'),
  ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004','owner'),
  ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000006','owner'),
  ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000007','supervisor'),
  ('20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000008','owner'),
  ('20000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000009','owner')
on conflict do nothing;

insert into public.declared_skills (student_id, competency_id)
select s, ('30000000-0000-4000-8000-0000000000' || c)::uuid from (values
  ('10000000-0000-4000-8000-000000000001'::uuid, array['01','02','03','04','05','15','18','20']),
  ('10000000-0000-4000-8000-000000000011'::uuid, array['07','08','15','18','19']),
  ('10000000-0000-4000-8000-000000000012'::uuid, array['12','17','18','11']),
  ('10000000-0000-4000-8000-000000000013'::uuid, array['01','02','06','20','21']),
  ('10000000-0000-4000-8000-000000000014'::uuid, array['02','03','10','18']),
  ('10000000-0000-4000-8000-000000000015'::uuid, array['09','16','19','21']),
  ('10000000-0000-4000-8000-000000000016'::uuid, array['09','15','02','19']),
  ('10000000-0000-4000-8000-000000000017'::uuid, array['09','02','19','21'])
) as x(s, codes), unnest(codes) as c
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Industry challenges (fictional)
-- ---------------------------------------------------------------------------
insert into public.challenges (id, organization_id, title, summary, description, problem, objective, industry, tags, target_careers, modality, location,
  duration_weeks, start_date, end_date, max_participants, estimated_vath, supervisor_id, conditions, compensation_type, compensation_details,
  ip_policy, ip_details, confidentiality, publication_policy, status, published_at, created_by, is_demo, created_at) values
  ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Commercial Process Automation',
   'Reducir el tiempo de respuesta de cotizaciones automatizando el proceso comercial.',
   'El equipo comercial de Nova Manufacturing (DEMO) prepara cotizaciones con hojas de cálculo y aprobaciones por mensaje. El reto consiste en diagnosticar el proceso y construir un prototipo funcional de automatización.',
   'Una cotización tarda en promedio 3.5 días hábiles; la información se captura varias veces y no hay trazabilidad de versiones ni aprobaciones.',
   'Diagnosticar el proceso actual, diseñar el flujo automatizado y validar un prototipo que reduzca el tiempo de respuesta a menos de un día.',
   'manufacturing', array['software','operations','manufacturing'], array['Sistemas','Industrial'], 'hybrid', 'Aguascalientes, Ags.',
   10, current_date - 45, current_date + 25, 3, 80, '10000000-0000-4000-8000-000000000002',
   'Dos visitas a planta por mes; el resto del trabajo es remoto. Horario flexible acordado con el supervisor.',
   'stipend', 'Apoyo económico mensual definido en el convenio individual (dato ficticio de la demostración).',
   'shared', 'El prototipo se desarrolla con licencia de uso para la empresa; el estudiante conserva el derecho de mostrar el trabajo en su portafolio.',
   'public', 'public_allowed', 'active', now() - interval '60 days', '10000000-0000-4000-8000-000000000003', true, now() - interval '70 days'),
  ('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Inventory Dashboard for Production Line',
   'Tablero de inventario para la línea de producción 2.',
   'Construir un tablero de inventario conectado a los registros de almacén para reducir quiebres de stock.',
   'La línea 2 sufre quiebres de inventario porque los niveles se consultan manualmente.',
   'Entregar un tablero con indicadores de rotación, exactitud y quiebres, validado con el equipo de planta.',
   'manufacturing', array['data','manufacturing'], array['Sistemas','Industrial'], 'onsite', 'Aguascalientes, Ags.',
   6, current_date - 130, current_date - 85, 2, 40, '10000000-0000-4000-8000-000000000002', 'Trabajo en planta dos días por semana.',
   'stipend', 'Apoyo económico durante el reto (dato ficticio).', 'company_license', 'Licencia de uso para la empresa; el estudiante puede mostrar capturas sin datos sensibles.',
   'public', 'public_allowed', 'completed', now() - interval '140 days', '10000000-0000-4000-8000-000000000003', true, now() - interval '150 days'),
  ('40000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','Energy Consumption Monitoring Prototype',
   'Prototipo para monitorear el consumo eléctrico de prensas.',
   'Diseñar un prototipo de monitoreo de consumo eléctrico en dos prensas hidráulicas y proponer acciones de ahorro.',
   'No existe medición por equipo, por lo que no se pueden priorizar acciones de eficiencia energética.',
   'Instrumentar un prototipo de medición, analizar datos de dos semanas y proponer tres acciones de ahorro.',
   'manufacturing', array['energy','data','manufacturing'], array['Mecatrónica','Sistemas','Industrial'], 'onsite', 'Aguascalientes, Ags.',
   8, current_date + 14, current_date + 70, 2, 64, '10000000-0000-4000-8000-000000000002', 'Uso de equipo de protección personal en planta.',
   'paid', 'Pago por proyecto definido en el contrato (dato ficticio).', 'shared', 'Propiedad compartida conforme a acuerdo específico.',
   'confidential', 'summary_only', 'recruiting', now() - interval '10 days', '10000000-0000-4000-8000-000000000003', true, now() - interval '12 days'),
  ('40000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000003','Supplier Onboarding Analytics',
   'Analizar el alta de proveedores y proponer mejoras medibles.',
   'Analizar los tiempos del proceso de alta de proveedores y proponer un tablero de seguimiento.',
   'El alta de un proveedor tarda hasta seis semanas y no hay visibilidad de cuellos de botella.',
   'Medir el proceso, identificar cuellos de botella y entregar un tablero con recomendaciones.',
   'logistics', array['logistics','data','operations'], array['Industrial','Logística','Administración'], 'remote', 'León, Gto.',
   6, current_date + 7, current_date + 49, 3, 48, '10000000-0000-4000-8000-000000000007', 'Reuniones semanales por videollamada.',
   'stipend', 'Apoyo económico durante el reto (dato ficticio).', 'student_owns', 'El estudiante conserva la propiedad; la empresa recibe licencia de uso interno.',
   'public', 'public_allowed', 'recruiting', now() - interval '6 days', '10000000-0000-4000-8000-000000000006', true, now() - interval '8 days'),
  ('40000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000003','Last-Mile Route Optimization Study',
   'Estudio de rutas de última milla para la zona metropolitana.',
   'Analizar entregas de última milla y proponer una reconfiguración de rutas.',
   'Los costos de última milla crecieron y hay rutas con baja ocupación.',
   'Proponer un rediseño de rutas con estimación de ahorro y plan de piloto.',
   'logistics', array['logistics','data'], array['Logística','Industrial','Administración'], 'hybrid', 'León, Gto.',
   6, current_date - 100, current_date - 50, 3, 60, '10000000-0000-4000-8000-000000000007', 'Recorridos de campo acompañados.',
   'paid', 'Pago por proyecto (dato ficticio).', 'company_license', 'Licencia de uso para la empresa.',
   'public', 'public_allowed', 'completed', now() - interval '110 days', '10000000-0000-4000-8000-000000000006', true, now() - interval '115 days'),
  ('40000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000001','Customer Experience Survey Redesign',
   'Rediseñar la encuesta de satisfacción de clientes B2B.',
   'Rediseñar la encuesta de satisfacción y proponer un tablero de seguimiento trimestral.',
   'La encuesta actual tiene baja respuesta y no genera información accionable.',
   'Entregar una encuesta rediseñada, piloteada con cinco clientes, y un tablero de resultados.',
   'manufacturing', array['marketing','data','strategy'], '{}', 'remote', 'Aguascalientes, Ags.',
   4, current_date + 30, current_date + 58, 2, 30, '10000000-0000-4000-8000-000000000002', 'Trabajo remoto con dos sesiones de revisión.',
   'prize', 'Reconocimiento económico al mejor entregable (dato ficticio).', 'student_owns', 'El estudiante conserva la propiedad del instrumento.',
   'public', 'public_allowed', 'published', now() - interval '2 days', '10000000-0000-4000-8000-000000000003', true, now() - interval '3 days'),
  ('40000000-0000-4000-8000-000000000007','20000000-0000-4000-8000-000000000001','Lean Kaizen Documentation Sprint',
   'Documentar eventos kaizen con estándares visuales.',
   'Borrador en preparación por la empresa.',
   'Los resultados de los eventos kaizen no se documentan de forma estándar.',
   'Crear plantillas y documentar tres eventos kaizen.',
   'manufacturing', array['manufacturing','operations'], array['Industrial'], 'onsite', 'Aguascalientes, Ags.',
   4, null, null, 2, 32, null, '', 'none', '', 'to_be_agreed', '', 'public', 'public_allowed', 'draft', null,
   '10000000-0000-4000-8000-000000000003', true, now() - interval '1 days'),
  ('40000000-0000-4000-8000-000000000008','20000000-0000-4000-8000-000000000003','Export Digital Marketing Plan',
   'Plan de marketing digital para atraer clientes de exportación.',
   'Diseñar un plan de marketing digital para la nueva línea de servicios de exportación.',
   'La empresa no tiene presencia digital orientada a clientes de exportación.',
   'Entregar un plan de 90 días con contenidos, canales e indicadores.',
   'logistics', array['marketing','strategy'], array['Mercadotecnia','Administración'], 'remote', 'León, Gto.',
   6, current_date - 21, current_date + 21, 2, 45, '10000000-0000-4000-8000-000000000007', 'Trabajo remoto.',
   'stipend', 'Apoyo económico durante el reto (dato ficticio).', 'student_owns', 'El estudiante conserva la propiedad; licencia de uso para la empresa.',
   'public', 'public_allowed', 'active', now() - interval '35 days', '10000000-0000-4000-8000-000000000006', true, now() - interval '40 days')
on conflict (id) do nothing;

insert into public.challenge_competencies (challenge_id, competency_id, required_level)
select ('40000000-0000-4000-8000-00000000000' || ch)::uuid, ('30000000-0000-4000-8000-0000000000' || c)::uuid, lvl from (values
  ('1','05',3),('1','15',3),('1','02',3),('1','18',3),('1','20',3),
  ('2','10',3),('2','02',3),('2','03',3),('2','18',3),
  ('3','01',3),('3','02',3),('3','20',3),('3','07',2),
  ('4','09',3),('4','02',3),('4','15',3),('4','18',3),
  ('5','09',3),('5','21',3),('5','02',3),('5','19',3),
  ('6','17',3),('6','12',2),('6','18',3),
  ('7','08',3),('7','15',3),
  ('8','12',3),('8','17',3),('8','18',3)
) as x(ch, c, lvl)
on conflict do nothing;

insert into public.challenge_deliverables (id, challenge_id, title, description, due_date, sort_order) values
  ('41000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','Diagnóstico del proceso comercial (as-is)','Mapa del proceso actual con tiempos y puntos de dolor.', current_date - 20, 1),
  ('41000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','Prototipo de automatización de cotizaciones','Prototipo funcional probado con el equipo comercial.', current_date + 7, 2),
  ('41000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001','Reporte de impacto y recomendaciones','Resultados del piloto y hoja de ruta de implementación.', current_date + 24, 3),
  ('41000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000002','Modelo de datos de inventario','Modelo y consultas para el tablero.', current_date - 110, 1),
  ('41000000-0000-4000-8000-000000000005','40000000-0000-4000-8000-000000000002','Tablero de inventario validado','Tablero en uso por el equipo de planta.', current_date - 86, 2),
  ('41000000-0000-4000-8000-000000000006','40000000-0000-4000-8000-000000000003','Prototipo de medición','Prototipo instalado en dos prensas.', current_date + 40, 1),
  ('41000000-0000-4000-8000-000000000007','40000000-0000-4000-8000-000000000003','Análisis y acciones de ahorro','Análisis de dos semanas y tres acciones de ahorro.', current_date + 70, 2),
  ('41000000-0000-4000-8000-000000000008','40000000-0000-4000-8000-000000000004','Medición del proceso de alta','Tiempos por etapa y cuellos de botella.', current_date + 28, 1),
  ('41000000-0000-4000-8000-000000000009','40000000-0000-4000-8000-000000000004','Tablero y recomendaciones','Tablero de seguimiento y propuesta de mejora.', current_date + 49, 2),
  ('41000000-0000-4000-8000-000000000010','40000000-0000-4000-8000-000000000005','Diagnóstico de rutas','Análisis de ocupación y costo por ruta.', current_date - 75, 1),
  ('41000000-0000-4000-8000-000000000011','40000000-0000-4000-8000-000000000005','Propuesta de rediseño','Rediseño con estimación de ahorro.', current_date - 52, 2),
  ('41000000-0000-4000-8000-000000000012','40000000-0000-4000-8000-000000000006','Encuesta rediseñada','Instrumento piloteado.', current_date + 45, 1),
  ('41000000-0000-4000-8000-000000000013','40000000-0000-4000-8000-000000000007','Plantillas kaizen','Plantillas estándar.', null, 1),
  ('41000000-0000-4000-8000-000000000014','40000000-0000-4000-8000-000000000008','Plan de 90 días','Contenidos, canales e indicadores.', current_date + 20, 1)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Applications and assignments
-- ---------------------------------------------------------------------------
insert into public.applications (id, challenge_id, student_id, motivation, status, match_score, decided_by, decided_at, decision_note, created_at) values
  ('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
   'Quiero aplicar lo que aprendí de automatización y bases de datos a un proceso real de una empresa de manufactura.', 'accepted', 86,
   '10000000-0000-4000-8000-000000000003', now() - interval '48 days', 'Perfil alineado con el reto.', now() - interval '55 days'),
  ('50000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000011',
   'Me interesa el mapeo de procesos y la mejora continua en ventas y almacén.', 'accepted', 74,
   '10000000-0000-4000-8000-000000000003', now() - interval '48 days', 'Complementa al equipo con visión de procesos.', now() - interval '54 days'),
  ('50000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',
   'Quiero construir tableros que se usen de verdad en planta.', 'accepted', 80,
   '10000000-0000-4000-8000-000000000003', now() - interval '132 days', '', now() - interval '138 days'),
  ('50000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000014',
   'Tengo experiencia escolar con Power BI y SQL y quiero probarla en un proyecto real.', 'accepted', 82,
   '10000000-0000-4000-8000-000000000003', now() - interval '132 days', '', now() - interval '137 days'),
  ('50000000-0000-4000-8000-000000000005','40000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000013',
   'Me apasiona la instrumentación y el ahorro de energía en la industria.', 'submitted', 79, null, null, '', now() - interval '3 days'),
  ('50000000-0000-4000-8000-000000000006','40000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000014',
   'Puedo apoyar en el análisis de datos de consumo y en el tablero de resultados.', 'submitted', 66, null, null, '', now() - interval '2 days'),
  ('50000000-0000-4000-8000-000000000007','40000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000016',
   'He trabajado con indicadores logísticos en materias de la carrera y quiero aplicarlos.', 'shortlisted', 84,
   '10000000-0000-4000-8000-000000000006', now() - interval '1 days', '', now() - interval '4 days'),
  ('50000000-0000-4000-8000-000000000008','40000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000011',
   'Quiero aplicar mapeo de procesos en un contexto logístico.', 'submitted', 71, null, null, '', now() - interval '2 days'),
  ('50000000-0000-4000-8000-000000000009','40000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000015',
   'Me interesa la logística y el análisis de costos.', 'accepted', 70, '10000000-0000-4000-8000-000000000006', now() - interval '102 days', '', now() - interval '108 days'),
  ('50000000-0000-4000-8000-000000000010','40000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000013',
   'Quiero aplicar análisis de datos a un problema de operación.', 'accepted', 68, '10000000-0000-4000-8000-000000000006', now() - interval '102 days', '', now() - interval '107 days'),
  ('50000000-0000-4000-8000-000000000011','40000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000017',
   'Estudio logística y quiero trabajar en rutas reales.', 'accepted', 88, '10000000-0000-4000-8000-000000000006', now() - interval '102 days', '', now() - interval '106 days'),
  ('50000000-0000-4000-8000-000000000012','40000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000012',
   'Quiero diseñar un plan digital real para una empresa del Bajío.', 'accepted', 83, '10000000-0000-4000-8000-000000000006', now() - interval '24 days', '', now() - interval '30 days'),
  ('50000000-0000-4000-8000-000000000013','40000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000016',
   'Me interesa la comunicación comercial en logística.', 'accepted', 61, '10000000-0000-4000-8000-000000000006', now() - interval '24 days', '', now() - interval '29 days')
on conflict (id) do nothing;

insert into public.assignments (id, challenge_id, student_id, application_id, assigned_by, team_role, status, started_at, completed_at) values
  ('51000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','Desarrollo del prototipo','active', now() - interval '45 days', null),
  ('51000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000011','50000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003','Diagnóstico de procesos','active', now() - interval '45 days', null),
  ('51000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','Modelo de datos y tablero','completed', now() - interval '130 days', now() - interval '80 days'),
  ('51000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000014','50000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000003','Indicadores','completed', now() - interval '130 days', now() - interval '80 days'),
  ('51000000-0000-4000-8000-000000000005','40000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000015','50000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000006','Costos','completed', now() - interval '100 days', now() - interval '45 days'),
  ('51000000-0000-4000-8000-000000000006','40000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000013','50000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000006','Análisis de datos','completed', now() - interval '100 days', now() - interval '45 days'),
  ('51000000-0000-4000-8000-000000000007','40000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000017','50000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000006','Rutas','completed', now() - interval '100 days', now() - interval '45 days'),
  ('51000000-0000-4000-8000-000000000008','40000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000012','50000000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000006','Contenidos','active', now() - interval '21 days', null),
  ('51000000-0000-4000-8000-000000000009','40000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000016','50000000-0000-4000-8000-000000000013','10000000-0000-4000-8000-000000000006','Canales','active', now() - interval '21 days', null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Workspace: tasks
-- ---------------------------------------------------------------------------
insert into public.tasks (id, challenge_id, deliverable_id, title, description, status, assignee_id, due_date, sort_order, created_by, created_at) values
  ('52000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001','Entrevistar al equipo comercial y almacén','Seis entrevistas semiestructuradas.','done','10000000-0000-4000-8000-000000000011', current_date - 30, 1,'10000000-0000-4000-8000-000000000002', now() - interval '44 days'),
  ('52000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001','Mapear el proceso de cotización actual','Mapa as-is con tiempos por etapa.','done','10000000-0000-4000-8000-000000000001', current_date - 24, 2,'10000000-0000-4000-8000-000000000002', now() - interval '44 days'),
  ('52000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000002','Diseñar el flujo automatizado (to-be)','Flujo con reglas de precio y aprobación.','done','10000000-0000-4000-8000-000000000001', current_date - 10, 3,'10000000-0000-4000-8000-000000000001', now() - interval '20 days'),
  ('52000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000002','Construir el prototipo del cotizador','Prototipo funcional con cálculo automático.','in_progress','10000000-0000-4000-8000-000000000001', current_date + 4, 4,'10000000-0000-4000-8000-000000000001', now() - interval '12 days'),
  ('52000000-0000-4000-8000-000000000005','40000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000002','Probar el prototipo con tres vendedores','Sesiones de prueba y registro de hallazgos.','todo','10000000-0000-4000-8000-000000000011', current_date + 7, 5,'10000000-0000-4000-8000-000000000002', now() - interval '12 days'),
  ('52000000-0000-4000-8000-000000000006','40000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000003','Redactar el reporte de impacto','Resultados, ahorro estimado y recomendaciones.','todo','10000000-0000-4000-8000-000000000001', current_date + 22, 6,'10000000-0000-4000-8000-000000000002', now() - interval '12 days'),
  ('52000000-0000-4000-8000-000000000007','40000000-0000-4000-8000-000000000008','41000000-0000-4000-8000-000000000014','Benchmark de competidores de exportación','Revisión de cinco competidores.','done','10000000-0000-4000-8000-000000000012', current_date - 10, 1,'10000000-0000-4000-8000-000000000007', now() - interval '20 days'),
  ('52000000-0000-4000-8000-000000000008','40000000-0000-4000-8000-000000000008','41000000-0000-4000-8000-000000000014','Calendario de contenidos','Calendario de 90 días.','in_progress','10000000-0000-4000-8000-000000000016', current_date + 10, 2,'10000000-0000-4000-8000-000000000007', now() - interval '20 days')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Evidence (files live in supabase/seed/files and are copied to storage by the seed script)
-- ---------------------------------------------------------------------------
insert into public.evidence (id, challenge_id, assignment_id, student_id, deliverable_id, task_id, title, description, kind, url, storage_path, file_name, mime_type, size_bytes,
  status, is_public, submitted_at, reviewed_by, reviewed_at, review_comment, created_at) values
  -- María · Commercial Process Automation
  ('60000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000002',
   'Mapa del proceso comercial (as-is)','Mapa del proceso con tiempos y hallazgos del diagnóstico.','pdf',null,
   '10000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000001/8f3a2c-mapa-proceso-comercial.pdf','mapa-proceso-comercial.pdf','application/pdf',95613,
   'approved', true, now() - interval '24 days', '10000000-0000-4000-8000-000000000002', now() - interval '20 days', 'Mapa claro y validado con gerencia.', now() - interval '25 days'),
  ('60000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000002','52000000-0000-4000-8000-000000000003',
   'Flujo automatizado de cotización (to-be)','Diagrama del flujo propuesto con reglas de precio y aprobación.','link','https://example.com/skillpass-demo/nova/flujo-to-be',null,null,null,null,
   'approved', true, now() - interval '11 days', '10000000-0000-4000-8000-000000000002', now() - interval '8 days', 'Buen diseño; considerar excepciones de precio especial.', now() - interval '11 days'),
  ('60000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000002','52000000-0000-4000-8000-000000000004',
   'Prototipo del cotizador — repositorio','Código del prototipo y guía de instalación (enlace ficticio de demostración).','repository','https://example.com/skillpass-demo/nova/cotizador',null,null,null,null,
   'draft', false, null, null, null, '', now() - interval '3 days'),
  -- Diego · Commercial Process Automation (pending review)
  ('60000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000011','41000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001',
   'Bitácora de entrevistas','Registro de hallazgos de las entrevistas con ventas, almacén y gerencia.','pdf',null,
   '10000000-0000-4000-8000-000000000011/40000000-0000-4000-8000-000000000001/c52e71-bitacora-entrevistas.pdf','bitacora-entrevistas.pdf','application/pdf',88157,
   'submitted', false, now() - interval '5 days', null, null, '', now() - interval '6 days'),
  -- María · Inventory Dashboard (completed)
  ('60000000-0000-4000-8000-000000000005','40000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000005',null,
   'Tablero de inventario (captura)','Captura del tablero validado por el equipo de planta (datos ficticios).','image',null,
   '10000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000002/b71d09-dashboard-inventario.png','dashboard-inventario.png','image/png',46472,
   'approved', true, now() - interval '90 days', '10000000-0000-4000-8000-000000000002', now() - interval '82 days', 'Tablero en uso por planta.', now() - interval '91 days'),
  ('60000000-0000-4000-8000-000000000006','40000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000004',null,
   'Modelo de datos y consultas SQL','Repositorio con el modelo y las consultas (enlace ficticio).','repository','https://example.com/skillpass-demo/nova/inventario-sql',null,null,null,null,
   'approved', false, now() - interval '110 days', '10000000-0000-4000-8000-000000000002', now() - interval '82 days', '', now() - interval '111 days'),
  ('60000000-0000-4000-8000-000000000007','40000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000014','41000000-0000-4000-8000-000000000005',null,
   'Definición de indicadores','Documento de indicadores del tablero (enlace ficticio).','document','https://example.com/skillpass-demo/nova/indicadores',null,null,null,null,
   'approved', true, now() - interval '92 days', '10000000-0000-4000-8000-000000000002', now() - interval '82 days', '', now() - interval '93 days'),
  -- Last-Mile Route Optimization (completed)
  ('60000000-0000-4000-8000-000000000008','40000000-0000-4000-8000-000000000005','51000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000015','41000000-0000-4000-8000-000000000011',null,
   'Análisis de costos por ruta','Hoja de cálculo con costos por ruta (enlace ficticio).','document','https://example.com/skillpass-demo/bajio/costos-ruta',null,null,null,null,
   'approved', false, now() - interval '55 days', '10000000-0000-4000-8000-000000000007', now() - interval '47 days', '', now() - interval '56 days'),
  ('60000000-0000-4000-8000-000000000009','40000000-0000-4000-8000-000000000005','51000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000013','41000000-0000-4000-8000-000000000010',null,
   'Modelo de ocupación de rutas','Notebook con el análisis de ocupación (enlace ficticio).','repository','https://example.com/skillpass-demo/bajio/ocupacion',null,null,null,null,
   'approved', true, now() - interval '60 days', '10000000-0000-4000-8000-000000000007', now() - interval '47 days', '', now() - interval '61 days'),
  ('60000000-0000-4000-8000-000000000010','40000000-0000-4000-8000-000000000005','51000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000017','41000000-0000-4000-8000-000000000011',null,
   'Propuesta de rediseño de rutas','Presentación final a dirección (enlace ficticio).','presentation','https://example.com/skillpass-demo/bajio/rediseno-rutas',null,null,null,null,
   'approved', true, now() - interval '52 days', '10000000-0000-4000-8000-000000000007', now() - interval '47 days', 'Propuesta sólida y bien argumentada.', now() - interval '53 days'),
  -- Export Digital Marketing Plan (pending review)
  ('60000000-0000-4000-8000-000000000011','40000000-0000-4000-8000-000000000008','51000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000012','41000000-0000-4000-8000-000000000014','52000000-0000-4000-8000-000000000007',
   'Benchmark de competidores','Tabla comparativa de cinco competidores (enlace ficticio).','document','https://example.com/skillpass-demo/bajio/benchmark',null,null,null,null,
   'submitted', false, now() - interval '4 days', null, null, '', now() - interval '5 days')
on conflict (id) do nothing;

insert into public.evidence_competencies (evidence_id, competency_id)
select ('60000000-0000-4000-8000-0000000000' || e)::uuid, ('30000000-0000-4000-8000-0000000000' || c)::uuid from (values
  ('01','15'),('01','18'),('02','05'),('02','15'),('03','05'),('03','02'),('04','15'),('04','18'),
  ('05','10'),('05','02'),('06','03'),('07','10'),('08','09'),('09','02'),('10','09'),('10','21'),('11','17')
) as x(e, c)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Validation requests, VATH and rubric
-- ---------------------------------------------------------------------------
insert into public.validation_requests (id, challenge_id, assignment_id, student_id, supervisor_id, status, student_note, outcome, summary_comment, completed_by, completed_at, created_at) values
  ('70000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
   'completed','Entrego el diagnóstico del proceso actual.','partially_approved','Diagnóstico sólido. Se ajustó una entrada de horas.','10000000-0000-4000-8000-000000000002', now() - interval '20 days', now() - interval '24 days'),
  ('70000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000002',
   'pending','Comparto la bitácora de entrevistas y mis horas de diagnóstico.',null,'',null,null, now() - interval '5 days'),
  ('70000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
   'completed','Entrego el diseño del flujo automatizado.','approved','Buen avance hacia el prototipo.','10000000-0000-4000-8000-000000000002', now() - interval '8 days', now() - interval '11 days'),
  ('70000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000008','51000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000007',
   'pending','Benchmark terminado.',null,'',null,null, now() - interval '4 days'),
  ('70000000-0000-4000-8000-000000000005','40000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
   'completed','Entrega final del tablero.','approved','Tablero adoptado por planta. Excelente trabajo.','10000000-0000-4000-8000-000000000002', now() - interval '80 days', now() - interval '84 days'),
  ('70000000-0000-4000-8000-000000000006','40000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000014','10000000-0000-4000-8000-000000000002',
   'completed','Entrega final de indicadores.','approved','Indicadores bien definidos.','10000000-0000-4000-8000-000000000002', now() - interval '80 days', now() - interval '84 days'),
  ('70000000-0000-4000-8000-000000000007','40000000-0000-4000-8000-000000000005','51000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000015','10000000-0000-4000-8000-000000000007',
   'completed','Entrega final.','approved','Análisis de costos claro.','10000000-0000-4000-8000-000000000007', now() - interval '45 days', now() - interval '49 days'),
  ('70000000-0000-4000-8000-000000000008','40000000-0000-4000-8000-000000000005','51000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000013','10000000-0000-4000-8000-000000000007',
   'completed','Entrega final.','approved','Modelo útil para la operación.','10000000-0000-4000-8000-000000000007', now() - interval '45 days', now() - interval '49 days'),
  ('70000000-0000-4000-8000-000000000009','40000000-0000-4000-8000-000000000005','51000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000017','10000000-0000-4000-8000-000000000007',
   'completed','Entrega final.','approved','Propuesta adoptada para piloto.','10000000-0000-4000-8000-000000000007', now() - interval '45 days', now() - interval '49 days')
on conflict (id) do nothing;

insert into public.vath_entries (id, challenge_id, assignment_id, student_id, task_id, activity_date, activity, description, submitted_hours, verified_hours, status, submitted_at, validated_by, validated_at, validation_comment, created_at) values
  ('61000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000002',
   current_date - 30,'Levantamiento del proceso de cotización','Observación del proceso y revisión de cotizaciones históricas.',6,6,'verified', now() - interval '24 days','10000000-0000-4000-8000-000000000002', now() - interval '20 days','', now() - interval '30 days'),
  ('61000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000002',
   current_date - 26,'Mapa as-is y validación con gerencia','Elaboración del mapa y sesión de validación con la gerencia comercial.',8,7,'adjusted', now() - interval '24 days','10000000-0000-4000-8000-000000000002', now() - interval '20 days','Se reconocen 7 h: una hora corresponde a traslado.', now() - interval '26 days'),
  ('61000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000003',
   current_date - 12,'Diseño del flujo automatizado','Diseño del flujo to-be con reglas de precio y aprobación.',5,5,'verified', now() - interval '11 days','10000000-0000-4000-8000-000000000002', now() - interval '8 days','', now() - interval '12 days'),
  ('61000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000004',
   current_date - 4,'Desarrollo del prototipo del cotizador','Implementación del cálculo automático de precios y plantillas.',6,null,'draft', null, null, null,'', now() - interval '4 days'),
  ('61000000-0000-4000-8000-000000000005','40000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000004',
   current_date - 2,'Pruebas internas del prototipo','Pruebas con casos reales anonimizados y corrección de errores.',4,null,'draft', null, null, null,'', now() - interval '2 days'),
  ('61000000-0000-4000-8000-000000000006','40000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000011','52000000-0000-4000-8000-000000000001',
   current_date - 25,'Entrevistas con ventas y almacén','Seis entrevistas semiestructuradas con registro de hallazgos.',5,null,'submitted', now() - interval '5 days', null, null,'', now() - interval '25 days'),
  ('61000000-0000-4000-8000-000000000007','40000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000011','52000000-0000-4000-8000-000000000001',
   current_date - 20,'Sistematización de hallazgos','Clasificación de hallazgos y propuesta de prioridades.',3,null,'submitted', now() - interval '5 days', null, null,'', now() - interval '20 days'),
  ('61000000-0000-4000-8000-000000000008','40000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001',null,
   current_date - 120,'Modelo de datos de inventario','Diseño del modelo y consultas de inventario.',12,12,'verified', now() - interval '84 days','10000000-0000-4000-8000-000000000002', now() - interval '80 days','', now() - interval '120 days'),
  ('61000000-0000-4000-8000-000000000009','40000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001',null,
   current_date - 105,'Construcción del tablero','Construcción de indicadores y visualizaciones.',10,10,'verified', now() - interval '84 days','10000000-0000-4000-8000-000000000002', now() - interval '80 days','', now() - interval '105 days'),
  ('61000000-0000-4000-8000-000000000010','40000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001',null,
   current_date - 92,'Validación con planta y ajustes','Sesiones con supervisores de planta y ajustes finales.',14,12,'adjusted', now() - interval '84 days','10000000-0000-4000-8000-000000000002', now() - interval '80 days','Se reconocen 12 h según la agenda de sesiones.', now() - interval '92 days'),
  ('61000000-0000-4000-8000-000000000011','40000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000014',null,
   current_date - 110,'Definición de indicadores','Definición y documentación de indicadores.',10,10,'verified', now() - interval '84 days','10000000-0000-4000-8000-000000000002', now() - interval '80 days','', now() - interval '110 days'),
  ('61000000-0000-4000-8000-000000000012','40000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000014',null,
   current_date - 95,'Pruebas de datos del tablero','Pruebas de calidad de datos y conciliación.',16,16,'verified', now() - interval '84 days','10000000-0000-4000-8000-000000000002', now() - interval '80 days','', now() - interval '95 days'),
  ('61000000-0000-4000-8000-000000000013','40000000-0000-4000-8000-000000000005','51000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000015',null,
   current_date - 70,'Análisis de costos por ruta','Cálculo de costo por entrega y por ruta.',16,16,'verified', now() - interval '49 days','10000000-0000-4000-8000-000000000007', now() - interval '45 days','', now() - interval '70 days'),
  ('61000000-0000-4000-8000-000000000014','40000000-0000-4000-8000-000000000005','51000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000013',null,
   current_date - 72,'Modelo de ocupación','Modelo de ocupación por ruta y franja horaria.',12,12,'verified', now() - interval '49 days','10000000-0000-4000-8000-000000000007', now() - interval '45 days','', now() - interval '72 days'),
  ('61000000-0000-4000-8000-000000000015','40000000-0000-4000-8000-000000000005','51000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000013',null,
   current_date - 60,'Recorridos de campo','Acompañamiento a dos rutas de entrega.',8,6,'adjusted', now() - interval '49 days','10000000-0000-4000-8000-000000000007', now() - interval '45 days','Se reconocen 6 h de recorrido efectivo.', now() - interval '60 days'),
  ('61000000-0000-4000-8000-000000000016','40000000-0000-4000-8000-000000000005','51000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000017',null,
   current_date - 65,'Rediseño de rutas','Propuesta de rediseño y estimación de ahorro.',16,16,'verified', now() - interval '49 days','10000000-0000-4000-8000-000000000007', now() - interval '45 days','', now() - interval '65 days'),
  ('61000000-0000-4000-8000-000000000017','40000000-0000-4000-8000-000000000005','51000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000017',null,
   current_date - 58,'Presentación a dirección','Preparación y presentación de la propuesta.',6,6,'verified', now() - interval '49 days','10000000-0000-4000-8000-000000000007', now() - interval '45 days','', now() - interval '58 days'),
  ('61000000-0000-4000-8000-000000000018','40000000-0000-4000-8000-000000000008','51000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000012','52000000-0000-4000-8000-000000000007',
   current_date - 9,'Benchmark de competidores','Revisión de sitios y redes de cinco competidores.',6,null,'submitted', now() - interval '4 days', null, null,'', now() - interval '9 days')
on conflict (id) do nothing;

insert into public.vath_entry_evidence (vath_entry_id, evidence_id)
select ('61000000-0000-4000-8000-0000000000' || v)::uuid, ('60000000-0000-4000-8000-0000000000' || e)::uuid from (values
  ('01','01'),('02','01'),('03','02'),('04','03'),('05','03'),('06','04'),('07','04'),('08','06'),('09','05'),('10','05'),
  ('11','07'),('12','07'),('13','08'),('14','09'),('15','09'),('16','10'),('17','10'),('18','11')
) as x(v, e)
on conflict do nothing;

insert into public.validation_request_items (request_id, item_type, item_id)
select ('70000000-0000-4000-8000-00000000000' || r)::uuid, t, (case t when 'vath' then '61000000-0000-4000-8000-0000000000' else '60000000-0000-4000-8000-0000000000' end || i)::uuid
from (values
  ('1','vath','01'),('1','vath','02'),('1','evidence','01'),
  ('2','vath','06'),('2','vath','07'),('2','evidence','04'),
  ('3','vath','03'),('3','evidence','02'),
  ('4','vath','18'),('4','evidence','11'),
  ('5','vath','08'),('5','vath','09'),('5','vath','10'),('5','evidence','05'),('5','evidence','06'),
  ('6','vath','11'),('6','vath','12'),('6','evidence','07'),
  ('7','vath','13'),('7','evidence','08'),
  ('8','vath','14'),('8','vath','15'),('8','evidence','09'),
  ('9','vath','16'),('9','vath','17'),('9','evidence','10')
) as x(r, t, i)
on conflict do nothing;

insert into public.competency_assessments (request_id, challenge_id, assignment_id, student_id, competency_id, level, comment, assessor_id, created_at)
select ('70000000-0000-4000-8000-00000000000' || r)::uuid, ch::uuid, asg::uuid, st::uuid, ('30000000-0000-4000-8000-0000000000' || c)::uuid, lvl, cm, ass::uuid, now() - (d || ' days')::interval
from (values
  -- María · Commercial Process Automation (in progress)
  ('1','40000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','15',4,'Mapeo detallado y bien documentado.','10000000-0000-4000-8000-000000000002',20),
  ('1','40000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','18',3,'Comunica con claridad; puede sintetizar más.','10000000-0000-4000-8000-000000000002',20),
  -- María · Inventory Dashboard
  ('5','40000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','10',4,'','10000000-0000-4000-8000-000000000002',80),
  ('5','40000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','02',4,'','10000000-0000-4000-8000-000000000002',80),
  ('5','40000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','03',3,'','10000000-0000-4000-8000-000000000002',80),
  ('5','40000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','18',4,'','10000000-0000-4000-8000-000000000002',80),
  -- Valeria · Inventory Dashboard
  ('6','40000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000014','10',3,'','10000000-0000-4000-8000-000000000002',80),
  ('6','40000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000014','02',3,'','10000000-0000-4000-8000-000000000002',80),
  ('6','40000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000014','18',2,'En desarrollo: practicar presentaciones ejecutivas.','10000000-0000-4000-8000-000000000002',80),
  -- Last-Mile Route Optimization
  ('7','40000000-0000-4000-8000-000000000005','51000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000015','09',4,'','10000000-0000-4000-8000-000000000007',45),
  ('7','40000000-0000-4000-8000-000000000005','51000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000015','21',3,'','10000000-0000-4000-8000-000000000007',45),
  ('7','40000000-0000-4000-8000-000000000005','51000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000015','19',4,'','10000000-0000-4000-8000-000000000007',45),
  ('8','40000000-0000-4000-8000-000000000005','51000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000013','02',3,'','10000000-0000-4000-8000-000000000007',45),
  ('8','40000000-0000-4000-8000-000000000005','51000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000013','21',4,'','10000000-0000-4000-8000-000000000007',45),
  ('8','40000000-0000-4000-8000-000000000005','51000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000013','19',3,'','10000000-0000-4000-8000-000000000007',45),
  ('9','40000000-0000-4000-8000-000000000005','51000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000017','09',5,'Dominio sobresaliente del análisis logístico.','10000000-0000-4000-8000-000000000007',45),
  ('9','40000000-0000-4000-8000-000000000005','51000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000017','02',4,'','10000000-0000-4000-8000-000000000007',45),
  ('9','40000000-0000-4000-8000-000000000005','51000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000017','19',4,'','10000000-0000-4000-8000-000000000007',45)
) as x(r, ch, asg, st, c, lvl, cm, ass, d)
on conflict do nothing;

-- Audit trail for every seeded decision (same shape the RPC writes).
insert into public.validation_decisions (request_id, item_type, item_id, decision, previous_value, new_value, comment, decided_by, decided_at)
select i.request_id, 'vath', v.id, v.status, jsonb_build_object('status', 'submitted', 'submitted_hours', v.submitted_hours),
  jsonb_build_object('status', v.status, 'verified_hours', v.verified_hours), v.validation_comment, v.validated_by, v.validated_at
from public.validation_request_items i join public.vath_entries v on v.id = i.item_id
where i.item_type = 'vath' and v.status in ('verified','adjusted','rejected')
  and not exists(select 1 from public.validation_decisions d where d.item_id = v.id);
insert into public.validation_decisions (request_id, item_type, item_id, decision, previous_value, new_value, comment, decided_by, decided_at)
select i.request_id, 'evidence', e.id, e.status, jsonb_build_object('status', 'submitted'), jsonb_build_object('status', e.status),
  e.review_comment, e.reviewed_by, e.reviewed_at
from public.validation_request_items i join public.evidence e on e.id = i.item_id
where i.item_type = 'evidence' and e.status in ('approved','rejected')
  and not exists(select 1 from public.validation_decisions d where d.item_id = e.id);

-- ---------------------------------------------------------------------------
-- Credentials for completed demo challenges (snapshot built by the same function the RPC uses)
-- ---------------------------------------------------------------------------
insert into public.credentials (id, code, student_id, challenge_id, assignment_id, organization_id, request_id, issued_by, issued_at, snapshot, is_demo)
select id::uuid, code, st::uuid, ch::uuid, asg::uuid, org::uuid, req::uuid, iss::uuid, now() - (d || ' days')::interval,
  public.sp_build_credential_snapshot(asg::uuid, iss::uuid), true
from (values
  ('80000000-0000-4000-8000-000000000001','SKP-2026-4A7C-91D2','10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000002',80),
  ('80000000-0000-4000-8000-000000000002','SKP-2026-B3E8-0F14','10000000-0000-4000-8000-000000000014','40000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000002',80),
  ('80000000-0000-4000-8000-000000000003','SKP-2026-77D1-C2A9','10000000-0000-4000-8000-000000000015','40000000-0000-4000-8000-000000000005','51000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000003','70000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000007',45),
  ('80000000-0000-4000-8000-000000000004','SKP-2026-E05B-3D68','10000000-0000-4000-8000-000000000013','40000000-0000-4000-8000-000000000005','51000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000003','70000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000007',45),
  ('80000000-0000-4000-8000-000000000005','SKP-2026-9C4F-A713','10000000-0000-4000-8000-000000000017','40000000-0000-4000-8000-000000000005','51000000-0000-4000-8000-000000000007','20000000-0000-4000-8000-000000000003','70000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000007',45)
) as x(id, code, st, ch, asg, org, req, iss, d)
on conflict (id) do nothing;

update public.validation_requests r set issued_credential_id = c.id
from public.credentials c where c.request_id = r.id and r.issued_credential_id is null;

insert into public.validation_decisions (request_id, item_type, item_id, decision, previous_value, new_value, comment, decided_by, decided_at)
select c.request_id, 'assignment', c.assignment_id, 'credential_issued', jsonb_build_object('status', 'active'),
  jsonb_build_object('status', 'completed', 'credential_code', c.code, 'verified_hours', c.snapshot->'verified_hours'), '', c.issued_by, c.issued_at
from public.credentials c where not exists(select 1 from public.validation_decisions d where d.item_id = c.assignment_id and d.decision = 'credential_issued');

-- ---------------------------------------------------------------------------
-- Notifications and activity history
-- ---------------------------------------------------------------------------
insert into public.notifications (user_id, kind, params, link, read_at, created_at) values
  ('10000000-0000-4000-8000-000000000001','challenge_assigned','{"challenge":"Commercial Process Automation"}','/workspace/40000000-0000-4000-8000-000000000001', now() - interval '47 days', now() - interval '48 days'),
  ('10000000-0000-4000-8000-000000000001','validation_completed','{"challenge":"Commercial Process Automation","outcome":"approved","hours":5}','/workspace/40000000-0000-4000-8000-000000000001?tab=validation', null, now() - interval '8 days'),
  ('10000000-0000-4000-8000-000000000002','validation_requested','{"student":"Diego Ramírez","challenge":"Commercial Process Automation","hours":8}','/validations/70000000-0000-4000-8000-000000000002', null, now() - interval '5 days'),
  ('10000000-0000-4000-8000-000000000003','application_received','{"student":"Andrés Castillo","challenge":"Energy Consumption Monitoring Prototype"}','/challenges/40000000-0000-4000-8000-000000000003?tab=candidates', null, now() - interval '3 days'),
  ('10000000-0000-4000-8000-000000000003','application_received','{"student":"Valeria Núñez","challenge":"Energy Consumption Monitoring Prototype"}','/challenges/40000000-0000-4000-8000-000000000003?tab=candidates', null, now() - interval '2 days'),
  ('10000000-0000-4000-8000-000000000007','validation_requested','{"student":"Sofía Herrera","challenge":"Export Digital Marketing Plan","hours":6}','/validations/70000000-0000-4000-8000-000000000004', null, now() - interval '4 days'),
  ('10000000-0000-4000-8000-000000000006','application_received','{"student":"Camila Ortiz","challenge":"Supplier Onboarding Analytics"}','/challenges/40000000-0000-4000-8000-000000000004?tab=candidates', now() - interval '1 days', now() - interval '4 days');

insert into public.audit_logs (actor_id, action, entity_type, entity_id, organization_id, challenge_id, subject_id, before, after, created_at) values
  ('10000000-0000-4000-8000-000000000003','challenge_created','challenge','40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',null,'{}','{"title":"Commercial Process Automation","status":"draft"}', now() - interval '70 days'),
  ('10000000-0000-4000-8000-000000000003','challenge_status_changed','challenge','40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',null,'{"status":"draft"}','{"status":"recruiting"}', now() - interval '60 days'),
  ('10000000-0000-4000-8000-000000000001','application_submitted','application','50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','{}','{"match_score":86}', now() - interval '55 days'),
  ('10000000-0000-4000-8000-000000000003','application_decided','application','50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','{"status":"submitted"}','{"status":"accepted","note":"Perfil alineado con el reto."}', now() - interval '48 days'),
  ('10000000-0000-4000-8000-000000000003','application_decided','application','50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000011','{"status":"submitted"}','{"status":"accepted","note":"Complementa al equipo con visión de procesos."}', now() - interval '48 days'),
  ('10000000-0000-4000-8000-000000000003','challenge_status_changed','challenge','40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',null,'{"status":"recruiting"}','{"status":"active"}', now() - interval '45 days'),
  ('10000000-0000-4000-8000-000000000002','task_created','task','52000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',null,'{}','{"title":"Entrevistar al equipo comercial y almacén","status":"todo"}', now() - interval '44 days'),
  ('10000000-0000-4000-8000-000000000001','evidence_added','evidence','60000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','{}','{"title":"Mapa del proceso comercial (as-is)","kind":"pdf"}', now() - interval '25 days'),
  ('10000000-0000-4000-8000-000000000001','validation_requested','validation_request','70000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','{}','{"vath_entries":2,"evidence":1,"hours":14}', now() - interval '24 days'),
  ('10000000-0000-4000-8000-000000000002','validation_completed','validation_request','70000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','{"status":"pending"}','{"outcome":"partially_approved","verified_hours":13}', now() - interval '20 days'),
  ('10000000-0000-4000-8000-000000000001','task_status_changed','task','52000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',null,'{"status":"in_progress"}','{"status":"done","title":"Diseñar el flujo automatizado (to-be)"}', now() - interval '10 days'),
  ('10000000-0000-4000-8000-000000000002','validation_completed','validation_request','70000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','{"status":"pending"}','{"outcome":"approved","verified_hours":5}', now() - interval '8 days'),
  ('10000000-0000-4000-8000-000000000011','validation_requested','validation_request','70000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000011','{}','{"vath_entries":2,"evidence":1,"hours":8}', now() - interval '5 days'),
  ('10000000-0000-4000-8000-000000000001','evidence_added','evidence','60000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','{}','{"title":"Prototipo del cotizador — repositorio","kind":"repository"}', now() - interval '3 days'),
  ('10000000-0000-4000-8000-000000000002','credential_issued','credential','80000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','{}','{"code":"SKP-2026-4A7C-91D2"}', now() - interval '80 days'),
  ('10000000-0000-4000-8000-000000000009','organization_created','organization','20000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000006',null,'10000000-0000-4000-8000-000000000009','{}','{"name":"Agroindustrias del Centro (DEMO)","kind":"company"}', now() - interval '2 days');

insert into public.incidents (reported_by, entity_type, entity_id, category, description, status, created_at) values
  ('10000000-0000-4000-8000-000000000014','profile',null,'incorrect_data','Mi semestre aparece desactualizado en un reporte institucional (incidente ficticio de demostración).','open', now() - interval '1 days');
