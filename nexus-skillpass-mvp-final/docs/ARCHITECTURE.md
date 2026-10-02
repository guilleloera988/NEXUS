# Arquitectura

Este documento explica cómo está construido SkillPass para que otro desarrollador pueda entenderlo y continuarlo.

## 1. Principios

1. **La base de datos es la autoridad.** Autorización, reglas de negocio e integridad viven en PostgreSQL (RLS, RPCs, triggers). La UI y las Server Actions validan forma y tamaño (zod) para dar buenos mensajes, pero nunca son la única barrera.
2. **Un solo camino a los datos.** Todo acceso pasa por `src/lib/server/backend.ts`, que sólo permite RPCs de una lista blanca y siempre con la identidad del visitante.
3. **Mismo SQL en todas partes.** La DEMO local (PGlite), las pruebas (PGlite y PostgreSQL 16 real) y Supabase ejecutan las mismas migraciones y el mismo seed.
4. **Honestidad del producto.** Datos ficticios siempre marcados como DEMO; el Skills Match se presenta como reglas, no IA; nada se vuelve «verificado» sin una evaluación humana registrada.

## 2. Vista general

```
src/
  app/                    Rutas (App Router)
    (app)/                Área privada con shell (sidebar, barra DEMO, notificaciones)
      dashboard/          Tablero por rol (estudiante, empresa, supervisor, universidad, admin)
      challenges/         Explorar · mis retos · crear/editar · detalle (resumen, candidatos, equipo, historial)
      workspace/[id]/     Tareas · evidencias · VATH · equipo · validación
      validations/        Bandeja y revisión del supervisor
      my-skillpass/       Credenciales, competencias, progreso y privacidad
      profile/ talent/ organization/ notifications/ admin/[section]/
    (auth)/               login · signup · forgot-password · reset-password
    onboarding/           Perfil inicial por tipo de cuenta
    demo/                 Entrada a la DEMO (guiada o por persona) y helper latest-credential
    skillpass/[slug]/     SkillPass público (opt-in)
    verify/ verify/[code] Verificación pública de credenciales con QR
    api/                  health · evidence/[id]/file · public/evidence/[id] · university/students.csv
    auth/callback/        Intercambio de código de Supabase Auth
  actions/                Server Actions (auth, demo, perfil, retos, workspace, validación, admin, idioma)
  components/             UI (primitives, formularios, shell, dashboards, gráficas, credencial, QR…)
  lib/
    server/               Código sólo-servidor: backend, demo-db, demo-session, supabase, storage, env, errores
    i18n/                 Diccionarios es/en tipados + helpers
    schemas.ts            Esquemas zod de cada acción
    safety.ts             Guardas puras: redirects seguros, CSV, sniffing de archivos, nombres seguros
  proxy.ts                Refresco de sesión y redirección de rutas privadas (antes «middleware»)
supabase/
  migrations/             Esquema, RLS, RPCs y Storage
  seed.sql                Datos DEMO ficticios (fechas relativas)
  seed/                   Usuarios demo (emulación local) y archivos demo
  demo-bootstrap.sql      Emulación mínima de Supabase Auth para PGlite (sólo local/pruebas)
tests/                    Vitest: unitarias, base de datos, Storage
e2e/                      Playwright: FLOW 01–10, seguridad, demo guiada, móvil
scripts/                  seed.mjs · test-postgres.mjs
```

## 3. Capa de datos

### 3.1 Adaptador (`backend.ts`)

- `getSession()` (cacheado por request): sesión DEMO local firmada **o** usuario de Supabase Auth.
- `read(fn, payload)` / `write(fn, payload)`: llaman sólo RPCs de `READ_RPCS` / `WRITE_RPCS` con un único argumento `p jsonb`.
- `publicRead(fn, payload, demoId)`: RPCs anónimas (`sp_public_*`) para páginas públicas.
- Errores de base de datos `sp:<clave>` (DETAIL = campo) se convierten en `AppError` y luego en mensajes traducidos; nunca se muestra el texto crudo de PostgreSQL.

### 3.2 Modo Supabase

El cliente `@supabase/ssr` usa la llave **pública** y la cookie de sesión del usuario. Cada RPC corre con el JWT del usuario: las lecturas son `SECURITY INVOKER` (RLS decide qué filas se ven) y las escrituras `SECURITY DEFINER` con autorización explícita, auditoría y notificaciones. La app no usa la service-role key en runtime.

### 3.3 Modo DEMO local (`demo-db.ts`)

- Se construye una **plantilla** PGlite ejecutando `demo-bootstrap.sql` + migraciones + usuarios demo + seed; se guarda comprimida en `.demo-data/template-<hash>.tar.gz` (el hash cambia si cambia cualquier SQL).
- Cada visitante recibe una copia aislada (~1 s) en `.demo-data/sessions/<uuid>/` y una cookie HttpOnly firmada con HMAC `sp_demo = {id, persona, exp}`.
- Cada RPC se ejecuta en una transacción con `request.jwt.claim.sub = <usuario persona>` y `set local role authenticated`, de modo que RLS se evalúa igual que con un JWT de Supabase.
- Máximo 4 bases abiertas en memoria (LRU), cola por base, limpieza por TTL (`NEXUS_DEMO_TTL_HOURS`) y por número máximo de escenarios (`NEXUS_DEMO_MAX_SESSIONS`).
- Los enlaces públicos (SkillPass, verificación, QR) incluyen `?demo=<id>` para que cualquiera con el enlace verifique una credencial del escenario.

## 4. Flujo de una mutación

```
<form action={serverAction}>  →  runAction()  →  zod.parse()  →  write('sp_xxx', payload)
                                                     │
                     PostgreSQL: sp_xxx (SECURITY DEFINER)
                       · sp_actor(): perfil del JWT
                       · autorización (rol, membresía, supervisor del reto, estado)
                       · reglas (trabajo justo, transiciones, horas, duplicados, evidencias)
                       · cambios + sp_audit() + sp_notify()
                                                     │
                     revalidatePath('/', 'layout')  →  UI actualizada (o redirect con ?done=1)
```

`runAction` también aplica *rate limiting* básico por clave y traduce errores a `ActionState` para `useActionState`.

## 5. Archivos de evidencia

- Subida por Server Action: tamaño (`MAX_UPLOAD_MB`), lista blanca MIME, verificación por *magic numbers* y nombre seguro. Ruta: `<estudiante>/<reto>/<aleatorio>-<nombre>`.
- Supabase: bucket privado `evidence` con políticas (sólo carpeta propia y reto activo; lectura según visibilidad de la evidencia; lectura anónima sólo de evidencia publicada en una credencial vigente).
- DEMO: disco local del escenario con protección contra *path traversal*.
- Descarga: `/api/evidence/[id]/file` consulta la fila con RLS y responde con URL firmada (60 s) o el archivo DEMO. Sólo PDF e imágenes se muestran *inline*, con `Content-Security-Policy: sandbox` y `nosniff`.
- Si el registro en base de datos falla tras subir, el archivo se elimina (rollback).

## 6. UI, accesibilidad e i18n

- Diseño: barra lateral negra con estado activo dorado, contenido claro, botones primarios con degradado dorado metálico (marca SkillPass), tipografía Plus Jakarta Sans.
- Gráficas propias en HTML/SVG (barras horizontales y columnas, un solo tono dorado, tooltips por hover/foco y vista de tabla alternativa).
- Accesibilidad: *skip link*, foco visible, etiquetas en todos los campos, `aria-live` para resultados, diálogos `<dialog>` nativos, contraste AA, `prefers-reduced-motion`.
- i18n: español por defecto, inglés vía cookie `sp_locale` o `Accept-Language`. `Messages` se deriva del diccionario español, así que una clave faltante en inglés es un error de compilación; las pruebas verifican paridad, placeholders y que cada error SQL tenga traducción.

## 7. Demo guiada

`GUIDE_STEPS` (9 pasos con persona y ruta) + componente flotante `GuidedDemo` (sólo cliente; progreso en `localStorage`). Al avanzar a un paso de otra persona envía `switchPersona`, que conserva el mismo escenario.

## 8. Decisiones relevantes

| Decisión | Motivo |
|---|---|
| RPCs con `p jsonb` en lugar de PostgREST sobre tablas | Una sola superficie auditable; grants de sólo `SELECT`; validación y autorización en un lugar. |
| RLS habilitado pero no `FORCE` | Las funciones `SECURITY DEFINER` (propiedad del dueño) necesitan escribir; los roles de API sí quedan sujetos a RLS. |
| PGlite para la DEMO | Demo aislada y reproducible sin secretos, con el mismo SQL y RLS que producción. |
| Skills Match por reglas | Transparente y explicable; el prompt prohíbe presentar reglas como IA. |
| Snapshot inmutable en credenciales | La verificación pública muestra exactamente lo validado aunque cambien datos después. |
| Next.js `--webpack` | Compatibilidad estable con PGlite (WASM) y `serverExternalPackages`. |
