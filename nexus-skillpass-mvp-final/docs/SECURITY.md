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
| Sin pruebas contra un proyecto Supabase vivo | Ejecutar `supabase db push` + seed en un proyecto de staging y repetir los E2E apuntando a él (`E2E_BASE_URL`). |
| Sin DPA/aviso de privacidad legal | Requiere decisión legal de AINDEV (LFPDPPP en México): aviso de privacidad, términos y acuerdos con empresas/universidades. |
