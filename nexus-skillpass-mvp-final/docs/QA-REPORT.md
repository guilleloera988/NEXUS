# Reporte de QA

Fecha de ejecución: 2 de octubre de 2026 · Rama `claude/aindev-nexus-skillpass-mvp-khihxn` · Node.js 22.22 · Chromium (Playwright 1.63).

Todas las cifras de este documento provienen de ejecuciones reales en esta entrega; nada se marcó como aprobado sin correrlo.

## 1. Resumen

| Puerta | Comando | Resultado |
|---|---|---|
| Lint | `npm run lint` | ✔ 0 errores · 0 warnings |
| Tipos | `npm run typecheck` | ✔ sin errores (TypeScript estricto + tipos de rutas generados) |
| Unitarias + base de datos (PGlite) | `npm test` | ✔ **105/105** (8 oct 2026, con las regresiones de seguridad H-1…H-6) |
| Base de datos en PostgreSQL 16 real | `npm run test:pg` | ✔ **49/49** |
| Base de datos en PostgreSQL 17.11 (imagen de Supabase) | `TEST_DATABASE_URL=… npm run test:pg` | ✔ **39/39** (corrida del 2 oct; las 12 migraciones se aplicaron después en el Supabase de la demo, PG 17) |
| Build de producción | `npm run build` | ✔ compila sin errores ni warnings de tipos; 33 rutas dinámicas + 5 recursos estáticos (íconos, OG, robots, sitemap) |
| E2E · DEMO local (dev) | `npm run test:e2e` | ✔ **15/15** (+3 omitidas: requieren Supabase) |
| E2E · DEMO local (build de producción, modo CI) | `CI=1 npm run test:e2e` | ✔ **15/15** (+3 omitidas); 8 oct, con la prueba de descarga pública: ✔ **16/16** (+3 omitidas) |
| E2E · Supabase real (stack local: Auth, PostgREST, Storage, Kong) | `E2E_BASE_URL=… E2E_SUPABASE=1 npx playwright test` | ✔ **17/17** (+1 omitida: sólo DEMO local) |
| E2E · despliegue Vercel + Supabase en la nube (7 oct 2026) | `E2E_BASE_URL=https://skillpass-demo.vercel.app E2E_SUPABASE=1 npx playwright test` (sin `auth-supabase`) | ✔ **14/14**: FLOW 01–10 + seguridad, demo guiada, incidentes y móvil (+1 omitida: sólo DEMO local). Ver [DEPLOYMENT §8](DEPLOYMENT.md#8-despliegue-actual--demo-pública) |
| E2E · demo en la nube tras las correcciones de seguridad (8 oct 2026) | ídem, sólo especificaciones de lectura: `security guided-demo mobile` | ✔ **13/13** (+1 omitida: sólo DEMO local), incluida la descarga anónima de evidencia publicada con la política de Storage H-5 activa. FLOW 01–10 se verificó en la DEMO local con las 12 migraciones (no se repitió en la nube para no dejar datos de prueba). |
| Migraciones en Supabase | `supabase start` (CLI 2.119, PG 17) | ✔ las 5 migraciones aplican sin errores |
| Seed en Supabase | `npm run seed -- --supabase --confirm-demo-project` | ✔ 16 cuentas vía Admin API, seed SQL, 3 archivos a Storage |
| Sondeo directo de la API (PostgREST) | `curl` con llave anónima y JWT de estudiante | ✔ ver §5 |
| CI en GitHub Actions | `.github/workflows/skillpass-quality.yml` | ✔ lint, tipos, pruebas, PostgreSQL 16, build y E2E pasan en los runners de GitHub ([ejecuciones](https://github.com/guilleloera988/NEXUS/actions/workflows/skillpass-quality.yml)) |

## 2. Pruebas unitarias y de base de datos (`npm test`)

| Archivo | Pruebas | Cobertura |
|---|---|---|
| `tests/database.test.ts` | 41 | RLS en 24 tablas; sin escrituras directas aun con *default privileges*; funciones expuestas a `anon`; roles por registro/invitación; FLOW 01–08 y 10 a nivel SQL; revocación; aislamiento entre organizaciones, compañeros, universidad; talent pool; admin; inmutabilidad; regresiones H-1…H-6 de la revisión de seguridad (fallan sin las migraciones de corrección). |
| `tests/storage.test.ts` | 8 | Bucket privado, lectura anónima sólo de evidencia publicada en credencial vigente y sólo al firmar la URL (13 operaciones de Storage negadas, sin listado), dueño/compañero/supervisor, subida sólo a carpeta propia y reto activo, borrado sólo de archivos no revisados. |
| `tests/unit/safety.test.ts` | 26 | *Open redirect*, CSV injection, *magic numbers*, nombres de archivo. |
| `tests/unit/schemas.test.ts` | 13 | Trabajo justo, fechas, enums, URLs https, VATH, rúbrica, rol admin, contraseñas, onboarding con campos vacíos. |
| `tests/unit/i18n.test.ts` | 8 | Paridad es/en, placeholders, mensajes vacíos, cada error SQL y notificación con traducción, 9 pasos de la guía, ningún texto «AI Match». |
| `tests/unit/server-guards.test.ts` | 4 | Firma/expiración/manipulación de la cookie DEMO; mapeo de errores sin filtrar mensajes de PostgreSQL. |
| `tests/unit/format.test.ts` | 5 | Fechas sin desfase de zona, horas fraccionarias, tiempos relativos, iniciales, tamaños. |

## 3. Pruebas E2E (Playwright)

| Spec | Pruebas | Qué valida |
|---|---|---|
| `critical-flow.spec.ts` | 1 (10 pasos) | **FLOW 01–10 por la UI real**: la empresa crea y publica un reto (persiste tras recargar) → el estudiante aplica y la empresa asigna → workspace → subida de PDF → VATH y envío → el supervisor revisa horas, evidencia y descarga el archivo → valida con rúbrica y emite credencial → SkillPass actualizado → verificación pública sin sesión → **QR decodificado con jsQR** abre la URL correcta → la analítica universitaria (CSV) refleja exactamente las horas nuevas. Sin errores de consola ni respuestas HTTP ≥ 400. |
| `security.spec.ts` | 10 | Rutas privadas → login con `next` seguro; `next` externo ignorado; descargas/exportaciones anónimas bloqueadas; estudiante sin acceso a admin/CSV; universidad sin archivos; compañero sin validación ajena; verificación pública y búsqueda por código; cabeceras de seguridad; `/api/health` sin secretos; enlaces DEMO verificables por terceros. |
| `guided-demo.spec.ts` | 1 | Los 9 pasos de la demo guiada con cambio de persona y rutas esperadas. |
| `incidents.spec.ts` | 1 | El estudiante reporta un problema desde su SkillPass y el admin lo resuelve en Talent OS. |
| `mobile.spec.ts` | 2 | Pixel 7: páginas públicas y pantallas principales sin scroll horizontal; menú móvil. |
| `auth-supabase.spec.ts` | 3 | (Sólo Supabase) registro de estudiante → onboarding → cerrar sesión → iniciar sesión; empresa nueva queda pendiente y no puede publicar; error genérico con credenciales incorrectas. |

## 4. Defectos encontrados y corregidos en esta fase

| # | Defecto | Cómo se encontró | Corrección |
|---|---|---|---|
| 1 | Política de Storage impedía al estudiante ver/borrar su archivo antes de existir la fila de evidencia (rollback fallido en Supabase). | Prueba de políticas de Storage | Condición «carpeta propia» en la política de lectura. |
| 2 | Campos opcionales de zod fallaban si la clave no venía en el payload. | Pruebas unitarias de esquemas | `.optional()` antes de `.transform()`. |
| 3 | Onboarding de empresa/universidad con sitio web vacío lanzaba excepción (`new URL('')` dentro de un *refine*). | E2E contra Supabase real (registro nuevo) | *Refine* sin excepciones + pruebas de regresión. |
| 4 | Redirecciones desde rutas de servidor cambiaban de host (`localhost` vs `127.0.0.1`) y perdían la cookie; la guía no aparecía en el paso 8. | E2E de demo guiada | Redirecciones relativas. |
| 5 | Nombres de archivo con rutas generaban extensiones extrañas. | Unitarias | Se usa sólo el último segmento. |
| 6 | Guardas de redirección incompletas (tabs/saltos de línea). | Revisión + unitarias | `safeNextPath` único. |
| 7 | Avisos de React por `setState` en efectos (lint). | ESLint | Patrones de estado derivado / `useSyncExternalStore`. |
| 8 | Pluralización «1 credenciales», habilidades declaradas duplicadas como verificadas, fechas partidas en tablas. | Revisión visual de capturas | Ajustes de UI e i18n. |

## 5. Sondeo de la API de Supabase (PostgREST real)

| Petición | Esperado | Obtenido |
|---|---|---|
| `anon` → `GET /rest/v1/profiles` | denegado | `42501 permission denied for table profiles` |
| `anon` → `rpc/sp_admin_list` | denegado | `42501 permission denied for function` |
| `anon` → `rpc/sp_public_credential` | datos públicos acotados | ✔ titular, proyecto, competencias |
| estudiante → `GET /rest/v1/vath_entries` | sólo propias | ✔ 12 filas, 1 estudiante (ella misma) |
| estudiante → `PATCH /rest/v1/profiles` (`role=admin`) | denegado | `42501 permission denied` |
| estudiante → `POST /rest/v1/credentials` | denegado | `42501 permission denied` |

## 6. Revisión visual

Se revisaron capturas de escritorio (1440 px) y móvil (Pixel 7) de: landing, demo, tableros de los 5 roles, explorar retos, detalle de reto, formulario de reto, workspace (todas las pestañas), validación, SkillPass, verificación pública con QR, perfil, talento, organización, notificaciones y las 11 secciones de Talent OS.

## 7. No probado / limitaciones de QA

- Proyecto Supabase **en la nube** (se probó con el stack oficial local; el comportamiento es el mismo, pero faltan SMTP real, dominios y límites del plan).
- Confirmación por correo (el stack local la desactiva por defecto) y recuperación de contraseña de punta a punta.
- `Dockerfile`: no se construyó en este entorno (el proxy TLS impide `npm ci` dentro del contenedor); los comandos que ejecuta (`npm ci`, `npm run build`, `next start`) sí se probaron fuera de Docker.
- Navegadores distintos de Chromium y lectores de pantalla reales (se validaron roles/etiquetas ARIA por selectores accesibles).
- Pruebas de carga.
