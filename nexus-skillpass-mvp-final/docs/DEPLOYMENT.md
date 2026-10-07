# Deployment

Objetivo: **`https://skillpass.aindev.com.mx`** en Vercel + Supabase.

> Estado (7 oct 2026): la **demo pública** está desplegada en **https://skillpass-demo.vercel.app** (opción A de §5, ver §8). Producción (`skillpass.aindev.com.mx`, `NEXUS_DEMO_MODE=off`) sigue pendiente: falta un proyecto Supabase productivo y la autorización para el registro DNS, que no se ha tocado. Ningún secreto está en el repositorio.

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
5. **Auth → Emails**: personalizar plantillas (confirmación y recuperación) con la marca SkillPass; configurar SMTP propio (p. ej. Resend, SES) para no depender del límite del SMTP de Supabase.
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
- [ ] Registro de estudiante → correo de confirmación → `/auth/callback` → onboarding → tablero.
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
| URL | **https://skillpass-demo.vercel.app** |
| Vercel | Proyecto `skillpass-demo` (equipo `aindev-tech`), *Root Directory* `nexus-skillpass-mvp-final`, Node.js 22.x, *Install* `npm ci`. Rama de producción: `claude/aindev-nexus-skillpass-mvp-khihxn` (`main` aún no contiene la app). *Deployment Protection*: Standard (la URL de producción `.vercel.app` es pública; los *previews* piden sesión de Vercel). |
| Variables | `NEXT_PUBLIC_APP_URL=https://skillpass-demo.vercel.app` (sólo Production; en Preview se usa el host), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXUS_DEMO_MODE=supabase`, `NEXUS_DEMO_PASSWORD` (tipo *sensitive*), `MAX_UPLOAD_MB=4`. Sin `service_role` ni URL de base de datos. |
| Supabase | Proyecto `pezqzunbvtfvwwnfybxy` (us-east-1, PostgreSQL 17), **exclusivo de la demo**. |
| Auth | *Site URL* `https://skillpass-demo.vercel.app`; *Redirect URLs* `https://skillpass-demo.vercel.app/auth/callback` y `https://skillpass-demo-*-aindev-tech.vercel.app/**` (previews). Confirmación de correo activada; contraseña mínima 10. Protección de contraseñas filtradas: requiere plan Pro (no activada). SMTP: el integrado de Supabase (límite bajo de correos/hora). |

Cómo se cargó (equivalente a `npm run seed -- --supabase --confirm-demo-project --apply-migrations`, pero por la Management API, sin conexión directa a Postgres ni `service_role` en la máquina del operador):

1. Las 5 migraciones se aplicaron en una sola transacción con `POST /v1/projects/<ref>/database/query` y se registraron en `supabase_migrations.schema_migrations`, así que `supabase db push` las reconoce como aplicadas.
2. Las 16 cuentas de `supabase/seed/demo-auth-users.sql` se crearon por SQL en `auth.users` + `auth.identities` (correo confirmado, mismos UUID y metadatos, contraseña = `NEXUS_DEMO_PASSWORD` con bcrypt); el *trigger* `sp_on_auth_user_created` creó los perfiles.
3. `supabase/seed.sql` por la misma API. Conteos idénticos a la plantilla local: 16 usuarios, 5 organizaciones, 8 retos, 11 evidencias, 18 VATH, 5 credenciales, 0 perfiles no-demo.
4. Los 3 archivos de `supabase/seed/files` se subieron a `evidence` con la sesión de su estudiante (llave pública + contraseña demo). El de un reto ya completado (`…/40000000-…-0002/b71d09-dashboard-inventario.png`) lo rechaza `evidence_insert_own`; se subió con una política temporal limitada a esa ruta y a ese usuario, eliminada en el mismo paso.

Re-sembrar: el seed es idempotente, pero el reto y la credencial que crean los E2E se acumulan en la demo compartida. Para rotar la contraseña demo, actualizar `encrypted_password` de las cuentas `@demo.skillpass.invalid` (o correr el script con `SUPABASE_SERVICE_ROLE_KEY`) y la variable `NEXUS_DEMO_PASSWORD` en Vercel, y volver a desplegar.

Verificación (7 oct 2026) contra `https://skillpass-demo.vercel.app`, con `E2E_BASE_URL=https://skillpass-demo.vercel.app`:

- `/api/health` → `{"status":"ok","supabase":true,"demoMode":"supabase"}`; cabeceras CSP, HSTS, `nosniff` y `X-Frame-Options: DENY` presentes.
- `e2e/critical-flow.spec.ts` (**FLOW 01–10**): ✔ 1/1, los 10 pasos, sin errores de consola ni HTTP ≥ 400.
- `security`, `guided-demo`, `incidents`, `mobile` (con `E2E_SUPABASE=1`): ✔ 13/13 (+1 omitida: enlaces `?demo=` sólo existen en la DEMO local).
- `auth-supabase.spec.ts` no se ejecutó: exige la confirmación de correo desactivada y enviaría correos reales.
