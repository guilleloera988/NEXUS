# Estado del producto

Leyenda: **COMPLETE** (funcional, persistente, probado) · **PARTIAL** (funcional con huecos señalados) · **DEMO ONLY** (sólo con datos/entorno demo) · **ROADMAP** (no implementado a propósito) · **BLOCKED** (requiere algo externo).

## Matriz por módulo

| # | Módulo | Estado | Notas |
|---|---|---|---|
| 1 | Autenticación (registro, login, recuperación, callback) | **COMPLETE** | Supabase Auth; registro/onboarding/logout/login probados E2E contra Supabase real. Tras el registro, pantalla «Revisa tu correo» con reenvío; enlaces de correo con `token_hash` válidos en cualquier dispositivo (probado el 8 oct contra el Supabase de producción). Recuperación por correo: envío real probado; el cambio de contraseña desde el enlace no se ha recorrido de punta a punta. |
| 2 | Onboarding por tipo de cuenta | **COMPLETE** | Estudiante, empresa, universidad y personal invitado. La empresa debe indicar su sitio web (https); la universidad puede omitirlo (retroalimentación del 15 oct). |
| 3 | Dashboard estudiante | **COMPLETE** | Progreso, VATH, competencias, siguiente paso. |
| 4 | Perfil de talento (declarado vs verificado) | **COMPLETE** | |
| 5 | Retos industriales (campos, estados, ciclo de vida) | **COMPLETE** | 7 estados con transiciones en BD; trabajo justo; IP/confidencialidad/publicación. El borrador se guarda incompleto; sólo se publica completo (retroalimentación del 15 oct). |
| 6 | Descubrimiento con Skills Match por reglas | **COMPLETE** | Explicado en UI; no se presenta como IA. |
| 7 | Matching / asignación con historial | **COMPLETE** | Preselección, aceptación, rechazo con nota, cupo, historial auditado. |
| 8 | Workspace (Overview/Tasks/Evidence/VATH/Team/Validation) | **COMPLETE** | |
| 9 | Evidencias (archivo/enlace, estados, versiones, visibilidad) | **COMPLETE** | Storage probado con Supabase real. Sin antivirus (ver SECURITY). Cada evidencia nombra su tarea y, si el reto tiene entregables, su entregable (retroalimentación del 15 oct). |
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
| — | Deployment Vercel + Supabase | **COMPLETE** | Producción en https://skillpass.aindev.com.mx (Vercel `skillpass-prod` + Supabase `aapwypujznnkxkjdbmsu`, `NEXUS_DEMO_MODE=off`, 14 migraciones (la 14.ª, `20261015000001`, aplicada el 15 oct), sin datos demo). Demo en https://skillpass-demo.vercel.app. Ver DEPLOYMENT §8–9. Ambos en planes gratuitos: pasar a Pro antes de abrir a usuarios reales. |
| — | Dominio `skillpass.aindev.com.mx` + SSL | **COMPLETE** | CNAME a Vercel (HostGator); certificado de Vercel con renovación automática; asignado al proyecto de producción el 8 oct; Auth de producción con *Site URL* y *Redirect URL* del dominio. |
| — | Correo transaccional propio (SMTP) | **COMPLETE** | Resend con dominio `aindev.com.mx` verificado (DKIM/SPF en HostGator), remitente `noreply@aindev.com.mx`; envío real probado el 8 oct. Plan gratuito: 100 correos/día. |
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

## Retroalimentación del 15 oct 2026

Observaciones del responsable de producto (documento «Retroalimentación de SkillPass», con capturas) y cómo se resolvió cada una. Pruebas: E2E de las cuatro en `e2e/feedback.spec.ts` (más FLOW 01 y 03 de `critical-flow.spec.ts` y el registro de empresa de `auth-supabase.spec.ts`), de base de datos de las reglas 2–4 (PGlite y PostgreSQL 16) y unitarias de `task_id` y de `src/lib/challenge-readiness.ts`.

| # | Observación | Resolución |
|---|---|---|
| 1 | Al subir una versión nueva de una evidencia, el diálogo mostraba dos barras de desplazamiento que hacían lo mismo (una desaparecía al intentar guardar sin archivo). | El contenedor con scroll del diálogo (`Dialog`, `src/components/ui/interactive.tsx`) ahora es `relative`: las casillas ocultas de los chips de competencias ya no hacen crecer el `<dialog>`, así que sólo se desplaza el contenido, con una barra. Sin cambios en la base de datos. |
| 2 | Una evidencia se guardaba con sólo título y archivo; debía exigir la tarea relacionada. | «Tarea relacionada» siempre obligatoria y «Entregable relacionado» obligatorio cuando el reto tiene entregables; ambas listas empiezan en «Selecciona…». Al elegir la tarea se llena su entregable. Si el reto aún no tiene tareas, el diálogo pide crear una y enlaza a la pestaña Tareas. También lo exigen zod (`task_id`) y `sp_add_evidence` / `sp_update_evidence` (`sp:field_required`). |
| 3 | Se podía crear una cuenta de empresa sin sitio web. | Sitio web (https) obligatorio para empresas en el onboarding y en «Mi organización»; lo revisan también la acción `completeOnboarding`, `sp_complete_onboarding` y `sp_update_organization` (`sp:field_required`; `sp:invalid_field` si no empieza con `https://` o contiene `@`); el navegador ya rechaza `http://` y explica la regla bajo el campo. Para universidades sigue siendo opcional. Las 3 empresas del seed tienen sitio `https://….example`. |
| 4 | Se podía subir un reto con sólo título, problema y objetivo; debía pedir dirección, requerimientos y normas antes de publicarse. | El borrador se sigue guardando incompleto, pero para pasar a Publicado o Convocatoria abierta necesita resumen, descripción, industria, ubicación (salvo modalidad remota), condiciones de participación, al menos una competencia y un entregable, supervisor y fechas. El formulario marca esos campos «(necesario para publicar)» y deshabilita «Publicar y abrir convocatoria» mientras falte algo; el panel «Ciclo de vida» lista lo que falta («Para publicar, completa:» o «Para abrir la convocatoria, completa:») y deshabilita esas transiciones. `sp_set_challenge_status` lo exige al abrir el reto (de borrador a Publicado, o a Convocatoria abierta desde cualquier estado; `sp:challenge_incomplete` con el primer faltante) y `sp_save_challenge` impide dejar incompleto un reto que ya no es borrador. Detalle: [DATABASE](DATABASE.md#reglas-para-publicar-un-reto). |

**Despliegue.** Las reglas 2–4 también viven en la base de datos, en la migración `20261015000001_feedback_required_fields.sql`. El código se desplegó primero (el *push* a la rama de producción despliega la app, y la app funciona con la base sin migrar: el formulario y las acciones del servidor ya aplican las reglas; los mensajes de una base antigua sin campo se muestran con el texto general). La migración se **aplicó en producción el 15 oct** (`skillpass-prod`, Supabase `aapwypujznnkxkjdbmsu`) por la Management API, en una sola transacción que comprobó antes que estuvieran exactamente las 13 migraciones anteriores y las seis funciones sin cambios, y después permisos, dueños y cuerpos: 14 de 14 comprobaciones de verificación correctas y ningún aviso nuevo en el *Security Advisor* (detalle en DEPLOYMENT §9). En el proyecto de demo no se puede aplicar desde este entorno (igual que H-6, OI-11): hay que hacerlo desde el SQL editor del panel de Supabase, después de `20261008000001`. Las filas ya guardadas no se revisan hasta que cambian: una empresa sin sitio web tendrá que escribirlo la próxima vez que guarde «Mi organización» (en producción hay una), un borrador incompleto sigue siendo borrador hasta completarlo y un reto publicado incompleto tendrá que completarse al editarlo.

## Problemas abiertos

| ID | Severidad | Descripción | Próximo paso |
|---|---|---|---|
| OI-01 | Media | Producción desplegada (8 oct) pero en planes gratuitos: Supabase Free se pausa tras 7 días sin uso y no tiene respaldos diarios; Vercel Hobby no admite uso comercial. | Pasar Supabase `skillpass-prod` y el equipo de Vercel a Pro antes de abrir a usuarios reales. |
| OI-02 | Resuelto (8 oct) | URLs de Auth de producción apuntan a `https://skillpass.aindev.com.mx` (y la demo conserva las suyas). | — |
| OI-03 | Media | CSP con `'unsafe-inline'` en scripts. | Nonces vía `proxy.ts`. |
| OI-04 | Media | *Rate limiting* en memoria por instancia. | Limitador compartido + CAPTCHA de Supabase Auth. |
| OI-05 | Media | Sin escaneo antivirus de archivos subidos. | Integrar escaneo antes de exponer archivos a revisores. |
| OI-06 | Media | Textos legales (privacidad, términos, IP) pendientes. | Decisión legal de AINDEV. |
| OI-07 | Baja | La DEMO local usa ~42 MB de disco por escenario. | Ajustar límites o implementar snapshot comprimido. |
| OI-08 | Baja | `Dockerfile` no construido en este entorno. | Construir en CI o en la máquina del operador. |
| OI-09 | Baja | Cambio de contraseña desde el enlace de recuperación sin prueba de punta a punta (el envío del correo sí se probó). | Recorrerlo en producción con una cuenta de prueba. |
| OI-10 | Resuelto | Hallazgos de seguridad H-1…H-5 corregidos (`20261007000003`…`07`) con pruebas de regresión y aplicados en la demo. | — |
| OI-11 | Baja | H-6 corregido (`20261008000001`, con prueba de regresión) y aplicado en producción el 8 oct. Falta en la demo, que ya no acepta cambios desde el entorno de despliegue: no tiene datos reales, pero conviene aplicarla desde el panel de Supabase. Quedan los riesgos bajos R-1…R-6. | Aplicar `20261008000001` en el proyecto de demo; ver SECURITY §6. |
| OI-12 | Baja | La migración `20261015000001` (retroalimentación del 15 oct) está aplicada en producción (15 oct, 14 de 14 comprobaciones correctas) pero falta en la demo, que ya no acepta cambios desde el entorno de despliegue: mientras falte, la base de la demo no exige tarea y entregable en la evidencia ni sitio web de empresa, y para publicar un reto sólo pide competencias, entregables, supervisor y fechas (la app sí aplica esas reglas). | Aplicarla en la demo desde el panel de Supabase, después de `20261008000001`. |
