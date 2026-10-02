# Deployment

Estado actual de infraestructura: **no se declara deployment público ni dominio conectado**. Las verificaciones locales se documentan en [VERIFICATION.md](VERIFICATION.md). Nunca usar valores ficticios de variables como si fueran un proyecto Supabase operativo.

## Variables

| Variable | Local DEMO | Supabase/Vercel |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Vacía | URL del proyecto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vacía | Clave anon pública, si se usa esta modalidad |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vacía | Alternativa pública a la anon key |
| `NEXT_PUBLIC_APP_URL` | Vacía para usar origen local | Origen HTTPS completo, sin ruta |
| `NEXUS_DEMO_ENABLED` | `true` | `false` en Vercel |
| `NEXUS_DEMO_SECRET` | Según `.env.example` | No habilitar DEMO de disco en Vercel; en servidor propio, mínimo 32 caracteres aleatorios |
| `NEXUS_DEMO_DATA_DIR` | `.demo-data` | Sólo servidor propio con disco persistente |
| `NEXUS_DEMO_MAX_SESSIONS` | `30` | Límite de escenarios para DEMO de disco |

No configurar service role en el navegador ni en las variables `NEXT_PUBLIC_*`. Este MVP no requiere API key de IA. Conservar las variables únicamente en `.env.local` y en el gestor de secretos del hosting, fuera de Git.

## 1. Base de datos y Auth de staging

Crear un proyecto Supabase separado de producción. Con Supabase CLI instalado y acceso autorizado:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Estos pasos aplican las migrations versionadas. No usar `--include-seed` en producción: el seed es DEMO. No resetear una base con usuarios reales. El flujo de enlace y push se basa en la [documentación oficial de migrations](https://supabase.com/docs/guides/deployment/database-migrations).

Configurar en Auth → URL Configuration:

- Site URL: el mismo origen que `NEXT_PUBLIC_APP_URL`.
- Redirect URL local: `http://127.0.0.1:3000/auth/callback`.
- Redirect URL de staging: `https://YOUR_PREVIEW_HOST/auth/callback`.
- Redirect URL de producción: `https://YOUR_APPROVED_DOMAIN/auth/callback`.

Usar las URLs concretas aprobadas por el propietario. Revisar confirmación de email y entrega real de correo. Las URLs de redirección deben estar permitidas por Supabase; ver [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls). La integración SSR conserva la sesión mediante cookies; ver [Supabase SSR](https://supabase.com/docs/guides/auth/server-side).

Registrar un estudiante real y confirmar su correo. Registrar otra cuenta para el primer administrador y confirmar también su correo. La API de registro pública siempre crea estudiantes; no acepta elegir `admin` ni `supervisor`.

### Alta controlada del primer administrador

El propietario autorizado del proyecto ejecuta este bloque una sola vez desde Supabase SQL Editor con rol administrativo de base de datos, o mediante una conexión administrativa equivalente. Primero verificar en Auth → Users la identidad de la persona responsable y copiar su UUID y correo exactos. Reemplazar ambos placeholders del bloque; no son secretos ni contraseñas. Esta operación eleva privilegios y debe quedar registrada por el responsable del entorno. No exponerla como endpoint ni ejecutarla desde el navegador.

```sql
begin;
do $$
declare
  target_user uuid := '00000000-0000-0000-0000-000000000000';
  expected_email text := 'REPLACE_WITH_VERIFIED_ADMIN_EMAIL';
  affected integer;
begin
  if target_user = '00000000-0000-0000-0000-000000000000'::uuid
     or expected_email = 'REPLACE_WITH_VERIFIED_ADMIN_EMAIL' then
    raise exception 'Replace both placeholders after verifying the Auth user';
  end if;

  update public.profiles p
     set role = 'admin', updated_at = now()
    from auth.users u
   where p.id = target_user and u.id = p.id
     and lower(u.email) = lower(expected_email)
     and u.email_confirmed_at is not null
     and p.role = 'student' and p.is_demo = false;

  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Expected exactly one confirmed, non-DEMO student; no promotion committed';
  end if;

  insert into public.activity_events(subject_id, action, entity_id, details)
  values (target_user, 'admin_bootstrapped', target_user,
    jsonb_build_object('method', 'authorized_database_operator'));
end $$;
commit;
```

El bloque falla sin conceder permisos si el UUID, correo, confirmación, perfil o rol no coinciden. Tras ejecutar, comprobar el perfil y entrar con esa cuenta en `/admin`. El administrador crea la organización, el catálogo de skills y el reto, y asigna membresías desde la aplicación a cuentas previamente registradas. Los siguientes administradores requieren una operación controlada equivalente: `set_member` concede roles de organización, no `admin`. No crear usuarios insertando manualmente en `auth.users`.

Antes del piloto, crear la organización, asignar al supervisor y vincular correctamente a los estudiantes y observadores institucionales. El texto libre del campo “universidad” no concede acceso institucional.

## 2. Publicar aplicación en Vercel

1. Subir este repositorio limpio a una cuenta de GitHub autorizada; no se asume que ya exista un remoto.
2. Importar en Vercel y seleccionar framework Next.js. Si se sube una carpeta contenedora, fijar Root Directory en `nexus-skillpass`.
3. Usar el lockfile y Node.js compatible. Build Command: `npm run build`.
4. Configurar las variables Supabase y `NEXUS_DEMO_ENABLED=false` en Preview y Production. Las variables públicas de Next.js forman parte del build, por lo que cambios de entorno requieren un nuevo deployment.
5. Publicar primero Preview; actualizar su origen y redirect URL, volver a desplegar si cambia `NEXT_PUBLIC_APP_URL` y ejecutar los gates siguientes.
6. Promover a producción sólo tras pasar los gates con identidades reales.

La integración Next.js y las variables de entorno están descritas en las fuentes oficiales de [Vercel para Next.js](https://vercel.com/docs/frameworks/full-stack/nextjs) y [variables de entorno](https://vercel.com/kb/guide/how-to-add-vercel-environment-variables).

La DEMO PGlite escribe en disco local y no es durable en funciones serverless. El código la deshabilita automáticamente cuando detecta Vercel, además del interruptor de entorno. Para una URL DEMO pública, preparar y verificar un único servidor Node con volumen persistente, HTTPS y secreto DEMO fuerte, o implementar y probar un adaptador de DEMO en un proyecto Supabase separado. No compartir una carpeta PGlite entre múltiples procesos o servidores. Ese adaptador remoto no está incluido. No mezclar fixtures con registros reales.

## 3. Dominio y HTTPS

Dominios propuestos: `nexus.aindev.com.mx` o `skillpass.aindev.com.mx`. Son **PLAN**, no dominios cuya propiedad o configuración se haya verificado aquí. Añadir el dominio aprobado al proyecto Vercel, aplicar exactamente los registros DNS que indique y esperar HTTPS válido. Actualizar `NEXT_PUBLIC_APP_URL`, Site URL y redirect URL de Auth. Volver a probar el QR desde un teléfono externo; debe abrir el dominio final, no localhost.

## Gates obligatorios antes del piloto

| Gate | Responsable propuesto | Entregable y criterio go/no-go |
| --- | --- | --- |
| Base remota | Mario | Migrations aplicadas; test de RLS entre dos organizaciones sin filtraciones |
| Auth | Mario | Registro, confirmación, login, refresh, reload, logout y callback exitosos |
| Negocio | Emma | Recorrido con usuario estudiante y supervisor distintos, aprobación y revocación |
| Público/privado | Mario + Emma | Ventana privada sólo ve datos opt-in; perfil privado y UUID inválido no exponen información |
| Dominio | Mario | HTTPS válido, QR desde otro dispositivo, callback en dominio aprobado |
| Presentación | Guillermo | DEMO identificada y sin promesas de empleo, alianza o certificación oficial |

Los responsables son una propuesta de ejecución, no asignaciones aceptadas. Costo de infraestructura: pendiente de cotización y presupuesto; no afirmar costo cero de producción. Fecha objetivo: antes de invitar al primer usuario real.

## Operación y reversión

Guardar respaldo y verificar restauración antes de cambios de esquema sobre datos reales. Mantener migrations aditivas cuando sea posible. Revertir una versión de UI no revierte datos; evaluar compatibilidad antes de volver a un deployment anterior. Definir responsables de incidentes, retención/borrado, disponibilidad y soporte antes del piloto. No presentar las comprobaciones de este repositorio como una auditoría de seguridad independiente.
