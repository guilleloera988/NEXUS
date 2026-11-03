# Base de datos

PostgreSQL (Supabase en producción; PGlite en la DEMO local y en pruebas; PostgreSQL 16 real en `npm run test:pg` y CI).

## Migraciones

| Archivo | Contenido |
|---|---|
| `20261002000001_core_schema.sql` | 24 tablas con *checks*, índices, `updated_at`, triggers de integridad y la vista `student_verified_competencies`. |
| `20261002000002_security_rls.sql` | Funciones auxiliares de autorización, RLS en todas las tablas, políticas `SELECT` y grants explícitos (sólo lectura para `anon`/`authenticated`). |
| `20261002000003_workflow_rpcs.sql` | RPCs de mutación (`SECURITY DEFINER`), helpers de validación, auditoría, notificaciones, Skills Match, snapshot de credenciales y trigger de alta de usuarios. |
| `20261002000004_read_rpcs.sql` | RPCs de lectura (`SECURITY INVOKER`, RLS decide), RPCs públicas acotadas y grants finales de funciones. |
| `20261002000005_storage.sql` | Bucket privado `evidence` y sus políticas (se omite automáticamente si no existe el esquema `storage`). |
| `20261007000001_rls_initplan.sql` | Reescribe 13 políticas `SELECT` para evaluar `auth.uid()`, `sp_is_admin()`, `sp_my_university_id()` y `sp_auth_email()` una vez por consulta (`(select …)` → *InitPlan*) en lugar de por fila. Mismas reglas de acceso. |
| `20261007000002_fk_indexes.sql` | 12 índices para llaves foráneas que sí se consultan o se recorren al borrar (evidencia, VATH, tareas, validaciones, credenciales, incidentes). Las otras 28 que señala el *advisor* son columnas de auditoría que nunca se filtran. |
| `20261007000003_invitation_hardening.sql` | Invitaciones (H-1): invitar exige organización verificada y sólo registra una invitación pendiente (respuesta única, `already_member`, nunca cambia roles); sólo un dueño o el admin quita a un dueño; al registrarse o iniciar sesión sólo aplican invitaciones de organizaciones verificadas y del tipo de cuenta elegido. |
| `20261007000004_match_score_scope.sql` | `sp_match_score` sólo para el propio estudiante, el admin o revisores del reto respecto de postulantes no retirados (H-2). |
| `20261007000005_confidential_credential_mask.sql` | Credenciales confidenciales: sin supervisor, fechas ni modalidad en la vista pública; el resumen público no cuenta sus validadores (H-3). |
| `20261007000006_activity_feed_visibility.sql` | `sp_activity_feed` filtra cada evento con la regla de la fila que describe (H-4). |
| `20261007000007_storage_public_sign_only.sql` | La lectura pública de Storage sólo aplica a la firma de URL; el bucket no se puede listar (H-5). |
| `20261008000001_talent_credentials_scope.sql` | Las empresas del talent pool ya no leen la fila cruda de credenciales: `credentials_select` admite al titular, a los revisores del reto, al admin y a la universidad; `sp_talent_profile` usa `sp_visible_credentials_json` (enmascarada) y `sp_talent` pasa a `SECURITY DEFINER` sin revelar retos confidenciales ajenos (H-6). |
| `20261015000001_feedback_required_fields.sql` | Campos obligatorios de la retroalimentación del 15 oct 2026 ([STATUS](STATUS.md#retroalimentación-del-15-oct-2026)): la evidencia nombra su tarea y, si el reto tiene entregables, su entregable (`sp_add_evidence`, `sp_update_evidence`); una empresa tiene sitio web https al crearse en el onboarding y cada vez que guarda su perfil (`sp_complete_onboarding`, `sp_update_organization`); un reto sólo pasa de borrador a Publicado o Convocatoria abierta si está completo (`sp_set_challenge_status`) y, fuera de borrador, no se puede editar a un estado incompleto (`sp_save_challenge`). Agrega el helper interno `sp_challenge_publish_missing`. Las filas ya guardadas no se revisan hasta que cambian. |
| `20261103000001_university_membership.sql` | Vinculación universitaria verificada ([STATUS](STATUS.md#piloto-con-universidades-nov-2026)): `profiles.university_id` guarda sólo la universidad **verificada**; la elección del estudiante queda como solicitud (`university_request_id`, `university_request_status`) hasta que su correo confirmado pertenece a un dominio de la universidad (`organizations.student_email_domains`) o el personal de la universidad la aprueba. RPCs `sp_university_requests`, `sp_decide_university_request` y `sp_set_university_domains`; helpers internos `sp_choose_university`, `sp_university_email_match`, `sp_student_email_domain_valid` y `sp_membership_university`. Los vínculos existentes que no son DEMO pasan a solicitud pendiente. |
| `20261103000002_mfa_privileged_actions.sql` | Doble factor para acciones privilegiadas: tabla `platform_settings` (sin acceso desde la API) con `mfa_required`, encendido en bases sin datos DEMO y apagado por el seed. Con él, `sp_is_admin()` exige una sesión `aal2` (Supabase Auth MFA/TOTP) y `sp_complete_validation` la exige a cualquier revisor (`sp:mfa_required`). Helpers internos `sp_current_aal`, `sp_mfa_required`, `sp_mfa_satisfied`, `sp_require_mfa`; RPC `sp_mfa_status` para la app. |

`supabase/demo-bootstrap.sql` emula lo mínimo de Supabase Auth (roles `anon`/`authenticated`, `auth.users`, `auth.uid()`) **sólo** para PGlite/pruebas. Nunca se ejecuta en Supabase.

## Modelo

```
organizations ─┬─ organization_members ── profiles (1:1 auth.users)
               ├─ invitations                 │  declared_skills ── competencies
               └─ challenges ─┬─ challenge_competencies ─┘
                              ├─ challenge_deliverables
                              ├─ applications (decisiones auditadas)
                              └─ assignments ─┬─ tasks
                                              ├─ evidence ── evidence_competencies
                                              ├─ vath_entries ── vath_entry_evidence
                                              ├─ validation_requests ─┬─ validation_request_items
                                              │                       └─ validation_decisions (append-only)
                                              ├─ competency_assessments (append-only, nivel 1–5)
                                              └─ credentials (snapshot inmutable, código SKP-AAAA-XXXX-XXXX)
notifications · audit_logs (append-only) · incidents
```

### Tablas principales

| Tabla | Propósito y reglas clave |
|---|---|
| `profiles` | Rol (`student`, `company`, `supervisor`, `university`, `admin`), datos de talento, privacidad (`skillpass_public`, `talent_pool_opt_in`), `slug` público, `is_demo`. |
| `organizations` | `kind` company/university/aindev, `verification_status` pending/verified/rejected (sólo admin cambia). Empresa ⇒ `website` https obligatorio al crearla y al guardar su perfil; en universidades es opcional. |
| `challenges` | Problema, objetivo, competencias, entregables, fechas, supervisor, `compensation_type`, `ip_policy`, `confidentiality`, `publication_policy`, estado con transiciones validadas. Sin compensación ⇒ ≤ 60 VATH estimadas. El borrador puede estar incompleto; para publicarlo debe estar completo (ver [Reglas para publicar un reto](#reglas-para-publicar-un-reto)). |
| `applications` / `assignments` | Aplicación con `match_score` y desglose; aceptar crea la asignación (respeta cupo). |
| `evidence` | Archivo (ruta en Storage, MIME, tamaño) o enlace https; tarea del reto obligatoria (`task_id`) y entregable obligatorio (`deliverable_id`) cuando el reto tiene entregables, ambos exigidos por las RPCs; versiones (`previous_id`), estado draft→submitted→approved/reviewed/rejected; aprobada = inmutable; `is_public` sólo si el reto lo permite. |
| `vath_entries` | `submitted_hours` (0.25–16) y `verified_hours` separadas; sin fechas futuras; evidencia obligatoria; decididas = inmutables. |
| `validation_requests` / `validation_decisions` | Paquete enviado al supervisor y cada decisión con comentario obligatorio al ajustar/rechazar/solicitar cambios. |
| `competency_assessments` | Nivel 1–5 por competencia, autor y fecha. **Verificada ⇔ nivel ≥ 3** registrado por un supervisor autorizado. |
| `credentials` | Snapshot (estudiante, reto, organización, periodo, VATH verificadas, competencias, supervisor, política de publicación), `verification_enabled` por credencial, revocación sólo admin con motivo. |
| `audit_logs` | Antes/después de cada acción relevante; sólo inserción. |

## Triggers de integridad

| Trigger | Garantía |
|---|---|
| `sp_append_only` | `validation_decisions`, `competency_assessments` y `audit_logs` no admiten UPDATE/DELETE. |
| `sp_guard_vath` | Registros enviados no cambian horas/fecha/actividad; decididos no cambian estado ni horas verificadas. |
| `sp_guard_evidence` | Evidencia aprobada no se modifica ni se borra. |
| `sp_guard_credential` | Snapshot, linaje y código inmutables; sólo se permite revocar o alternar la verificación pública. |
| `sp_on_auth_user_created` | Crea el perfil desde `auth.users`. Sólo `student`/`company`/`university` por metadatos; supervisor sólo por invitación de una organización verificada cuyo tipo coincide con la cuenta elegida (una cuenta de estudiante nunca se convierte en personal); admin nunca. |

## Row Level Security

- RLS **habilitado en las 24 tablas** (verificado por prueba). Ninguna tabla otorga `INSERT/UPDATE/DELETE` a `anon` ni `authenticated`, incluso si el proyecto tiene *default privileges* estilo Supabase (también verificado).
- Funciones auxiliares (`SECURITY DEFINER`, `search_path` fijo): `sp_current_role`, `sp_is_admin`, `sp_my_university_id`, `sp_is_org_member`, `sp_is_org_manager`, `sp_can_manage_challenge`, `sp_can_review_challenge`, `sp_is_participant`, `sp_can_view_challenge`, `sp_is_university_staff_for`, `sp_shares_challenge_with`, `sp_company_sees_student`, `sp_in_talent_pool`, `sp_can_view_profile`.

Resumen de visibilidad:

| Dato | Estudiante | Compañero de reto | Empresa / supervisor del reto | Universidad | Admin | Anónimo |
|---|---|---|---|---|---|---|
| Su perfil | ✔ | básico | si aplicó/participa o está en el talent pool | sus estudiantes (básico) | ✔ | sólo SkillPass público opt-in |
| Retos | publicados + propios | ✔ | los de su organización (incl. borradores) | publicados | ✔ | — |
| Evidencia | propia (incl. borradores) | no borradores del equipo | no borradores de su reto | **nunca** | ✔ | sólo publicada en credencial vigente |
| VATH | propias | **nunca** | de su reto | **nunca** (sólo agregados) | ✔ | — |
| Credenciales | propias | — | de su reto (talent pool: sólo vista enmascarada) | de sus estudiantes | ✔ | snapshot si `verification_enabled` |
| Auditoría | entradas donde es actor o sujeto | — | historial de sus retos/organización | — | ✔ | — |

## RPCs

Todas reciben un único `p jsonb` y devuelven `jsonb`.

**Lectura** (`SECURITY INVOKER`): `sp_me`, `sp_lookups`, `sp_org_overview`, `sp_student_dashboard`, `sp_challenges`, `sp_challenge`, `sp_workspace`, `sp_validation_queue`, `sp_validation`, `sp_skillpass_me`, `sp_talent_profile`, `sp_company_dashboard`, `sp_university_dashboard`, `sp_admin_overview`, `sp_admin_list`, `sp_notifications`, `sp_evidence_file`.

**Lectura acotada** (`SECURITY DEFINER`, se autoriza sola): `sp_talent` (admin o empresa verificada; sólo estudiantes del talent pool) y `sp_activity_feed`.

**Escritura** (`SECURITY DEFINER`, autorización explícita + auditoría): `sp_accept_invitations`, `sp_complete_onboarding`, `sp_update_profile`, `sp_update_privacy`, `sp_update_organization`, `sp_invite_member`, `sp_revoke_invitation`, `sp_remove_member`, `sp_save_challenge`, `sp_set_challenge_status`, `sp_apply`, `sp_withdraw_application`, `sp_decide_application`, `sp_end_assignment`, `sp_invite_to_challenge`, `sp_save_task`, `sp_set_task_status`, `sp_delete_task`, `sp_add_evidence`, `sp_update_evidence`, `sp_delete_evidence`, `sp_set_evidence_visibility`, `sp_save_vath`, `sp_delete_vath`, `sp_submit_for_validation`, `sp_complete_validation`, `sp_set_credential_verification`, `sp_revoke_credential`, `sp_admin_set_org_status`, `sp_admin_set_user_role`, `sp_admin_set_member`, `sp_admin_save_competency`, `sp_report_incident`, `sp_admin_update_incident`, `sp_mark_notifications_read`.

**Públicas** (`anon`): `sp_public_skillpass`, `sp_public_credential`, `sp_public_evidence_file`, `sp_is_public_evidence_object` (usada por la política de Storage). Devuelven sólo datos opt-in y acotados; en credenciales confidenciales se ocultan reto, organización, supervisor (nombre y cargo), modalidad y fechas exactas, y el resumen del SkillPass público no cuenta sus validadores.

Al final de la migración 4 se revoca `EXECUTE` de **todas** las funciones `sp_%` y se vuelve a otorgar sólo la lista anterior (prueba: `anon` sólo puede ejecutar las 4 públicas). Las migraciones posteriores que reemplazan una función (`create or replace`) conservan sus dueños y grants; las que crean una función nueva fijan sus permisos en la misma migración (`sp_visible_credentials_json` sólo para `authenticated`; `sp_challenge_publish_missing` para ningún rol de la API).

### Reglas para publicar un reto

Un borrador se guarda incompleto: bastan nombre, problema y objetivo (los demás campos obligatorios del formulario traen un valor por defecto). Para pasar de `draft` a `published` o `recruiting`, `sp_set_challenge_status` exige la organización verificada (`sp:organization_not_verified`); para abrir el reto (de `draft` a `published`, o a `recruiting` desde cualquier estado, incluidos `published` y `active`) exige además que esté completo (migración `20261015000001`):

| # | Requisito | Clave en `DETAIL` |
|---|---|---|
| 1 | Resumen | `summary` |
| 2 | Descripción | `description` |
| 3 | Industria | `industry` |
| 4 | Ubicación (no se pide si la modalidad es remota) | `location` |
| 5 | Condiciones de participación | `conditions` |
| 6 | Al menos una competencia | `competencies` |
| 7 | Al menos un entregable | `deliverables` |
| 8 | Supervisor | `supervisor_id` |
| 9 | Fechas de inicio y de fin | `start_date` |

Si falta algo lanza `sp:challenge_incomplete` con el primer faltante en `DETAIL` (la UI muestra «Al reto le falta: resumen (necesario para publicarlo o mantenerlo publicado).»). Un texto con sólo espacios en blanco cuenta como vacío: espacios, tabuladores y saltos de línea, y también los blancos Unicode (`\s` de JavaScript más U+0085 y U+200B), con el mismo conjunto en SQL y en `src/lib/challenge-readiness.ts`, sin depender del *locale* de la base. Cerrar la convocatoria o iniciar el reto nunca se bloquea. `sp_save_challenge` lanza el mismo error cuando un reto que ya no es borrador (publicado, en convocatoria, en curso o en revisión; completados y archivados no se editan) quedaría incompleto tras la edición.

`sp_challenge_publish_missing(challenge)` devuelve los faltantes (`text[]`) en ese orden fijo. Es interna: `SECURITY DEFINER` sin `EXECUTE` para `public`, `anon` ni `authenticated` (probado) y fuera de la lista blanca del servidor. `src/lib/challenge-readiness.ts` (`missingForPublish`) replica la lista para el formulario del reto y el panel «Ciclo de vida»; las pruebas comprueban que ambas den los mismos faltantes y en el mismo orden.

### Campos obligatorios de evidencia y organizaciones

- `sp_add_evidence` y `sp_update_evidence`: `task_id` siempre obligatorio y `deliverable_id` obligatorio cuando el reto tiene al menos un entregable (`sp:field_required`, `DETAIL` `task_id` / `deliverable_id`); ambos deben ser del mismo reto (`sp:invalid_field`). `linkEvidenceSchema` y `fileEvidenceSchema` (zod) exigen también `task_id` antes de llamar a la RPC.
- `sp_complete_onboarding` (al crear la organización de una cuenta de empresa) y `sp_update_organization` (organizaciones `company`): `website` obligatorio (`sp:field_required`, `DETAIL` `website`). Un sitio escrito debe empezar con `https://` (`sp:invalid_field`); las universidades pueden dejarlo vacío. La acción `completeOnboarding` lo revisa antes de llamar a la RPC.

### Vinculación universitaria verificada

Todo lo que ya lee `profiles.university_id` (analítica de la universidad, `sp_is_university_staff_for`, páginas públicas, talent pool, CSV) sigue igual y ahora significa «universidad verificada». La elección pasa por `sp_apply_student_profile` → `sp_choose_university`:

- Sin universidad: se borran el vínculo y la solicitud.
- La misma universidad verificada: se mantiene (y se retira una solicitud a otra).
- Correo confirmado (`auth.users.email_confirmed_at`) del dominio o de un subdominio de la universidad: vínculo inmediato (`university_verified_via = 'email_domain'`).
- Cualquier otro caso: solicitud `pending`, sin vínculo; se avisa a los miembros de la universidad. Volver a guardar la misma elección no la reabre ni repite el aviso, y una rechazada sigue rechazada.

`sp_decide_university_request` (cualquier miembro de la universidad verificada, o el admin) aprueba (`university` o `admin`), rechaza o retira a un estudiante vinculado, con notificación y bitácora; si la solicitud ya cambió, `sp:membership_request_closed`. `sp_set_university_domains` (dueño o manager de la universidad, o el admin) guarda hasta 10 dominios en minúsculas, rechaza proveedores públicos (gmail.com, outlook.com, …) y vincula al momento las solicitudes pendientes cuyo correo confirmado ya coincide. `sp_university_requests` muestra al personal nombre, correo, carrera, semestre y fecha de cada solicitud pendiente.

### Errores

Las RPCs lanzan `sp:<clave>` con el campo en `DETAIL` (p. ej. `sp:fair_work_unpaid_limit`, `sp:organization_not_verified`, `sp:invalid_transition`, `sp:field_required` con `task_id`, `sp:challenge_incomplete` con el primer faltante). El servidor los mapea a `errors.<clave>` del diccionario; una prueba verifica que cada clave lanzada en SQL tenga traducción en ambos idiomas.

## Skills Match (reglas, sin IA)

`sp_match_score(student, challenge)` → 0–100 con desglose. Sólo responde al propio estudiante (en retos que puede ver), al admin y a los revisores del reto respecto de estudiantes que aplicaron y no se retiraron; en otro caso devuelve `null`:

- Competencias (60): por cada competencia requerida, 100 % si está verificada, 60 % si sólo está declarada.
- Intereses (15): intersección entre intereses del estudiante y áreas del reto.
- Carrera (10): coincidencia con carreras sugeridas (o reto abierto a todas).
- Disponibilidad (15): horas semanales estimadas vs disponibilidad declarada.

## Seed DEMO

`supabase/seed.sql` (idempotente, fechas relativas a `current_date`): 60 competencias, 5 organizaciones ficticias + AINDEV (las 3 empresas con sitio web `https://….example`), 16 personas ficticias, 8 retos en todos los estados (el borrador «Lean Kaizen Documentation Sprint» aún no cumple los requisitos para publicar), aplicaciones, asignaciones, tareas, 11 evidencias (3 con archivo en `supabase/seed/files`), 18 registros VATH, validaciones, evaluaciones y 5 credenciales (p. ej. `SKP-2026-4A7C-91D2`). Todo con `is_demo = true` y nombres con «(DEMO)» o dominios `.invalid`.

## Pruebas de base de datos

`tests/database.test.ts` (52) y `tests/storage.test.ts` (8) cubren: RLS/grants, roles e invitaciones, regresiones H-1…H-6 de la revisión de seguridad, campos obligatorios de la retroalimentación del 15 oct (evidencia con tarea y entregable, sitio web de empresa, reto completo para publicar, y que `src/lib/challenge-readiness.ts` coincide con la base), FLOW 01–08 y 10, revocación, aislamiento entre organizaciones/compañeros/universidad, Talent pool, admin, inmutabilidad y políticas de Storage. Corren en PGlite (`npm test`) y en PostgreSQL 16 real (`npm run test:pg`).
