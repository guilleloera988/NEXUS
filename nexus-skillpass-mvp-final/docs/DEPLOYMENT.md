# Deployment

Objetivo: **`https://skillpass.aindev.com.mx`** en Vercel + Supabase.

> Estado (8 oct 2026): **producción** en **https://skillpass.aindev.com.mx** (Vercel `skillpass-prod` + Supabase `aapwypujznnkxkjdbmsu`, `NEXUS_DEMO_MODE=off`, sin datos demo; ver §9). La **demo pública** sigue en **https://skillpass-demo.vercel.app** (Vercel `skillpass-demo` + Supabase `pezqzunbvtfvwwnfybxy`, datos ficticios; ver §8). Ningún secreto está en el repositorio.

## 1. Topología recomendada

| Entorno | Hosting | Datos | `NEXUS_DEMO_MODE` |
|---|---|---|---|
| **Producción** `skillpass.aindev.com.mx` | Vercel (proyecto con *Root Directory* = `nexus-skillpass-mvp-final`) | Proyecto Supabase **productivo** (sin datos demo) | `off` |
| **Demo interactiva** (p. ej. `demo.skillpass.aindev.com.mx`) — opción A | Vercel (segundo proyecto, mismo repo) | Proyecto Supabase **exclusivo de demo**, sembrado con `npm run seed -- --supabase` | `supabase` |
| **Demo interactiva** — opción B (escenario aislado por visitante) | Servidor Node con disco persistente (VPS, Railway, Fly.io, Render) usando el `Dockerfile` | PGlite local por visitante | `local` |

La DEMO `local` **no** funciona en funciones serverless (no hay disco persistente compartido); por eso en Vercel se fuerza a `off` si se configura `local`.

## 2. Supabase (producción)

1. Crear el proyecto (región cercana, p. ej. `us-east-1` o `sa-east-1`), plan con backups diarios.
2. Aplicar migraciones desde tu máquina:
   ```bash
   cd nexus-skillpass-mvp-final
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push            # aplica supabase/migrations en orden
   ```
3. **Auth → Providers → Email**: habilitado; *Confirm email* activado; longitud mínima de contraseña 10; protección de contraseñas filtradas (si el plan lo permite).
4. **Auth → URL configuration**: *Site URL* = `https://skillpass.aindev.com.mx`; *Redirect URLs* = `https://skillpass.aindev.com.mx/auth/callback`.
5. **Auth → Emails**: usar las plantillas de `supabase/templates/` (confirmación y recuperación, con la marca SkillPass). Sus enlaces van a `/auth/callback?token_hash=…&type=…`, que valida el token en el servidor, así que funcionan aunque el correo se abra en otro dispositivo; el enlace por defecto de Supabase (`{{ .ConfirmationURL }}`, flujo PKCE) sólo inicia sesión en el navegador donde se hizo el registro. Configurar SMTP propio (p. ej. Resend, SES) para no depender del límite del SMTP de Supabase.
6. **Storage**: la migración crea el bucket privado `evidence` (10 MB, lista MIME) y sus políticas. Verificar en el panel que el bucket es *private*.
7. Crear el primer **admin AINDEV** (no existe por registro): registrar la cuenta normalmente y, desde el SQL editor del panel, ejecutar
   ```sql
   update public.profiles set role = 'admin', onboarding_completed = true where id = (select id from auth.users where email = '<correo>');
   ```
8. **No** cargar `seed.sql` en producción (sólo contiene datos ficticios de demo). Las competencias base sí son útiles: copiar el bloque `insert into public.competencies` de `seed.sql` si se desea el catálogo inicial.

## 3. Vercel

1. *Add New Project* → importar `guilleloera988/NEXUS` → **Root Directory**: `nexus-skillpass-mvp-final` → Framework: Next.js (detección automática; *Build Command* `npm run build`, *Install* `npm ci`). Node.js 22.
2. Variables de entorno (Production y Preview):

   | Variable | Valor |
   |---|---|
   | `NEXT_PUBLIC_APP_URL` | `https://skillpass.aindev.com.mx` (en Preview, la URL del preview o se deja vacía para usar el host) |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` o `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | llave pública del proyecto |
   | `NEXUS_DEMO_MODE` | `off` (producción) · `supabase` (proyecto de demo) |
   | `NEXUS_DEMO_PASSWORD` | sólo en el proyecto de demo |
   | `MAX_UPLOAD_MB` | `4` |

   **Nunca** configurar `SUPABASE_SERVICE_ROLE_KEY` ni `SUPABASE_DB_URL` en Vercel.
3. Las variables `NEXT_PUBLIC_*` se fijan en build: tras cambiarlas, volver a desplegar.
4. Desplegar y comprobar `https://<deployment>.vercel.app/api/health` → `{"status":"ok","supabase":true,...}`.

## 4. Dominio, DNS y SSL (requiere autorización)

1. En Vercel → *Settings → Domains* → agregar `skillpass.aindev.com.mx`.
2. En el DNS de `aindev.com.mx` crear **un** registro (no modificar otros):
   ```
   skillpass   CNAME   cname.vercel-dns.com.
   ```
   (Si el proveedor no permite CNAME en ese nombre, usar el registro A que indique Vercel.)
3. Vercel emite y renueva el certificado TLS (Let's Encrypt) automáticamente; HSTS ya se envía desde la app.
4. Actualizar *Site URL* y *Redirect URLs* de Supabase si cambia el dominio.

## 5. Demo interactiva

### Opción A — Supabase de demo (Vercel)

```bash
# en tu máquina, con un proyecto Supabase NUEVO y vacío dedicado a la demo
export NEXT_PUBLIC_SUPABASE_URL=https://<demo-ref>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service-role del proyecto demo>      # sólo en tu terminal
export SUPABASE_DB_URL=postgresql://postgres:<password>@db.<demo-ref>.supabase.co:5432/postgres
export NEXUS_DEMO_PASSWORD=<valor largo y aleatorio>
npm run seed -- --supabase --confirm-demo-project --apply-migrations
```

Luego, en el proyecto de Vercel de la demo: `NEXUS_DEMO_MODE=supabase` y el mismo `NEXUS_DEMO_PASSWORD`. Todos los visitantes comparten el estado; re-sembrar periódicamente (el script es idempotente: actualiza contraseñas y re-ejecuta el seed).

### Opción B — escenario aislado por visitante (Docker)

```bash
docker build -t skillpass .
docker run -p 3000:3000 -v skillpass-demo:/app/.demo-data \
  -e NEXT_PUBLIC_APP_URL=https://demo.skillpass.aindev.com.mx \
  -e NEXUS_DEMO_MODE=local -e NEXUS_DEMO_SECRET=<32+ caracteres aleatorios> \
  -e NEXUS_DEMO_MAX_SESSIONS=40 skillpass
```

Cada escenario ocupa ~42 MB de disco; `NEXUS_DEMO_MAX_SESSIONS × 42 MB` debe caber en el volumen. `NEXT_PUBLIC_APP_URL` se pasa también como *build arg* para que los QR usen el dominio correcto.

## 6. Checklist de verificación post-deploy

- [ ] `/api/health` responde `ok` y `supabase: true`.
- [ ] Registro de estudiante → pantalla «Revisa tu correo» (`/signup/check-email`) → enlace del correo, abierto en otro dispositivo → `/auth/callback` → onboarding → tablero.
- [ ] Registro de empresa queda «Pendiente de verificación»; el admin la verifica en `/admin/organizations`.
- [ ] La empresa publica un reto; un estudiante aplica; la empresa acepta.
- [ ] Subida de evidencia (PDF) visible para el supervisor y **no** para una cuenta ajena (`/api/evidence/<id>/file` → 404).
- [ ] Validación con emisión de credencial; `/verify/<código>` abre en una ventana privada; el QR apunta a `https://skillpass.aindev.com.mx/verify/<código>`.
- [ ] Cabeceras: `curl -sI https://skillpass.aindev.com.mx | grep -i -E "content-security|strict-transport|x-content-type"`.
- [ ] Repetir los E2E contra el despliegue: `E2E_BASE_URL=https://… E2E_SUPABASE=1 npx playwright test e2e/auth-supabase.spec.ts` (en un entorno de staging, no en producción).
- [ ] Revisar *Advisors* de seguridad y rendimiento en el panel de Supabase.

## 7. Operación

- **Backups**: diarios en Supabase (PITR en planes superiores). Exportar el bucket `evidence` periódicamente si se requiere retención propia.
- **Monitoreo**: Vercel Analytics/Logs; logs de Postgres y Auth en Supabase. Los errores de servidor se registran con el prefijo `[skillpass]` sin datos personales.
- **Rotación de secretos**: rotar la llave pública/`service_role` desde Supabase si se expone; `NEXUS_DEMO_SECRET` invalida las cookies DEMO al cambiar.
- **Migraciones nuevas**: agregar archivos `supabase/migrations/<timestamp>_<nombre>.sql`; probar con `npm test` y `npm run test:pg`; aplicar con `supabase db push`.

## 8. Despliegue actual — demo pública

| | |
|---|---|
| URL | **https://skillpass-demo.vercel.app**. Del 7 al 8 oct también respondió en `skillpass.aindev.com.mx`; ese dominio pasó a producción (§9) y `NEXT_PUBLIC_APP_URL` volvió a `https://skillpass-demo.vercel.app` (QR y enlaces de la demo usan este host). |
| Vercel | Proyecto `skillpass-demo` (equipo `aindev-tech`), *Root Directory* `nexus-skillpass-mvp-final`, Node.js 22.x, *Install* `npm ci`. Rama de producción: `claude/aindev-nexus-skillpass-mvp-khihxn` (`main` aún no contiene la app). *Deployment Protection*: Standard (la URL de producción `.vercel.app` es pública; los *previews* piden sesión de Vercel). |
| Variables | `NEXT_PUBLIC_APP_URL=https://skillpass-demo.vercel.app` (sólo Production; en Preview se usa el host), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXUS_DEMO_MODE=supabase`, `NEXUS_DEMO_PASSWORD` (tipo *sensitive*), `MAX_UPLOAD_MB=4`. Sin `service_role` ni URL de base de datos. |
| Supabase | Proyecto `pezqzunbvtfvwwnfybxy` (us-east-1, PostgreSQL 17), **exclusivo de la demo**. |
| Auth | *Site URL* `https://skillpass-demo.vercel.app`; *Redirect URLs* `https://skillpass-demo.vercel.app/auth/callback` y `https://skillpass-demo-*-aindev-tech.vercel.app/**` (previews). Debe conservar *Site URL* `https://skillpass-demo.vercel.app` (el dominio propio ahora es de producción). Confirmación de correo activada; contraseña mínima 10. Protección de contraseñas filtradas: requiere plan Pro (no activada). SMTP: el integrado de Supabase (límite bajo de correos/hora). |

Cómo se cargó (equivalente a `npm run seed -- --supabase --confirm-demo-project --apply-migrations`, pero por la Management API, sin conexión directa a Postgres ni `service_role` en la máquina del operador):

1. Las 5 migraciones se aplicaron en una sola transacción con `POST /v1/projects/<ref>/database/query` y se registraron en `supabase_migrations.schema_migrations`, así que `supabase db push` las reconoce como aplicadas.
2. Las 16 cuentas de `supabase/seed/demo-auth-users.sql` se crearon por SQL en `auth.users` + `auth.identities` (correo confirmado, mismos UUID y metadatos, contraseña = `NEXUS_DEMO_PASSWORD` con bcrypt); el *trigger* `sp_on_auth_user_created` creó los perfiles.
3. `supabase/seed.sql` por la misma API. Conteos idénticos a la plantilla local: 16 usuarios, 5 organizaciones, 8 retos, 11 evidencias, 18 VATH, 5 credenciales, 0 perfiles no-demo.
4. Los 3 archivos de `supabase/seed/files` se subieron a `evidence` con la sesión de su estudiante (llave pública + contraseña demo). El de un reto ya completado (`…/40000000-…-0002/b71d09-dashboard-inventario.png`) lo rechaza `evidence_insert_own`; se subió con una política temporal limitada a esa ruta y a ese usuario, eliminada en el mismo paso.

Migraciones posteriores aplicadas en la demo (7–8 oct 2026, misma vía y registradas en `supabase_migrations`): `20261007000001_rls_initplan.sql`, `20261007000002_fk_indexes.sql` y las correcciones de seguridad `20261007000003`…`20261007000007` (SECURITY §6). Comprobado tras aplicarlas: el listado anónimo del bucket devuelve `[]`, la descarga de la evidencia publicada en `SKP-2026-4A7C-91D2` sigue funcionando (redirección a URL firmada → 200) y la evidencia no pública devuelve 404. En un servidor con la DEMO local (opción B), correr `npm run demo:reset` tras desplegar migraciones nuevas: los escenarios existentes conservan las funciones anteriores hasta que expiran.

Limpieza de datos de prueba (8 oct 2026): se borraron las 31 filas que dejó la corrida de E2E del 7 oct (reto «E2E MUYC0NAT», su aplicación, evidencia, VATH, validación, la credencial `SKP-2026-FC08-7CCE`, un incidente, 7 notificaciones y 11 entradas de bitácora) en una sola transacción con conteos verificados, desactivando momentáneamente los *triggers* de inmutabilidad, y el PDF de prueba se borró de Storage con la sesión de su dueña. Todas las tablas volvieron a los conteos del seed. Las corridas E2E posteriores contra la demo sólo usaron especificaciones de lectura (seguridad, demo guiada, móvil).

Re-sembrar: el seed es idempotente, pero no borra lo que crean los visitantes o los E2E; esos datos se acumulan en la demo compartida. Para rotar la contraseña demo, actualizar `encrypted_password` de las cuentas `@demo.skillpass.invalid` (o correr el script con `SUPABASE_SERVICE_ROLE_KEY`) y la variable `NEXUS_DEMO_PASSWORD` en Vercel, y volver a desplegar.

Verificación (7 oct 2026) contra `https://skillpass-demo.vercel.app`, con `E2E_BASE_URL=https://skillpass-demo.vercel.app`:

- `/api/health` → `{"status":"ok","supabase":true,"demoMode":"supabase"}`; cabeceras CSP, HSTS, `nosniff` y `X-Frame-Options: DENY` presentes.
- `e2e/critical-flow.spec.ts` (**FLOW 01–10**): ✔ 1/1, los 10 pasos, sin errores de consola ni HTTP ≥ 400.
- `security`, `guided-demo`, `incidents`, `mobile` (con `E2E_SUPABASE=1`): ✔ 13/13 (+1 omitida: enlaces `?demo=` sólo existen en la DEMO local).
- `auth-supabase.spec.ts` no se ejecutó: exige la confirmación de correo desactivada y enviaría correos reales.

## 9. Despliegue actual — producción

| | |
|---|---|
| URL | **https://skillpass.aindev.com.mx** (CNAME `skillpass → cname.vercel-dns.com` en el DNS de HostGator; certificado TLS de Vercel con renovación automática) y `https://skillpass-prod.vercel.app` |
| Vercel | Proyecto `skillpass-prod` (equipo `aindev-tech`), *Root Directory* `nexus-skillpass-mvp-final`, Node.js 22.x, *Install* `npm ci`, región de funciones `iad1`, rama de producción `claude/aindev-nexus-skillpass-mvp-khihxn`, *Deployment Protection* Standard. |
| Variables | `NEXT_PUBLIC_APP_URL=https://skillpass.aindev.com.mx` (Production), `NEXT_PUBLIC_SUPABASE_URL=https://aapwypujznnkxkjdbmsu.supabase.co`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXUS_DEMO_MODE=off`, `MAX_UPLOAD_MB=4`. Sin `service_role`, sin URL de base de datos, sin contraseña demo. |
| Supabase | Proyecto `aapwypujznnkxkjdbmsu` «skillpass-prod» (us-east-1, PostgreSQL 17.11), plan Free al 8 oct (se pausa tras 7 días sin actividad y no tiene respaldos diarios: pasar a Pro antes de abrir a usuarios reales). |
| Base de datos | Las 12 migraciones (`20261002000001`…`20261007000007`) aplicadas en una sola transacción por la Management API y registradas en `supabase_migrations.schema_migrations`; la 13.ª, `20261008000001_talent_credentials_scope.sql` (H-6), el 8 oct por la misma vía con un script que comprueba antes que estén exactamente las 12 anteriores y después la política, los dueños y los permisos (14 comprobaciones correctas). Sólo el catálogo de 23 competencias de `seed.sql` (dato de referencia); **ningún** usuario, organización, reto ni credencial demo. Comprobado: 24 tablas con RLS, 0 permisos de escritura para `anon`/`authenticated`, bucket `evidence` **privado** (10 MB, 4 políticas), trigger de alta presente. *Security Advisor*: sin errores; avisos `*_security_definer_function_executable` esperados por diseño (SECURITY §6). |
| Auth | *Site URL* `https://skillpass.aindev.com.mx`; *Redirect URLs* `https://skillpass.aindev.com.mx/auth/callback`; confirmación de correo activada; contraseña mínima 10; SMTP propio **Resend** (`smtp.resend.com:587`, usuario `resend`, dominio `aindev.com.mx` verificado con DKIM `resend._domainkey` y los CNAME `send`/`rsend` en HostGator; remitente `noreply@aindev.com.mx`, «SkillPass»; plan gratuito: 100 correos/día y 3,000/mes), 30 correos/hora en Supabase. Titan (`smtp.titan.email`) se descartó: rechazaba los envíos desde Supabase en los puertos 465 y 587 aunque la cuenta funciona en el webmail. Prueba real (8 oct): correo de recuperación enviado (HTTP 200); plantillas en español para confirmación, recuperación y cambio de correo. Confirmación y recuperación usan los archivos de `supabase/templates/` (enlace `token_hash`, válido en cualquier dispositivo; vence en 1 h). Tras registrarse, la app lleva a `/signup/check-email` (correo usado, pasos, reenvío con espera de 60 s); un inicio de sesión con correo sin confirmar lleva a la misma pantalla, y un enlace vencido o ya usado, a `/login` con explicación. |

Verificación (8 oct 2026): `/api/health` → `{"status":"ok","supabase":true,"demoMode":"off"}`; `/`, `/login`, `/signup`, `/verify` → 200; `/dashboard` sin sesión → 307 a `/login?next=%2Fdashboard`; `/demo` indica que la demo no está habilitada; `/verify/SKP-2026-4A7C-91D2` → «Credencial no encontrada» (no hay datos demo); cabeceras CSP, HSTS, `nosniff` y `X-Frame-Options: DENY` presentes; el alias `skillpass.aindev.com.mx` apunta al despliegue de producción.

### Primer administrador

No existe cuenta admin por registro (por diseño). Para crear la primera:

1. Registrarse en `https://skillpass.aindev.com.mx/signup` como **Estudiante** con el correo institucional y confirmar el correo.
2. En Supabase → **SQL Editor** del proyecto `aapwypujznnkxkjdbmsu`:
   ```sql
   update public.profiles
      set role = 'admin', onboarding_completed = true
    where id = (select id from auth.users where email = '<correo>');
   ```
3. Cerrar sesión y volver a entrar: el menú muestra **Talent OS**.

Primer admin creado el 8 oct (`guilleloera977@gmail.com`). Como el SMTP aún fallaba, se activó `mailer_autoconfirm` durante ~2 minutos para ese registro y se volvió a desactivar; en ese lapso no se creó ninguna otra cuenta. Desde ahí se verifican organizaciones y se gestionan roles; los demás admins se crean igual (paso 2), nunca desde la app.

