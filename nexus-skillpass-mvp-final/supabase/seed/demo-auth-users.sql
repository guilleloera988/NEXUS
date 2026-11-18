-- LOCAL DEMO / TESTS ONLY (PGlite). Creates the fictional demo accounts in the emulated
-- auth.users table; the sp_on_auth_user_created trigger then creates their profiles.
-- On Supabase these accounts are created through the Admin API by `npm run seed -- --supabase`.
insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-4000-8000-000000000001', 'maria.torres@demo.skillpass.invalid',  '{"full_name":"María Torres","account_type":"student"}'),
  ('10000000-0000-4000-8000-000000000002', 'carlos.mendez@demo.skillpass.invalid', '{"full_name":"Carlos Méndez","account_type":"company"}'),
  ('10000000-0000-4000-8000-000000000003', 'laura.rios@demo.skillpass.invalid',    '{"full_name":"Laura Ríos","account_type":"company"}'),
  ('10000000-0000-4000-8000-000000000004', 'elena.vazquez@demo.skillpass.invalid', '{"full_name":"Dra. Elena Vázquez","account_type":"university"}'),
  ('10000000-0000-4000-8000-000000000005', 'admin@demo.skillpass.invalid',         '{"full_name":"Equipo AINDEV (DEMO)","account_type":"student"}'),
  ('10000000-0000-4000-8000-000000000006', 'mariana.solis@demo.skillpass.invalid', '{"full_name":"Mariana Solís","account_type":"company"}'),
  ('10000000-0000-4000-8000-000000000007', 'hector.aguilar@demo.skillpass.invalid','{"full_name":"Héctor Aguilar","account_type":"company"}'),
  ('10000000-0000-4000-8000-000000000008', 'luis.cardenas@demo.skillpass.invalid', '{"full_name":"Mtro. Luis Cárdenas","account_type":"university"}'),
  ('10000000-0000-4000-8000-000000000009', 'ruben.ibarra@demo.skillpass.invalid',  '{"full_name":"Rubén Ibarra","account_type":"company"}'),
  ('10000000-0000-4000-8000-000000000011', 'diego.ramirez@demo.skillpass.invalid', '{"full_name":"Diego Ramírez","account_type":"student"}'),
  ('10000000-0000-4000-8000-000000000012', 'sofia.herrera@demo.skillpass.invalid', '{"full_name":"Sofía Herrera","account_type":"student"}'),
  ('10000000-0000-4000-8000-000000000013', 'andres.castillo@demo.skillpass.invalid','{"full_name":"Andrés Castillo","account_type":"student"}'),
  ('10000000-0000-4000-8000-000000000014', 'valeria.nunez@demo.skillpass.invalid', '{"full_name":"Valeria Núñez","account_type":"student"}'),
  ('10000000-0000-4000-8000-000000000015', 'jorge.lozano@demo.skillpass.invalid',  '{"full_name":"Jorge Lozano","account_type":"student"}'),
  ('10000000-0000-4000-8000-000000000016', 'camila.ortiz@demo.skillpass.invalid',  '{"full_name":"Camila Ortiz","account_type":"student"}'),
  ('10000000-0000-4000-8000-000000000017', 'ricardo.pena@demo.skillpass.invalid',  '{"full_name":"Ricardo Peña","account_type":"student"}');
