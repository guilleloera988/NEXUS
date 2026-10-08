# SkillPass by AINDEV NEXUS

**Prove what you can do.** SkillPass convierte retos reales de empresas en experiencia profesional verificada.

```
RETO INDUSTRIAL → TRABAJO APLICADO → EVIDENCIA → VATH → VALIDACIÓN DEL SUPERVISOR
→ COMPETENCIAS VERIFICADAS → SKILLPASS → OPORTUNIDADES
```

MVP funcional (no maquetas) de **Skills Intelligence + Employability + Applied Experience Verification** para universidades, estudiantes, empresas, evaluadores e inversionistas. AINDEV TECH es la empresa tecnológica detrás de la plataforma.

> Todos los datos precargados son **ficticios** (marcados `is_demo` y con la etiqueta «DEMO · Datos ficticios»). No representan tracción, convenios, empresas, universidades ni resultados reales.

---

## Índice

1. [Problema y solución](#problema-y-solución) · 2. [Arquitectura](#arquitectura) · 3. [Stack](#stack) · 4. [Roles](#roles) · 5. [Flujo principal](#flujo-principal) · 6. [VATH](#vath) · 7. [Instalación](#instalación) · 8. [Variables de entorno](#variables-de-entorno) · 9. [Base de datos y Supabase](#base-de-datos-y-supabase) · 10. [Seed](#seed) · 11. [Ejecutar](#ejecutar) · 12. [Pruebas](#pruebas) · 13. [Build](#build) · 14. [Deployment](#deployment) · 15. [Demo](#demo) · 16. [Seguridad](#seguridad) · 17. [Limitaciones conocidas](#limitaciones-conocidas) · 18. [Roadmap](#roadmap)

Documentación detallada en [`docs/`](docs): [ARCHITECTURE](docs/ARCHITECTURE.md) · [DATABASE](docs/DATABASE.md) · [UX-FLOWS](docs/UX-FLOWS.md) · [SECURITY](docs/SECURITY.md) · [DEPLOYMENT](docs/DEPLOYMENT.md) · [DEMO-GUIDE](docs/DEMO-GUIDE.md) · [ROADMAP](docs/ROADMAP.md) · [QA-REPORT](docs/QA-REPORT.md) · [STATUS](docs/STATUS.md).

---

## Problema y solución

**Problema.** Los currículos y perfiles profesionales están llenos de habilidades autodeclaradas y certificados de cursos sin trabajo aplicado. Para un reclutador o una universidad es difícil comprobar qué hizo realmente un estudiante, cuánto tiempo y con qué calidad.

**Solución.** SkillPass organiza el trabajo real en retos de empresas verificadas. Cada avance se respalda con evidencia, las horas aplicadas (VATH) se declaran y un supervisor autorizado las verifica, ajusta o rechaza, y evalúa competencias con una rúbrica 1–5. El resultado es un **SkillPass**: credenciales con código único y QR que cualquiera puede verificar sin iniciar sesión.

Lo que SkillPass **no** es: un LMS, una red social, una bolsa de empleo ni un generador de certificados. No promete empleo, no es certificación oficial ni equivale a créditos académicos.

## Arquitectura

```
Navegador ──► Next.js 16 (App Router, Server Components, Server Actions)
                 │  proxy.ts (sesión, rutas privadas)
                 │  src/lib/server/backend.ts  ← única puerta a la base de datos
                 │     · lista blanca de RPCs (lectura / escritura / públicas)
                 ▼
        ┌──────────────── modo Supabase ────────────────┐   ┌──── modo DEMO local ────┐
        │ Supabase Auth (JWT del usuario)                │   │ PGlite (PostgreSQL WASM) │
        │ PostgreSQL + RLS + RPCs SECURITY INVOKER/DEFINER│   │ una base aislada por      │
        │ Storage (bucket privado «evidence» + políticas) │   │ visitante, mismas          │
        └────────────────────────────────────────────────┘   │ migraciones y seed         │
                                                             └───────────────────────────┘
```

- **Toda** la lógica de negocio y autorización vive en PostgreSQL: RLS en las 24 tablas, grants sólo de `SELECT`, y mutaciones exclusivamente vía RPCs `SECURITY DEFINER` que validan rol, pertenencia, estado y reglas (trabajo justo, transiciones, inmutabilidad). El frontend nunca es la única barrera.
- La DEMO local ejecuta **exactamente** las mismas migraciones y el mismo seed que Supabase, así que RLS y RPCs se comportan igual.
- Detalle: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Stack

| Capa | Tecnología |
|---|---|
| Web | Next.js 16.3 (App Router, `proxy.ts`), React 19.3, TypeScript 6 estricto |
| UI | Tailwind CSS 4.3, lucide-react, Plus Jakarta Sans, QR SVG del lado del servidor (`qrcode`) |
| Validación | zod 4 (forma y tamaño) + RPCs SQL (reglas y autorización) |
| Datos | Supabase (Auth, PostgreSQL, Storage) · PGlite 0.5 para la DEMO local y pruebas |
| Pruebas | Vitest 5 (unitarias + base de datos), PostgreSQL 16 real (`npm run test:pg`), Playwright 1.63 (E2E) |
| i18n | Español (predeterminado) e inglés, diccionarios tipados con paridad verificada por pruebas |

## Roles

| Rol | Qué puede hacer |
|---|---|
| **Estudiante** | Perfil (declarado vs verificado), explorar retos con Skills Match transparente, aplicar, workspace (tareas, evidencias, VATH), enviar a validación, SkillPass y privacidad. |
| **Empresa** | Organización, crear/publicar retos (requiere verificación AINDEV), candidatos y decisiones con historial, equipo, talento verificado, invitaciones. |
| **Supervisor** | Bandeja de validación: verificar/ajustar/rechazar VATH, aprobar evidencia, evaluar competencias 1–5 y emitir credenciales. Sólo se obtiene por invitación de una organización verificada, registrándose como «Empresa» con el correo invitado. |
| **Universidad** | Analítica agregada de sus estudiantes (VATH por carrera, competencias, empresas, participación) y exportación CSV. Nunca lee evidencia ni horas individuales. |
| **Admin AINDEV** | Talent OS: verificación de organizaciones, usuarios y roles, retos, aplicaciones, evidencias, VATH, validaciones, competencias, credenciales (revocación), incidentes y bitácora de auditoría. Nunca se obtiene por registro. |

## Flujo principal

1. La **empresa** crea un reto (problema, objetivo, competencias, entregables, fechas, supervisor, compensación, propiedad intelectual, confidencialidad y permisos de publicación) y lo publica.
2. El **estudiante** lo descubre con un **Skills Match** basado en reglas (no IA): competencias 60 pts (verificada 100 %, declarada 60 %), intereses 15, carrera 10, disponibilidad 15.
3. La empresa acepta la aplicación; queda un historial de decisiones.
4. En el **workspace** el estudiante organiza tareas, sube **evidencias** (archivos verificados por contenido o enlaces https) y registra **VATH** vinculadas a evidencia.
5. Envía a validación; el **supervisor** revisa horas y evidencias, ajusta con justificación, evalúa competencias y emite la credencial.
6. El **SkillPass** se actualiza con el proyecto, las VATH verificadas y sólo las competencias con nivel ≥ 3.
7. Cualquiera verifica la credencial en `/verify/<código>` o escaneando el **QR**; la universidad ve la analítica actualizada.

Estados de reto: Borrador → Publicado → Convocatoria abierta → En curso → En revisión → Completado → Archivado (transiciones validadas en base de datos).

## VATH

**Verified Applied Talent Hours**: horas de trabajo aplicado en un reto real que un supervisor autorizado verificó.

- Se separan siempre `submitted_hours` (declaradas) y `verified_hours` (verificadas).
- 0.25–16 h por registro, sin fechas futuras ni duplicados, con al menos una evidencia vinculada.
- Ajustar o rechazar exige comentario; una vez decididas son inmutables (trigger en base de datos).
- VATH **no** es una calificación ni un crédito académico.

## Instalación

Requisitos: Node.js ≥ 22, npm. Opcional: PostgreSQL 15+ para `npm run test:pg`.

```bash
cd nexus-skillpass-mvp-final
npm ci
cp .env.example .env.local     # opcional para la DEMO local
npm run dev                    # http://127.0.0.1:3000
```

Abre `http://127.0.0.1:3000/demo`. La DEMO local no necesita Supabase ni secretos.

## Variables de entorno

Ver [`.env.example`](.env.example). Resumen:

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Origen público para enlaces y QR (p. ej. `https://skillpass.aindev.com.mx`). Se fija en build. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (o `_PUBLISHABLE_KEY`) | Proyecto Supabase. Sólo la llave **pública**: la app nunca usa la service-role en runtime. |
| `NEXUS_DEMO_MODE` | `local` (PGlite aislado por visitante), `supabase` (cuentas demo en un proyecto Supabase de demo) u `off`. |
| `NEXUS_DEMO_SECRET` | Firma HMAC de la cookie DEMO (≥ 32 caracteres). |
| `NEXUS_DEMO_PASSWORD` | Contraseña de las cuentas ficticias en modo `supabase`. |
| `MAX_UPLOAD_MB` | Tamaño máximo de evidencia (≤ 4 en Vercel). |
| `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL` | **Sólo** en la máquina del operador para `npm run seed -- --supabase`. Nunca en Vercel ni en git. |

## Base de datos y Supabase

- Migraciones en [`supabase/migrations`](supabase/migrations): esquema (24 tablas, triggers de integridad), seguridad (helpers + políticas RLS + grants), RPCs de flujo, RPCs de lectura y Storage; después, rendimiento (RLS con *InitPlan*, índices de llaves foráneas) y las correcciones de la revisión de seguridad H-1…H-5 ([SECURITY §6](docs/SECURITY.md)).
- Aplicar en Supabase: `supabase link --project-ref <ref>` y `supabase db push` (o `npm run seed -- --supabase --confirm-demo-project --apply-migrations` en un proyecto de demo vacío).
- En Supabase Auth: habilitar email/password, configurar *Site URL* = `NEXT_PUBLIC_APP_URL` y *Redirect URL* `…/auth/callback`.
- Detalle de tablas, RLS y RPCs: [docs/DATABASE.md](docs/DATABASE.md).

## Seed

```bash
npm run seed           # reconstruye la plantilla DEMO local (PGlite) e imprime un resumen
npm run demo:reset     # borra todos los escenarios DEMO locales
npm run seed -- --supabase --confirm-demo-project   # carga la demo en un proyecto Supabase DEDICADO de demo
```

El modo Supabase crea las 16 cuentas ficticias con la Admin API, ejecuta `supabase/seed.sql` y sube los archivos de evidencia demo. Se niega a correr si el proyecto contiene cuentas que no son de demo.

## Ejecutar

| Comando | Descripción |
|---|---|
| `npm run dev` | Desarrollo (webpack) en `127.0.0.1:3000` |
| `npm run build && npm start` | Build y servidor de producción local |

## Pruebas

| Comando | Qué cubre | Resultado actual |
|---|---|---|
| `npm run lint` | ESLint (Next + React hooks) | 0 errores, 0 warnings |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` estricto | OK |
| `npm test` | 56 unitarias + 48 de base de datos (RLS, grants, FLOW 01–10, aislamiento, integridad, Storage y regresiones de la revisión de seguridad) en PGlite | 104/104 |
| `npm run test:pg` | Las 48 pruebas de base de datos sobre **PostgreSQL real** (levanta un cluster temporal o usa `TEST_DATABASE_URL`) | 48/48 en PG 16 (la corrida previa en PG 17.11, imagen de Supabase, fue con 39 pruebas) |
| `npm run test:e2e` | Playwright: FLOW 01–10 por la UI real (incl. decodificación del QR), seguridad, incidentes, demo guiada de 9 pasos y móvil; con `E2E_SUPABASE=1` además registro/login reales | 16/16 en DEMO local (+3 que requieren Supabase) · 17/17 contra Supabase local (2 oct) · contra la demo en la nube ver [QA-REPORT](docs/QA-REPORT.md) |

CI: [`.github/workflows/skillpass-quality.yml`](../.github/workflows/skillpass-quality.yml) (raíz del repositorio) corre todo lo anterior con un servicio PostgreSQL 16.

## Build

```bash
npm run build
```

Ver [QA-REPORT](docs/QA-REPORT.md) para la salida del último build.

## Deployment

Objetivo: `https://skillpass.aindev.com.mx` en Vercel + Supabase. Guía completa (proyecto Supabase, variables, dominio, SSL, checks y cómo hospedar la DEMO interactiva): [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Demo pública en **https://skillpass.aindev.com.mx** y **https://skillpass-demo.vercel.app** (Supabase de demo; detalle en [DEPLOYMENT §8](docs/DEPLOYMENT.md#8-despliegue-actual--demo-pública)).

## Demo

`/demo` ofrece una **demo guiada de 9 pasos** (Conoce a la estudiante → Explora el reto → Revisa el trabajo → Inspecciona la evidencia → Verifica VATH → Valida competencias → Abre el SkillPass → Verifica la credencial → Analítica institucional) y acceso directo a cada persona. Cada visitante obtiene un escenario aislado; cambiar de persona conserva el mismo escenario. Guion para presentaciones: [docs/DEMO-GUIDE.md](docs/DEMO-GUIDE.md).

## Seguridad

- RLS obligatorio en todas las tablas; los roles `anon`/`authenticated` sólo tienen `SELECT` y escriben únicamente por RPCs con autorización explícita.
- Ningún rol privilegiado se obtiene por metadatos de registro; supervisor sólo por invitación de una organización verificada, admin nunca. Las invitaciones no revelan si una cuenta existe ni cambian el rol de un miembro.
- Credenciales con snapshot inmutable; decisiones, evaluaciones y bitácora de sólo inserción.
- Subidas con lista blanca MIME, verificación por *magic numbers*, límite de tamaño y descargas por URL firmada tras una consulta con RLS.
- CSP estricta, HSTS, `nosniff`, `frame-ancestors 'none'`, CSV sin inyección de fórmulas, redirecciones sin *open redirect*.
- Detalle y resultados de la revisión: [docs/SECURITY.md](docs/SECURITY.md).

## Limitaciones conocidas

- `skillpass.aindev.com.mx` sirve hoy la DEMO (datos ficticios); producción con usuarios reales requiere un proyecto Supabase productivo y `NEXUS_DEMO_MODE=off` (ver [docs/STATUS.md](docs/STATUS.md)).
- El modo Supabase se verificó en un proyecto en la nube (FLOW 01–10 E2E contra la demo); falta SMTP propio y probar registro con confirmación por correo de punta a punta.
- La DEMO local necesita disco persistente (no corre en funciones serverless de Vercel); en Vercel se usa `NEXUS_DEMO_MODE=supabase` o `off`.
- Sin envío de correos propios (sólo los de Supabase Auth); notificaciones dentro de la app.
- Sin IA: el Skills Match es por reglas y se declara así.

## Roadmap

AI Skills Extraction, AI Matching, Advanced Skills Intelligence, Academy, Recruiting Marketplace, Talent OS completo, estándares de Verifiable Credentials (W3C VC / Open Badges 3.0), módulos de gobierno y Venture Studio. Ver [docs/ROADMAP.md](docs/ROADMAP.md).
