# Roadmap post-MVP

El MVP demuestra primero **la verificación de experiencia aplicada**. Lo siguiente se documenta como roadmap y **no** se implementó (salvo donde se indica preparación estructural).

## Fase 1 · Endurecer para pilotos (0–3 meses)

| Tema | Detalle |
|---|---|
| Despliegue productivo | Supabase productivo + Vercel + dominio `skillpass.aindev.com.mx` (requiere credenciales y autorización DNS). |
| Legal y privacidad | Aviso de privacidad (LFPDPPP), términos de uso, acuerdos marco con empresas (IP, confidencialidad) y universidades. Decisión legal de AINDEV. |
| Correo transaccional | SMTP propio, plantillas de marca, recordatorios (validaciones pendientes, retos por cerrar). |
| Seguridad | CSP con nonce, *rate limiting* compartido, CAPTCHA en Auth, escaneo antivirus de archivos, MFA para admin y supervisores. |
| Operación | Monitoreo de errores, métricas de uso agregadas, backups/restore probados, panel de incidentes con SLA. |
| Producto | Edición de evidencia con versionado visible al revisor, comentarios en hilo por entregable, cierre masivo de retos, plantillas de retos. |

## Fase 2 · Skills Intelligence (3–9 meses)

Toda inferencia automática se mostrará separada de la validación humana y **nunca** marcará una competencia como «Verified».

| Módulo | Tarea concreta |
|---|---|
| AI Skills Extraction | Sugerir competencias a partir de la descripción del reto y de la evidencia (el supervisor confirma). |
| Evidence summarization | Resumen asistido de evidencia para acelerar la revisión (marcado como generado). |
| Challenge-to-skill mapping | Proponer la taxonomía de competencias y niveles requeridos al crear un reto. |
| AI Matching | Complementar el Skills Match por reglas con señales explicables; auditoría de sesgo y opción de desactivar. |
| Advanced Skills Intelligence | Mapas de brechas de competencias por programa académico y región (agregados, con umbrales de anonimato). |

## Fase 3 · Ecosistema (9–24 meses)

| Módulo | Descripción |
|---|---|
| Verifiable Credentials | Emitir credenciales como **W3C Verifiable Credentials / Open Badges 3.0** firmadas (DID del emisor), manteniendo la verificación por URL/QR. El snapshot inmutable actual ya contiene los datos necesarios. |
| Academy | Rutas formativas vinculadas a brechas detectadas (no reemplaza la verificación aplicada). |
| Recruiting Marketplace | Oportunidades para talento verificado con consentimiento explícito; sin pagos del estudiante. |
| Talent OS completo | Gestión de cohortes, programas institucionales, reportes para acreditación, API para ATS/SIS. |
| Módulos de gobierno | Programas públicos de empleabilidad y retos de innovación pública. |
| Venture Studio | Retos que evolucionan a proyectos de emprendimiento con acuerdos de IP específicos. |
| Blockchain | Sólo si un caso de uso lo justifica (p. ej. registro público de revocaciones); no por marketing. |

## Deuda técnica conocida

- Rutas de la DEMO local dependen de disco persistente; una variante «escenario en memoria + snapshot comprimido» reduciría ~42 MB → ~5 MB por escenario.
- Tipos de respuesta de RPCs definidos a mano en TypeScript; generar tipos desde SQL (p. ej. `supabase gen types`) para las firmas.
- Gráficas propias simples; si crecen los requisitos de analítica, evaluar una librería con accesibilidad equivalente.
- `next.config.ts` usa `'unsafe-inline'` en `script-src` (ver SECURITY.md).
