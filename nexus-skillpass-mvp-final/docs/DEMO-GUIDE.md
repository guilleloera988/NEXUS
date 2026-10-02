# Guía de demo

Guion para presentar SkillPass a universidades, empresas, evaluadores e inversionistas en **3 a 8 minutos**. Todos los datos son ficticios y están marcados como DEMO.

## Preparación

| Entorno | Cómo |
|---|---|
| Local | `npm ci && npm run dev` → `http://127.0.0.1:3000/demo` (la primera entrada construye la plantilla ~5–8 s; después ~1–3 s). |
| Servidor de demo | URL pública configurada según [DEPLOYMENT.md](DEPLOYMENT.md). |

- Usa **«Iniciar demo guiada»**: crea un escenario nuevo y aislado para ti; nada de lo que hagas afecta a otros visitantes.
- La barra dorada superior permite **cambiar de persona** (Estudiante, Empresa, Supervisor, Universidad, Admin AINDEV) sin perder el escenario.
- «Salir de la demo» borra la cookie; el escenario expira solo (`NEXUS_DEMO_TTL_HOURS`).
- Idioma: botón `EN`/`ES` en la cabecera.

## Personas ficticias

| Persona | Rol | Qué mostrar |
|---|---|---|
| María Torres | Estudiante (Ingeniería en Sistemas, Demo University) | Tablero, reto en curso, workspace, SkillPass con 1 credencial. |
| Laura Ríos | Empresa (Nova Manufacturing, verificada) | Crear/publicar retos, candidatos, talento verificado. |
| Carlos Méndez | Supervisor (Nova Manufacturing) | Bandeja de validación, rúbrica, emisión de credenciales. |
| Dra. Elena Vázquez | Universidad (Demo University) | Analítica institucional y CSV. |
| Equipo AINDEV (DEMO) | Admin | Talent OS: verificación de organizaciones, credenciales, bitácora. |

Credencial precargada para verificación: **`SKP-2026-4A7C-91D2`**.

## Demo guiada (9 pasos)

| # | Paso | Persona · Pantalla | Qué decir / hacer |
|---|---|---|---|
| 1 | Conoce a la estudiante | María · Tablero | Progreso del reto, VATH verificadas vs en validación, competencias verificadas. «Nada aquí es autodeclarado sin marcarlo como tal.» |
| 2 | Explora el reto | María · *Commercial Process Automation* | Problema real, competencias, entregables, compensación, **propiedad intelectual** y confidencialidad. Abre «¿Por qué esta compatibilidad?»: reglas transparentes, **no IA**. |
| 3 | Revisa el trabajo | María · Workspace | Hitos por entregable, tareas, equipo y actividad. |
| 4 | Inspecciona la evidencia | María · Evidencias | Archivos verificados por contenido y enlaces. Agrega una evidencia con un enlace `https://…`. |
| 5 | Verifica VATH | María · Validación | Horas declaradas separadas de verificadas, vinculadas a evidencia. Pulsa **Enviar a validación**. |
| 6 | Valida competencias | Carlos · Validaciones | Abre la solicitud de María: verifica/ajusta horas (ajustar exige comentario), aprueba evidencia, evalúa con la rúbrica 1–5 (nivel 3+ = verificada), marca **emitir credencial** y completa. |
| 7 | Abre el SkillPass | María · Mi SkillPass | La credencial nueva aparece con VATH y competencias; muestra **Privacidad** (todo lo público es opt-in, verificación por credencial). |
| 8 | Verifica la credencial | Página pública | Se abre sin sesión; escanea el **QR** con el teléfono: apunta a esta misma URL. Muestra «no es certificación oficial». |
| 9 | Analítica institucional | Elena · Analítica | VATH por carrera, competencias más verificadas, empresas y participación: cifras calculadas con los registros reales del escenario (cambiaron tras tu validación). Botón «Ver como tabla» y CSV. |

## Variantes según audiencia

- **Universidad (5 min):** pasos 1, 7, 8, 9 + privacidad (la universidad no ve evidencia privada ni horas individuales).
- **Empresa (5 min):** como Laura, crea un reto (alerta de trabajo justo si eliges «Sin compensación» y > 60 VATH), revisa candidatos con historial de decisiones, explora Talento verificado; como Carlos, valida.
- **Inversionistas (3 min):** problema (habilidades autodeclaradas) → pasos 2, 6, 8 (verificación pública con QR) → 9 (datos institucionales) → modelo de colaboración en la landing (el estudiante no paga).
- **Evaluación técnica:** Admin → `/admin/audit` (bitácora inmutable), `/admin/credentials` (revocar con motivo y ver el efecto en `/verify/<código>`), y mostrar que una cuenta de otra organización no puede abrir validaciones ajenas.

## Mensajes clave (y lo que **no** se dice)

- ✔ «Experiencia aplicada verificada por una persona autorizada, con evidencia y bitácora.»
- ✔ «VATH = horas de trabajo real verificadas; no es calificación ni crédito académico.»
- ✔ «El estudiante decide qué es público.»
- ✘ No decir que hay IA (el matching es por reglas).
- ✘ No presentar los datos DEMO como clientes, convenios o tracción reales.
- ✘ No prometer empleo ni equivalencia con certificaciones oficiales.

## Solución de problemas

| Síntoma | Solución |
|---|---|
| «El escenario DEMO expiró» | Volver a `/demo` e iniciar uno nuevo. |
| La primera entrada tarda | Es la construcción de la plantilla; `npm run seed` la precalienta. |
| Quiero empezar de cero | «Salir de la demo» y «Iniciar demo guiada» (crea escenario nuevo) o `npm run demo:reset`. |
| La guía se ocultó | Botón flotante «Mostrar guía» (abajo a la derecha). |
