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
| `organizations` | `kind` company/university/aindev, `verification_status` pending/verified/rejected (sólo admin cambia). |
| `challenges` | Problema, objetivo, competencias, entregables, fechas, supervisor, `compensation_type`, `ip_policy`, `confidentiality`, `publication_policy`, estado con transiciones validadas. Sin compensación ⇒ ≤ 60 VATH estimadas. |
| `applications` / `assignments` | Aplicación con `match_score` y desglose; aceptar crea la asignación (respeta cupo). |
| `evidence` | Archivo (ruta en Storage, MIME, tamaño) o enlace https; versiones (`previous_id`), estado draft→submitted→approved/reviewed/rejected; aprobada = inmutable; `is_public` sólo si el reto lo permite. |
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
| `sp_on_auth_user_created` | Crea el perfil desde `auth.users`. Sólo `student`/`company`/`university` por metadatos; supervisor sólo por invitación; admin nunca. |

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
| Credenciales | propias | — | de su reto | de sus estudiantes | ✔ | snapshot si `verification_enabled` |
| Auditoría | entradas donde es actor o sujeto | — | historial de sus retos/organización | — | ✔ | — |

## RPCs

Todas reciben un único `p jsonb` y devuelven `jsonb`.

**Lectura** (`SECURITY INVOKER`): `sp_me`, `sp_lookups`, `sp_org_overview`, `sp_student_dashboard`, `sp_challenges`, `sp_challenge`, `sp_workspace`, `sp_validation_queue`, `sp_validation`, `sp_skillpass_me`, `sp_talent_profile`, `sp_talent`, `sp_company_dashboard`, `sp_university_dashboard`, `sp_admin_overview`, `sp_admin_list`, `sp_notifications`, `sp_evidence_file`.

**Escritura** (`SECURITY DEFINER`, autorización explícita + auditoría): `sp_accept_invitations`, `sp_complete_onboarding`, `sp_update_profile`, `sp_update_privacy`, `sp_update_organization`, `sp_invite_member`, `sp_revoke_invitation`, `sp_remove_member`, `sp_save_challenge`, `sp_set_challenge_status`, `sp_apply`, `sp_withdraw_application`, `sp_decide_application`, `sp_end_assignment`, `sp_invite_to_challenge`, `sp_save_task`, `sp_set_task_status`, `sp_delete_task`, `sp_add_evidence`, `sp_update_evidence`, `sp_delete_evidence`, `sp_set_evidence_visibility`, `sp_save_vath`, `sp_delete_vath`, `sp_submit_for_validation`, `sp_complete_validation`, `sp_set_credential_verification`, `sp_revoke_credential`, `sp_admin_set_org_status`, `sp_admin_set_user_role`, `sp_admin_set_member`, `sp_admin_save_competency`, `sp_report_incident`, `sp_admin_update_incident`, `sp_mark_notifications_read`.

**Públicas** (`anon`): `sp_public_skillpass`, `sp_public_credential`, `sp_public_evidence_file`, `sp_is_public_evidence_object` (usada por la política de Storage). Devuelven sólo datos opt-in y acotados; nombres de proyectos confidenciales se enmascaran.

Al final de la migración 4 se revoca `EXECUTE` de **todas** las funciones `sp_%` y se vuelve a otorgar sólo la lista anterior (prueba: `anon` sólo puede ejecutar las 4 públicas).

### Errores

Las RPCs lanzan `sp:<clave>` con el campo en `DETAIL` (p. ej. `sp:fair_work_unpaid_limit`, `sp:organization_not_verified`, `sp:invalid_transition`). El servidor los mapea a `errors.<clave>` del diccionario; una prueba verifica que cada clave lanzada en SQL tenga traducción en ambos idiomas.

## Skills Match (reglas, sin IA)

`sp_match_score(student, challenge)` → 0–100 con desglose:

- Competencias (60): por cada competencia requerida, 100 % si está verificada, 60 % si sólo está declarada.
- Intereses (15): intersección entre intereses del estudiante y áreas del reto.
- Carrera (10): coincidencia con carreras sugeridas (o reto abierto a todas).
- Disponibilidad (15): horas semanales estimadas vs disponibilidad declarada.

## Seed DEMO

`supabase/seed.sql` (idempotente, fechas relativas a `current_date`): 60 competencias, 5 organizaciones ficticias + AINDEV, 16 personas ficticias, 8 retos en todos los estados, aplicaciones, asignaciones, tareas, 11 evidencias (3 con archivo en `supabase/seed/files`), 18 registros VATH, validaciones, evaluaciones y 5 credenciales (p. ej. `SKP-2026-4A7C-91D2`). Todo con `is_demo = true` y nombres con «(DEMO)» o dominios `.invalid`.

## Pruebas de base de datos

`tests/database.test.ts` (33) y `tests/storage.test.ts` (6) cubren: RLS/grants, roles e invitaciones, FLOW 01–08 y 10, revocación, aislamiento entre organizaciones/compañeros/universidad, Talent pool, admin, inmutabilidad y políticas de Storage. Corren en PGlite (`npm test`) y en PostgreSQL 16 real (`npm run test:pg`).
