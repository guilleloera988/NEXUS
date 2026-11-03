# Flujos de experiencia (UX)

Los 9 módulos de referencia («Paso 1…9 de 9») están implementados como pantallas reales con datos persistentes. Esta guía describe cada flujo, la ruta y qué valida la base de datos.

## Mapa de pantallas por rol

| Rol | Navegación |
|---|---|
| Estudiante | Inicio · Explorar retos · Mis retos · Mi perfil · Mi SkillPass · Notificaciones |
| Empresa | Inicio · Mis retos · Crear reto · Validaciones · Talento verificado · Mi organización · Notificaciones |
| Supervisor | Inicio · Validaciones · Retos · Talento verificado · Mi organización · Notificaciones |
| Universidad | Analítica · Retos · Mi organización · Mi perfil · Notificaciones |
| Admin AINDEV | Resumen · Usuarios · Organizaciones · Retos · Validaciones · SkillPass/credenciales · Competencias · Incidentes · Bitácora · Talento |

Público: `/` (landing), `/demo`, `/login`, `/signup`, `/verify`, `/verify/[código]`, `/skillpass/[slug]`.

## Paso 1 · Inicio y registro

- **Landing** (`/`): «Demuestra lo que sabes hacer.» / «SkillPass convierte proyectos reales en experiencia profesional verificada.» (en inglés: «Prove what you can do.» / «SkillPass turns real-world projects into verified professional experience.»), CTAs «Explorar SkillPass» y «Ver demo», cómo funciona (reto → evidencia → validación → verificado → oportunidad), «¿Por qué SkillPass?» (autodeclarado vs aplicado verificado), lo que no es, principios (trabajo justo, privacidad, IP), modelo de colaboración (universidades, empresas y programas; el estudiante no es quien paga).
- **Registro** (`/signup`): tipo de cuenta Estudiante / Empresa / Universidad (supervisor sólo por invitación de una organización verificada: el invitado elige «Empresa», o «Universidad» si lo invitó una institución, y usa el correo invitado; admin nunca). Supabase Auth con confirmación de correo → pantalla «Revisa tu correo» (`/signup/check-email`: correo usado, pasos, reenvío) → enlace del correo, válido en cualquier dispositivo → `/auth/callback` → onboarding. Un inicio de sesión con el correo sin confirmar vuelve a esa pantalla; un enlace vencido o usado lleva a `/login` con explicación.
- **Onboarding** (`/onboarding`): estudiante (universidad opcional con explicación de qué verá, carrera, semestre, intereses ≤ 6, habilidades declaradas, disponibilidad, opt-in a Talento verificado); empresa/universidad (organización que queda «Pendiente de verificación»; la empresa debe indicar su **sitio web** completo con `https://` y sin `@` (el navegador lo comprueba y la regla aparece bajo el campo) y la universidad puede omitirlo, regla que también aplica al guardar «Mi organización»); personal invitado (nombre y puesto).

## Doble factor (admin y supervisores)

`/mfa`: con la verificación en dos pasos activa (producción), admins y supervisores pasan por aquí al entrar. La primera vez configuran una app de autenticación (QR y clave para escribir a mano, luego un código de 6 dígitos); después sólo escriben el código. Quien revise una validación sin ese paso ve un aviso con el enlace **Verificar ahora** en lugar del formulario. La demo no lo pide.

## Paso 2 · Perfil de talento

`/profile`: tarjeta de identidad, mini SkillPass (VATH, proyectos, competencias verificadas), **Competencias verificadas** (con nivel y etiqueta de rúbrica) separadas de **Habilidades declaradas** (sólo las aún no verificadas), intereses, retos con estado y resumen VATH. `?edit=1` abre el formulario. Bajo «Universidad» se ve el estado de la vinculación: verificada (por correo institucional o por la universidad), solicitud pendiente (no cuenta en la analítica de la universidad ni se muestra en el SkillPass público) o no aprobada.

## Paso 3 · Retos y matching

- `/challenges` (estudiante): tarjetas con anillo de compatibilidad, empresa verificada, VATH estimadas, duración, lugares, filtros por texto/industria/modalidad/competencia.
- `/challenges/[id]`: problema, objetivo, competencias requeridas, entregables, condiciones, compensación, IP, confidencialidad, publicación; panel **¿Por qué esta compatibilidad?** con desglose de reglas; aplicación con motivación (20–2000 caracteres).
- Empresa: `/challenges/new` y `/edit` (formulario por secciones con alerta de trabajo justo), pestañas Candidatos (preseleccionar/aceptar/no seleccionar con nota), Equipo e **Historial de decisiones**; control de ciclo de vida con transiciones permitidas.
- **Borrador y publicación**: un borrador se guarda con sólo nombre, problema y objetivo («Guardar borrador»). Para publicarlo necesita resumen, descripción, industria, ubicación (salvo modalidad remota), condiciones de participación, al menos una competencia y un entregable, supervisor y fechas de inicio y fin. En un borrador, el formulario lo avisa arriba («Puedes guardar el borrador incompleto…»), marca esos campos y secciones con «(necesario para publicar)» y lista en la barra inferior lo que falta («Para publicar, completa: …»; en el celular, «Faltan N datos para publicar»); «Publicar y abrir convocatoria» (al crear, con la organización verificada) queda deshabilitado mientras falte algo. En `/challenges/[id]`, el panel **Ciclo de vida** muestra la lista («Para publicar, completa:» en un borrador; «Para abrir la convocatoria, completa:» en un reto publicado o en curso sin convocatoria) y deshabilita «Mover a: Convocatoria abierta» y, en un borrador, «Mover a: Publicado» (archivar, iniciar o cerrar la convocatoria siguen disponibles). Si «Publicar y abrir convocatoria» guarda el borrador pero la base rechaza la publicación, la página del reto explica por qué. Al editar un reto que ya no es borrador, esos campos son obligatorios (*), la barra inferior muestra «Al reto le falta: …» y «Guardar cambios» se deshabilita hasta completarlo. La base de datos aplica la misma regla y responde «Al reto le falta: <primer faltante> (necesario para publicarlo o mantenerlo publicado).» ([DATABASE](DATABASE.md#reglas-para-publicar-un-reto)).

## Paso 4 · Workspace

`/workspace/[id]`: pestañas Resumen (avance, hitos por entregable, actividad reciente: cada estudiante ve sus propias validaciones y sólo la evidencia ya enviada de sus compañeros), Tareas (crear, asignar, estados), Evidencias, VATH, Equipo y Validación. Revisores ven una vista de supervisión con acceso a la bandeja.

## Paso 5 · Evidencias y VATH

- **Evidencia**: archivo (PDF, imágenes, Office, CSV, TXT, ZIP; verificado por contenido) o enlace https; **Tarea relacionada** siempre obligatoria y **Entregable relacionado** obligatorio cuando el reto tiene entregables (si no tiene, esa lista no aparece). Ambas listas empiezan en «Selecciona…» y la evidencia no se guarda sin elegirlas; al elegir la tarea se llena su entregable. Si el reto aún no tiene tareas, el diálogo no muestra el formulario: pide crear primero la tarea y enlaza a la pestaña Tareas («Ir a Tareas»). Competencias que demuestra (opcionales); versión nueva sobre una anterior («Subir nueva versión» propone la tarea y el entregable de la anterior si siguen existiendo); «permitir mostrarla en mi SkillPass público» sólo si el reto lo permite. El servidor y la base de datos exigen lo mismo («Completa el campo obligatorio: tarea relacionada.»).
- **VATH**: fecha, actividad, horas (0.25 h), descripción y evidencias vinculadas obligatorias; reglas visibles (≤ 16 h/día, sin fechas futuras ni duplicados).
- **Enviar a validación**: resumen de lo que se enviará al supervisor; tras enviar, los registros quedan «En validación».

## Paso 6 · Validación del supervisor

`/validations` (bandeja) → `/validations/[id]`:
1. Evidencias: aprobar / solicitar cambios / rechazar (comentario obligatorio salvo aprobar).
2. Horas VATH: verificar / ajustar (horas verificadas < declaradas) / rechazar, con comentario obligatorio al ajustar o rechazar; «verificar todas».
3. Competencias: rúbrica 1–5 por competencia del reto («nivel 3+ convierte la competencia en verificada»), nivel previo visible.
4. Retroalimentación y **emitir credencial** (marca la participación como completada).
Al completar: mensaje de éxito con el código de credencial y bitácora de decisiones.

## Paso 7 · SkillPass y credencial verificable

- `/my-skillpass`: totales (VATH en credenciales, VATH verificadas, proyectos, competencias), pestañas Credenciales (tarjeta negra/dorada con QR, ID, emisión, validador, competencias), Competencias verificadas, En progreso y Privacidad (SkillPass público, mostrar universidad/carrera, verificación por credencial, evidencia pública).
- Acciones: Ver en línea, Copiar enlace, Compartir (nativo), Descargar/Imprimir PDF (hoja de impresión optimizada).
- `/verify/[código]` (público): estado (válida / revocada / no encontrada), titular, proyecto, organización, periodo, VATH, competencias, validador (en credenciales confidenciales: «Proyecto confidencial», industria y «Responsable de la empresa (confidencial)», sin empresa, fechas ni modalidad), cómo se verificó, aviso de no certificación oficial, QR que apunta a la misma URL.
- `/skillpass/[slug]` (público, opt-in): experiencia verificada, proyectos, competencias y evidencia publicada.

## Paso 8 · Panel empresa

`/dashboard` (empresa/supervisor): retos activos, candidatos, validaciones pendientes, evidencias por revisar, retos terminados, credenciales emitidas, accesos rápidos y aviso si la organización no está verificada. `/talent`: talento verificado (sólo estudiantes con opt-in, sólo para empresas verificadas, orden alfabético por defecto, filtros por evidencia, sin atributos sensibles) e invitación a aplicar.

## Paso 9 · Panel universidad

`/dashboard` (universidad): estudiantes participando, VATH verificadas, competencias verificadas, credenciales; gráficas de VATH por carrera, competencias más verificadas, empresas aliadas en retos y participación por mes (un solo tono dorado, tooltips, **ver como tabla**); tabla por estudiante y exportación CSV. Todo calculado con registros reales (consultas agregadas con RLS), sólo de estudiantes con vinculación verificada. Arriba, **Solicitudes de estudiantes**: quienes eligieron la institución sin correo institucional, con nombre, correo, carrera y semestre, y los botones **Aprobar** / **Rechazar**; en la tabla de estudiantes, **Quitar** (con confirmación). En `/organization`, dueños y managers registran los **dominios de correo institucional** que vinculan al instante.

## Admin · Talent OS

`/dashboard` (admin) con métricas del ecosistema, organizaciones por verificar, incidentes y bitácora reciente; `/admin/[sección]` con búsqueda, filtros por estado, paginación y acciones (cambiar rol, verificar/rechazar organización, revocar credencial con motivo, crear/editar competencias, gestionar incidentes).

## Estados vacíos, errores y feedback

- Estados vacíos con explicación y siguiente acción.
- Errores traducidos por campo/clave; `error.tsx` y `global-error.tsx` con reintento; `not-found.tsx` de marca.
- Mensajes de éxito con `aria-live`; botones con estado de envío; redirecciones con `?done=1` / `?submitted=1` para no perder la confirmación.
- Notificaciones en la campana y en `/notifications` (aplicación recibida/decidida, asignación, validación solicitada/completada, credencial emitida/revocada, invitaciones).

## Accesibilidad y responsive

Skip link, foco visible dorado, etiquetas en todos los controles, roles ARIA en grupos segmentados y rúbrica, diálogos nativos (un formulario largo se desplaza dentro del diálogo, con una sola barra), contraste AA, movimiento reducido. Diseño probado a 390 px (Pixel 7) sin scroll horizontal y con menú móvil (prueba E2E).
