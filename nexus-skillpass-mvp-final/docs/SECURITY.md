# Seguridad y privacidad

Modelo de amenazas, controles implementados, resultados de la revisión y riesgos residuales.

## 1. Activos y actores

| Activo | Riesgo principal |
|---|---|
| Credenciales SkillPass (VATH, competencias) | Falsificación, alteración posterior, verificación de credenciales revocadas. |
| Evidencia (archivos, enlaces) | Fuga de información confidencial de empresas; archivos maliciosos. |
| Datos personales de estudiantes | Exposición a terceros sin consentimiento; perfilamiento. |
| Roles y organizaciones | Escalamiento de privilegios (convertirse en supervisor/admin, publicar sin verificación). |
| Secretos (service-role, DB URL, firma DEMO) | Exposición en el cliente o en git. |

Actores: visitante anónimo, estudiante, compañero de equipo, empresa/supervisor de otra organización, personal universitario, admin AINDEV, atacante con una cuenta válida.

## 2. Controles

### 2.1 Base de datos (fuente de verdad)

- **RLS en las 24 tablas** y grants de sólo `SELECT` a `anon`/`authenticated`; incluso con *default privileges* de Supabase no hay `INSERT/UPDATE/DELETE` directos (probado).
- **Mutaciones sólo por RPC** `SECURITY DEFINER` con `search_path` fijo que validan: identidad (`sp_actor`), rol, pertenencia a la organización, supervisor asignado, estado del reto/asignación, límites y formato.
- **Roles**: el alta sólo acepta `student`, `company`, `university` desde metadatos; `supervisor` sólo por invitación de una organización verificada, registrándose como «Empresa» con el correo invitado; `admin` jamás desde la app. Las invitaciones no revelan si una cuenta existe, no cambian el rol de un miembro y sólo un dueño (o el admin) quita a otro dueño. Un usuario no puede cambiar su propio rol; el admin no puede degradarse ni modificar otro admin.
- **Integridad**: decisiones de validación, evaluaciones y bitácora de sólo inserción; VATH decididas y evidencia aprobada inmutables; snapshot y linaje de credenciales inmutables incluso para el dueño de la base (probado).
- **Verificación humana**: una competencia sólo es «verificada» con una evaluación ≥ 3 de un supervisor autorizado; ninguna automatización puede marcarla.
- **Funciones**: se revoca `EXECUTE` de todas las `sp_%` y se reotorga sólo la lista blanca; `anon` sólo ejecuta 4 funciones públicas (probado).
- **Público acotado**: las RPCs anónimas sólo devuelven datos opt-in (SkillPass público, credenciales con verificación habilitada, evidencia marcada pública en retos que lo permiten) y enmascaran proyectos confidenciales (reto, empresa, supervisor, modalidad y fechas exactas). Los archivos públicos sólo se pueden firmar por ruta exacta; el bucket no se puede listar.

### 2.2 Aplicación

- Lista blanca de RPCs en el servidor; ninguna ruta acepta nombres de función del cliente.
- zod en cada Server Action (forma, tamaño, enums, URLs https sin credenciales embebidas).
- Redirecciones post-login/demo con `safeNextPath` (bloquea `//host`, `/\host`, caracteres de control, esquemas); redirecciones relativas.
- Subidas: lista blanca MIME (sin SVG/HTML), *magic numbers*, tamaño máximo (`MAX_UPLOAD_MB`), nombres saneados, rollback del archivo si falla el registro.
- Descargas: consulta con RLS antes de servir; URL firmada de 60 s (Supabase) o archivo DEMO con protección de *path traversal*; *inline* sólo PDF e imágenes, `Content-Security-Policy: sandbox`, `nosniff`, `Content-Disposition` seguro.
- Exportación CSV con neutralización de fórmulas (`=`, `+`, `-`, `@`, tab).
- Errores: mensajes traducidos por clave; nunca se expone el texto de PostgreSQL ni trazas.
- *Rate limiting* básico por IP en login, registro, demo y acciones sensibles.

### 2.3 Sesiones

- Supabase Auth con cookies gestionadas por `@supabase/ssr`; `proxy.ts` refresca la sesión y protege rutas privadas (la autorización real se repite en servidor y base de datos).
- DEMO local: cookie `sp_demo` HttpOnly, `SameSite=Lax`, `Secure` detrás de HTTPS, firmada con HMAC-SHA256 y comparación en tiempo constante; expira con el TTL del escenario.
- Server Actions de Next.js validan `Origin` contra `Host` (CSRF).

### 2.4 Cabeceras HTTP

`Content-Security-Policy` (sin scripts de terceros; `frame-ancestors 'none'`; `object-src 'none'`; `form-action 'self'`), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restrictiva, sin `X-Powered-By`. Rutas privadas con `Cache-Control: private, no-store` y `X-Robots-Tag: noindex`.

### 2.5 Secretos

- La app sólo usa la llave **pública** de Supabase. La service-role key y la URL de base de datos se usan exclusivamente en la máquina del operador (`npm run seed -- --supabase`) y nunca se configuran en Vercel.
- `.env*` ignorado por git (excepto `.env.example` sin valores). No hay llaves reales en el repositorio.
- `/api/health` no expone configuración sensible (probado).

## 3. Privacidad

- **Minimización**: no se piden atributos sensibles (edad, género, etnia, etc.). El explorador de talento no rankea con criterios opacos (orden alfabético por defecto, filtros por evidencia).
- **Consentimiento**: SkillPass público y aparición en el talent pool son opt-in; la verificación pública puede desactivarse por credencial.
- **Separación**: la universidad sólo ve agregados y datos básicos de sus estudiantes; nunca evidencia ni registros VATH individuales. Compañeros de reto no ven las horas de otros.
- **Confidencialidad de empresas**: `publication_policy` (`public_allowed`, `summary_only`, `confidential`) controla qué aparece públicamente; proyectos confidenciales se muestran como «Proyecto confidencial», con validador «Responsable de la empresa (confidencial)» y sin empresa, fechas ni modalidad.
- **Propiedad intelectual**: cada reto declara `ip_policy` y detalles; nada se asume propiedad de AINDEV.
- **Datos DEMO**: ficticios, con dominios `.invalid` y marcados en UI, base de datos (`is_demo`) y páginas públicas.

## 4. Resultados de la revisión (esta entrega)

| Verificación | Resultado |
|---|---|
| RLS habilitado en todas las tablas; sin escrituras directas | ✔ prueba automatizada (PGlite y PostgreSQL 16) |
| `anon` sin lectura de tablas ni RPCs privadas | ✔ |
| Escalamiento de rol por metadatos o por `sp_update_profile` | ✔ bloqueado |
| Revisores de otra empresa no leen datos de Nova | ✔ |
| Compañeros no ven horas ni solicitudes de validación ajenas (UI → «Página no encontrada»), ni borradores o resultados ajenos en la actividad del workspace | ✔ BD + E2E (actividad: H-4) |
| Universidad no lee evidencia ni VATH; descarga de archivo → 404 | ✔ BD + E2E |
| Credencial revocada: sólo admin, definitiva, fuera de totales públicos | ✔ |
| Políticas de Storage (carpeta propia, reto activo, público sólo con credencial vigente y sólo firma por ruta exacta, sin listado) | ✔ prueba con esquema Storage simulado (13 operaciones) + E2E de descarga pública contra Supabase (H-5) |
| Invitaciones: sólo organizaciones verificadas, sin enumeración de cuentas, sin cambio de rol de miembros, un estudiante nunca se convierte en personal | ✔ BD (H-1) |
| Skills Match sólo para postulantes del reto del revisor, el propio estudiante o el admin | ✔ BD (H-2) |
| Credenciales confidenciales sin empresa, reto, supervisor, modalidad ni fechas en la verificación pública | ✔ BD (H-3) |
| *Open redirect* en login/demo/callback | ✔ unit + E2E |
| Inyección CSV, *sniffing* de archivos, nombres con rutas | ✔ unit |
| Cabeceras de seguridad | ✔ E2E |

Hallazgos corregidos durante la revisión:

1. **Storage**: la política de lectura exigía una fila de evidencia; en Supabase el estudiante no habría podido leer/eliminar su archivo recién subido (rollback fallido). Se añadió la condición «carpeta propia».
2. **Esquemas zod**: campos opcionales fallaban cuando la clave no venía en el payload (zod 4). Corregido con `.optional()` antes de `.transform()`.
3. **Redirecciones** construidas con `request.url` podían cambiar de host (perdiendo la cookie de sesión); ahora son relativas.
4. **Guardas de redirección** duplicadas e incompletas (no bloqueaban tabs/saltos de línea); consolidadas en `safeNextPath`.

## 5. Riesgos residuales y recomendaciones

| Riesgo | Mitigación recomendada |
|---|---|
| CSP con `'unsafe-inline'` para scripts (sin nonces) | Implementar CSP con nonce vía `proxy.ts` cuando se estabilice el despliegue. |
| *Rate limiting* en memoria (por instancia) | Usar un limitador compartido (Upstash/Redis o Supabase) en producción; activar CAPTCHA de Supabase Auth. |
| Sin escaneo antivirus de archivos | Integrar escaneo (p. ej. ClamAV o servicio gestionado) antes de mostrar archivos a revisores. |
| Políticas de contraseña/confirmación dependen de la configuración de Supabase Auth | Configurar longitud mínima ≥ 10, confirmación de email y protección de contraseñas filtradas. |
| Modo DEMO `supabase` comparte estado entre visitantes | Usar un proyecto Supabase exclusivo de demo y re-sembrar periódicamente; nunca en el proyecto productivo. |
| DEMO local: ~42 MB de disco por escenario | Ajustar `NEXUS_DEMO_MAX_SESSIONS` y `NEXUS_DEMO_TTL_HOURS` al disco disponible. |
| Pruebas contra Supabase en la nube sólo en el proyecto de demo | Repetir migraciones, checklist y E2E en un staging del proyecto productivo antes de abrirlo (la demo ya pasó FLOW 01–10, ver DEPLOYMENT §8). |
| Sin DPA/aviso de privacidad legal | Requiere decisión legal de AINDEV (LFPDPPP en México): aviso de privacidad, términos y acuerdos con empresas/universidades. |

## 6. Supabase Advisors y revisión de seguridad (7–8 oct 2026)

Revisión de los *advisors* del proyecto de demo, con cada aviso trazado al código y cada hallazgo **reproducido** con un script (PGlite con las migraciones y el seed reales; el de Storage, además, con peticiones anónimas de sólo lectura a la demo).

**Rendimiento.** `auth_rls_initplan` (11) quedó en 0 con `20261007000001_rls_initplan.sql`; `unindexed_foreign_keys` bajó de 40 a 28 con `20261007000002_fk_indexes.sql` (las 28 restantes son columnas de auditoría que nunca se filtran). Los `unused_index` (INFO) son esperables mientras la demo tenga poco tráfico.

**`SECURITY DEFINER` ejecutables por `anon`/`authenticated` (63 avisos).** Son el diseño: las tablas sólo se leen bajo RLS y toda escritura pasa por RPCs que autorizan al llamante. Clasificación tras las correcciones:

| Tipo | Funciones | Conclusión |
|---|---|---|
| RPC de mutación que se autoriza sola (`sp_actor`, rol, pertenencia, estado) | 34 | ✔ (`sp_invite_member` corregido, H-1) |
| Helpers de RLS (sólo responden sobre las relaciones del propio llamante) | 15 | ✔ deben ser ejecutables porque las políticas se evalúan como el llamante |
| Lecturas acotadas al llamante | 3 (+2 con H-6) | ✔ (`sp_activity_feed` corregido, H-4; `sp_talent` y `sp_visible_credentials_json` nuevas, H-6) |
| Superficie pública por diseño (verificación de credenciales y SkillPass) | 6 | ✔ (enmascaramiento confidencial H-3 y Storage H-5 corregidos) |
| Cálculo de compatibilidad | 1 | ✔ `sp_match_score` acotado (H-2) |

Protección de contraseñas filtradas (HaveIBeenPwned): requiere plan Pro de Supabase.

**Hallazgos corregidos.** Existían desde la versión inicial. Cada uno se reprodujo con un script antes de corregirlo; cada corrección es una migración nueva con pruebas de regresión que fallan sin ella. Una segunda revisión adversarial volvió a correr los *exploits* contra las correcciones (todos cerrados), las atacó y lo que encontró se corrigió en las mismas migraciones. Las seis están aplicadas en producción (H-6 el 8 oct, en una transacción con verificación previa y posterior: 14 comprobaciones de política, dueños y permisos, todas correctas; *Security Advisor* sin errores). En la demo están H-1…H-5; H-6 no se pudo aplicar ahí porque el proyecto de demo ya no acepta cambios desde el entorno de despliegue.

| ID | Severidad | Hallazgo | Corrección |
|---|---|---|---|
| H-1 | Media | `sp_invite_member`: un *manager* podía degradar al dueño «invitándolo» con otro rol y luego quitarlo (organización sin dueño); las respuestas permitían enumerar cuentas y su tipo; cuentas existentes se agregaban sin consentimiento; una invitación previa convertía a un futuro estudiante en personal de la organización al registrarse. | `20261007000003_invitation_hardening.sql`: invitar exige organización verificada y sólo registra una invitación pendiente (respuesta única `invited`; `already_member` para miembros actuales; nunca cambia roles). Sólo un dueño o el admin quita a un dueño (con bloqueo de la organización) y al quitar a alguien se revocan las invitaciones que creó. Al registrarse, la invitación sólo aplica si la organización está verificada y el tipo de cuenta coincide; al iniciar sesión se acepta la más reciente sólo si la persona no pertenece a otra organización de ese tipo. |
| H-2 | Media | `sp_match_score`: cualquier revisor de cualquier reto (incluso una empresa sin verificar con un borrador) podía consultar de cualquier estudiante competencias verificadas/declaradas, carrera oculta, intereses y disponibilidad. | `20261007000004_match_score_scope.sql`: sólo el propio estudiante (en retos que puede ver), el admin o los revisores del reto respecto de estudiantes que aplicaron y no se retiraron. |
| H-3 | Media | Credenciales confidenciales: la verificación pública publicaba nombre y cargo del supervisor (que nombran la empresa), y fechas exactas y modalidad que, con la industria, identificaban el reto en la lista pública. | `20261007000005_confidential_credential_mask.sql`: esos campos son `null` en credenciales confidenciales (se enmascara al leer; el *snapshot* es inmutable) y el resumen del SkillPass público no cuenta sus validadores. La UI muestra «Responsable de la empresa (confidencial)». |
| H-4 | Baja | `sp_activity_feed`: compañeros y revisores veían títulos de evidencia en borrador de un compañero y podían inferir el resultado de su validación. | `20261007000006_activity_feed_visibility.sql`: cada evento se filtra con la misma regla que la fila que describe; el contexto del llamante se evalúa una vez por consulta. |
| H-5 | Baja | La política pública de Storage también aplicaba al listado del bucket: con la llave pública se podían enumerar y descargar archivos de evidencia pública sin el código de la credencial. | `20261007000007_storage_public_sign_only.sql`: la política sólo aplica a la firma de URL (`storage.object.sign` / `sign_many`). Comprobado en vivo: el listado anónimo devuelve `[]` y la descarga pública por la app sigue funcionando. Requiere un storage-api que fije `storage.operation` (Supabase alojado lo hace). |
| H-6 | Media | La rama «talent pool» de la política `credentials_select` permitía a cualquier miembro de una empresa verificada leer la fila completa de credenciales de un estudiante del talent pool, incluido el *snapshot* con empresa, reto y supervisor de credenciales confidenciales; el filtro por reto de `sp_talent` revelaba quién completó un reto confidencial de otra empresa. | `20261008000001_talent_credentials_scope.sql`: la política ya no tiene rama de talent pool (leen la fila su titular, los revisores del reto —dueño, managers y supervisor—, el admin y la universidad del estudiante); `sp_talent_profile` recibe las credenciales ya enmascaradas de `sp_visible_credentials_json`; `sp_talent` pasa a `SECURITY DEFINER` (ya sólo atendía al admin y a empresas verificadas, y sólo lista estudiantes del talent pool), muestra sólo universidades verificadas (el admin también las pendientes) y su filtro por reto ignora credenciales confidenciales salvo para los revisores de ese reto. Efecto colateral buscado: el supervisor que emitió una credencial la ve en validaciones y en su panel aunque el estudiante no esté en el talent pool (antes dependía de esa rama). |

**Riesgos residuales** (documentados, no corregidos en esta entrega):

| ID | Severidad | Riesgo | Recomendación |
|---|---|---|---|
| R-1 | Baja | No hay botón «Aceptar»: una invitación de una organización verificada se aplica sola al registrarse o al iniciar sesión, si la cuenta es del tipo correcto y no pertenece a otra organización de ese tipo. Las invitaciones a correos que nunca podrán unirse quedan «pendientes». | Aceptación explícita con aviso; permitir que un miembro salga por sí mismo. |
| R-2 | Baja | Dueños y managers ya no pueden cambiar el rol de un miembro (antes se hacía, de forma insegura, re-invitándolo); sólo el admin (`sp_admin_set_member`). | RPC `sp_set_member_role` con reglas de dueño. |
| R-3 | Baja | Un revisor puede editar las competencias de un reto con postulantes y recalcular la compatibilidad, como oráculo sobre las competencias verificadas del postulante. | Congelar competencias cuando hay postulaciones o mostrar el desglose guardado al aplicar. |
| R-4 | Baja | Compañeros de reto ven el estado de revisión y los comentarios de la evidencia ya enviada de un compañero (`sp_workspace`), de lo que pueden inferir su resultado (la actividad ya no lo expone). | Decidir la política; si no deben verlo, ocultar estado y comentario a quien no es dueño ni revisor. |
| R-5 | Baja | La política de publicación se lee del *snapshot*: si la empresa cambia un reto abierto a confidencial después de emitir credenciales, éstas siguen públicas. | Aplicar la más estricta entre *snapshot* y reto, o bloquear el cambio cuando ya hay credenciales. |
| R-6 | Baja | Un reto confidencial sigue en el catálogo de usuarios autenticados mientras está publicado, en curso o completado (título, empresa, fechas, competencias), y la vista enmascarada de la credencial conserva industria, horas, competencias y fecha de emisión. Cruzar ambos podría sugerir de qué reto viene una credencial confidencial; no se demostró. Los agregados del talent pool también cuentan credenciales con verificación pública desactivada. | Decidir si los retos confidenciales salen del catálogo al cerrar la convocatoria y si los agregados deben excluir credenciales ocultas. |
