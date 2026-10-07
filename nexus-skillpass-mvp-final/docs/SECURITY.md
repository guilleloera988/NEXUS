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
- **Roles**: el alta sólo acepta `student`, `company`, `university` desde metadatos; `supervisor` sólo por invitación aceptada; `admin` jamás desde la app. Un usuario no puede cambiar su propio rol; el admin no puede degradarse ni modificar otro admin.
- **Integridad**: decisiones de validación, evaluaciones y bitácora de sólo inserción; VATH decididas y evidencia aprobada inmutables; snapshot y linaje de credenciales inmutables incluso para el dueño de la base (probado).
- **Verificación humana**: una competencia sólo es «verificada» con una evaluación ≥ 3 de un supervisor autorizado; ninguna automatización puede marcarla.
- **Funciones**: se revoca `EXECUTE` de todas las `sp_%` y se reotorga sólo la lista blanca; `anon` sólo ejecuta 4 funciones públicas (probado).
- **Público acotado**: las RPCs anónimas sólo devuelven datos opt-in (SkillPass público, credenciales con verificación habilitada, evidencia marcada pública en retos que lo permiten) y enmascaran proyectos confidenciales.

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
- **Confidencialidad de empresas**: `publication_policy` (`public_allowed`, `summary_only`, `confidential`) controla qué aparece públicamente; proyectos confidenciales se muestran como «Proyecto confidencial».
- **Propiedad intelectual**: cada reto declara `ip_policy` y detalles; nada se asume propiedad de AINDEV.
- **Datos DEMO**: ficticios, con dominios `.invalid` y marcados en UI, base de datos (`is_demo`) y páginas públicas.

## 4. Resultados de la revisión (esta entrega)

| Verificación | Resultado |
|---|---|
| RLS habilitado en todas las tablas; sin escrituras directas | ✔ prueba automatizada (PGlite y PostgreSQL 16) |
| `anon` sin lectura de tablas ni RPCs privadas | ✔ |
| Escalamiento de rol por metadatos o por `sp_update_profile` | ✔ bloqueado |
| Revisores de otra empresa no leen datos de Nova | ✔ |
| Compañeros no ven horas ajenas ni validaciones ajenas (UI → «Página no encontrada») | ✔ BD + E2E |
| Universidad no lee evidencia ni VATH; descarga de archivo → 404 | ✔ BD + E2E |
| Credencial revocada: sólo admin, definitiva, fuera de totales públicos | ✔ |
| Políticas de Storage (carpeta propia, reto activo, público sólo con credencial vigente) | ✔ prueba con esquema Storage simulado |
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

## 6. Supabase Advisors y hallazgos abiertos (7 oct 2026)

Revisión de los *advisors* del proyecto de demo, con cada aviso trazado al código y cada hallazgo **reproducido** con un script (PGlite con las migraciones y el seed reales; el de Storage, además, con peticiones anónimas de sólo lectura a la demo).

**Rendimiento.** `auth_rls_initplan` (11) quedó en 0 con `20261007000001_rls_initplan.sql`; `unindexed_foreign_keys` bajó de 40 a 28 con `20261007000002_fk_indexes.sql` (las 28 restantes son columnas de auditoría que nunca se filtran). Los 13 `unused_index` son esperables mientras la demo tenga poco tráfico.

**`SECURITY DEFINER` ejecutables por `anon`/`authenticated` (63 avisos).** Son el diseño: las tablas sólo se leen bajo RLS y toda escritura pasa por RPCs que autorizan al llamante. Clasificación:

| Tipo | Funciones | Conclusión |
|---|---|---|
| RPC de mutación que se autoriza sola (`sp_actor`, rol, pertenencia, estado) | 34 | ✔ salvo `sp_invite_member` (H-1) |
| Helpers de RLS (sólo responden sobre las relaciones del propio llamante) | 15 | ✔ deben ser ejecutables porque las políticas se evalúan como el llamante |
| Lecturas acotadas al llamante | 3 | ✔ salvo `sp_activity_feed` (H-4) |
| Superficie pública por diseño (verificación de credenciales y SkillPass) | 6 | ✔ salvo el enmascaramiento confidencial (H-3) y el listado de Storage (H-5) |
| Cálculo de compatibilidad | 1 | ✘ `sp_match_score` (H-2) |

Protección de contraseñas filtradas (HaveIBeenPwned): requiere plan Pro de Supabase.

**Hallazgos abiertos** (existen desde la versión inicial; ninguno lo introdujeron las migraciones de rendimiento):

| ID | Severidad | Hallazgo | Corrección propuesta |
|---|---|---|---|
| H-1 | Media | `sp_invite_member`: (a) un *manager* puede «invitar» el correo del dueño con rol `supervisor`, lo que lo degrada (el *upsert* sobrescribe `member_role`), y luego quitarlo con `sp_remove_member`: la organización queda sin dueño; (b) las respuestas `added` / `user_role_incompatible` / `invited` permiten enumerar cuentas y su tipo, incluso desde una empresa sin verificar; (c) cuentas existentes se agregan a la organización sin su consentimiento; (d) una invitación previa a un correo aún sin cuenta convierte al futuro estudiante en miembro de esa organización al registrarse. | Nunca cambiar el rol de un miembro existente desde una invitación; respuesta única `invited`; invitación pendiente que el invitado acepta explícitamente (requiere botón «Aceptar»); exigir organización verificada; no forzar el rol en el alta si el tipo de cuenta elegido no coincide. |
| H-2 | Media | `sp_match_score(estudiante, reto)` sólo exige poder revisar *algún* reto: una empresa recién registrada (sin verificar) con un reto en borrador puede consultar de cualquier estudiante qué competencias tiene verificadas o declaradas, si su carrera coincide (aunque la oculte), sus intereses y su disponibilidad. Los UUID de estudiantes se obtienen de la verificación pública de evidencia. | Permitirlo sólo al propio estudiante, al admin o a quien revisa el reto **y** el estudiante aplicó o está asignado a ese reto. |
| H-3 | Media | Credenciales de retos confidenciales: la verificación pública oculta reto y empresa pero publica `supervisor_name` y `supervisor_title` (p. ej. «Gerente de Mejora Continua · Nova Manufacturing»), que revelan la empresa. El seed no tiene credenciales confidenciales. | En `sp_credential_public_json`, devolver `null` en ambos campos cuando la política es `confidential` (el *snapshot* es inmutable, así que se enmascara al leer). |
| H-4 | Baja | `sp_activity_feed`: compañeros y revisores ven los títulos de evidencia **en borrador** de un compañero (la bitácora registra `evidence_added` al crearla) y pueden inferir el resultado de la validación de un compañero. Contradice la fila «Compañeros no ven… validaciones ajenas» de §4 para el *feed*. | Filtrar eventos: `evidence_added` sólo si la evidencia ya no es borrador; eventos de validación sólo para el estudiante involucrado y los revisores. |
| H-5 | Baja | La política `evidence_select_public` de Storage también aplica al **listado** del bucket: con la llave pública cualquiera puede enumerar los archivos de evidencia pública (y descargarlos) sin tener el código de la credencial, incluso si el estudiante desactivó su SkillPass público. No expone evidencia no pública. | Limitar la política a la operación de firma de URL (`storage.operation` = `storage.object.sign`), que es el único uso público de la app. |

Cada corrección irá en una migración nueva (las existentes ya están aplicadas en la demo).
