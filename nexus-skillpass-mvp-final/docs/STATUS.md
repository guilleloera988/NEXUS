# Estado del producto

Leyenda: **COMPLETE** (funcional, persistente, probado) · **PARTIAL** (funcional con huecos señalados) · **DEMO ONLY** (sólo con datos/entorno demo) · **ROADMAP** (no implementado a propósito) · **BLOCKED** (requiere algo externo).

## Matriz por módulo

| # | Módulo | Estado | Notas |
|---|---|---|---|
| 1 | Autenticación (registro, login, recuperación, callback) | **COMPLETE** | Supabase Auth; registro/onboarding/logout/login probados E2E contra Supabase real. Recuperación por correo implementada, no probada de punta a punta (sin SMTP). |
| 2 | Onboarding por tipo de cuenta | **COMPLETE** | Estudiante, empresa, universidad y personal invitado. |
| 3 | Dashboard estudiante | **COMPLETE** | Progreso, VATH, competencias, siguiente paso. |
| 4 | Perfil de talento (declarado vs verificado) | **COMPLETE** | |
| 5 | Retos industriales (campos, estados, ciclo de vida) | **COMPLETE** | 7 estados con transiciones en BD; trabajo justo; IP/confidencialidad/publicación. |
| 6 | Descubrimiento con Skills Match por reglas | **COMPLETE** | Explicado en UI; no se presenta como IA. |
| 7 | Matching / asignación con historial | **COMPLETE** | Preselección, aceptación, rechazo con nota, cupo, historial auditado. |
| 8 | Workspace (Overview/Tasks/Evidence/VATH/Team/Validation) | **COMPLETE** | |
| 9 | Evidencias (archivo/enlace, estados, versiones, visibilidad) | **COMPLETE** | Storage probado con Supabase real. Sin antivirus (ver SECURITY). |
| 10 | VATH (declaradas vs verificadas, reglas) | **COMPLETE** | |
| 11 | Validación del supervisor + auditoría | **COMPLETE** | Decisiones append-only, comentarios obligatorios. |
| 12 | Rúbrica de competencias 1–5 | **COMPLETE** | Verificada ⇔ nivel ≥ 3 por supervisor autorizado. |
| 13 | SkillPass (`/my-skillpass`, `/skillpass/[slug]`) | **COMPLETE** | Privacidad opt-in; impresión a PDF desde el navegador. |
| 14 | Verificación pública `/verify/[código]` con QR real | **COMPLETE** | QR decodificado en E2E; revocación reflejada. |
| 15 | Explorador de talento verificado | **COMPLETE** | Opt-in, sólo empresas verificadas, sin ranking opaco. |
| 16 | Dashboard empresa | **COMPLETE** | |
| 17 | Dashboard universidad + CSV | **COMPLETE** | Agregados reales; nunca evidencia ni VATH individuales. |
| 18 | Admin Talent OS | **COMPLETE** | 11 secciones con búsqueda, filtros, paginación y acciones. |
| — | Demo `/demo` + guía de 9 pasos | **COMPLETE** · DEMO ONLY | Datos ficticios marcados; escenario aislado por visitante (local) o proyecto Supabase de demo. |
| — | Landing, i18n es/en, accesibilidad, responsive | **COMPLETE** | |
| — | Notificaciones en la app | **COMPLETE** | Sin correos propios (sólo los de Supabase Auth). |
| — | Incidentes (reporte y gestión) | **PARTIAL** | Reporte desde la app y gestión en admin; sin notificaciones por correo ni SLA. |
| — | Seed (`npm run seed`) local y Supabase | **COMPLETE** | Supabase probado contra el stack local oficial. |
| — | Pruebas (lint, tipos, unitarias, BD, E2E) y CI | **COMPLETE** | CI en `.github/workflows/skillpass-quality.yml`. |
| — | Deployment Vercel + Supabase | **PARTIAL** | Demo pública en https://skillpass.aindev.com.mx y https://skillpass-demo.vercel.app (Supabase de demo, FLOW 01–10 verificado E2E). Producción (`NEXUS_DEMO_MODE=off`, Supabase productivo) pendiente. Ver DEPLOYMENT §8. |
| — | Dominio `skillpass.aindev.com.mx` + SSL | **COMPLETE** | CNAME a Vercel configurado por el dueño (8 oct); certificado emitido por Vercel. Falta actualizar las URLs de Auth en Supabase (OI-02). |
| — | Correo transaccional propio (SMTP) | **BLOCKED** | Requiere proveedor/credenciales. |
| — | Aviso de privacidad, términos, acuerdos de IP | **BLOCKED** | Decisión legal de AINDEV. |
| — | Docker para la demo aislada | **PARTIAL** | `Dockerfile` incluido; no construido en este entorno (proxy TLS). |
| — | IA (extracción de skills, matching, resúmenes) | **ROADMAP** | Ver ROADMAP.md; nunca convertirá una habilidad en verificada. |
| — | Verifiable Credentials (W3C/Open Badges 3.0) | **ROADMAP** | El snapshot inmutable ya contiene los datos. |
| — | Academy, Marketplace, gobierno, Venture Studio, blockchain | **ROADMAP** | |

## Criterios GO del prompt

| Criterio | Estado |
|---|---|
| Proyecto ejecuta | ✔ `npm run dev` / `npm start` |
| Build pasa | ✔ |
| Autenticación funciona | ✔ (Supabase real local + DEMO) |
| Roles funcionan | ✔ 5 roles, probado en BD y E2E |
| RLS configurado | ✔ 24/24 tablas, sondeado vía PostgREST |
| Challenge flow | ✔ FLOW 01–02 |
| Evidence | ✔ FLOW 03 (PGlite y Supabase Storage) |
| VATH | ✔ FLOW 04 |
| Validation | ✔ FLOW 05–06 |
| SkillPass | ✔ FLOW 07 |
| Verificación pública | ✔ FLOW 08 |
| QR | ✔ FLOW 09 (decodificado) |
| Demo | ✔ guía de 9 pasos |
| Dashboards principales | ✔ 5 roles |
| Responsive mínimo | ✔ prueba móvil |
| Sin errores críticos en consola | ✔ E2E falla ante cualquier error de consola o HTTP ≥ 400 |
| Sin botones principales muertos | ✔ recorridos E2E y revisión visual |
| README actualizado | ✔ |

## Problemas abiertos

| ID | Severidad | Descripción | Próximo paso |
|---|---|---|---|
| OI-01 | Alta (bloqueante para producción) | Sólo la demo está desplegada (https://skillpass-demo.vercel.app); falta el proyecto Supabase productivo (`NEXUS_DEMO_MODE=off`). | Crear el proyecto productivo y seguir DEPLOYMENT.md §2–3. |
| OI-02 | Alta | DNS listo; Supabase Auth aún tiene *Site URL* y *Redirect URLs* sólo de `skillpass-demo.vercel.app`, así que confirmación de correo y recuperación de contraseña no vuelven a `/auth/callback` en el dominio nuevo. | *Site URL* `https://skillpass.aindev.com.mx` y agregar `https://skillpass.aindev.com.mx/auth/callback` (DEPLOYMENT §8). |
| OI-03 | Media | CSP con `'unsafe-inline'` en scripts. | Nonces vía `proxy.ts`. |
| OI-04 | Media | *Rate limiting* en memoria por instancia. | Limitador compartido + CAPTCHA de Supabase Auth. |
| OI-05 | Media | Sin escaneo antivirus de archivos subidos. | Integrar escaneo antes de exponer archivos a revisores. |
| OI-06 | Media | Textos legales (privacidad, términos, IP) pendientes. | Decisión legal de AINDEV. |
| OI-07 | Baja | La DEMO local usa ~42 MB de disco por escenario. | Ajustar límites o implementar snapshot comprimido. |
| OI-08 | Baja | `Dockerfile` no construido en este entorno. | Construir en CI o en la máquina del operador. |
| OI-09 | Baja | Recuperación de contraseña sin prueba de punta a punta. | Probar en staging con SMTP. |
| OI-10 | Resuelto | Hallazgos de seguridad H-1…H-5 corregidos (`20261007000003`…`07`) con pruebas de regresión y aplicados en la demo. | — |
| OI-11 | Media | H-6: la rama «talent pool» de `credentials_select` expone a empresas verificadas el *snapshot* de credenciales confidenciales; además riesgos bajos R-1…R-5. | Ver SECURITY §6. |
