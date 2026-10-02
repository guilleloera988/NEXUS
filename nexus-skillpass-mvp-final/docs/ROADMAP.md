# Roadmap y gates

Estado: PLAN. Las fechas son relativas a la aprobación del piloto; los responsables son propuestos. No representan compromisos aceptados ni resultados garantizados.

| Prioridad / objetivo | Responsable | Fecha | Costo | Entregable / KPI | Riesgo / Go–No-Go |
| --- | --- | --- | --- | --- | --- |
| P0 · Conectar Supabase staging y Auth real | Mario | D+1 | Infraestructura a cotizar; tiempo técnico | Registro, confirmación, login, refresh, logout, RPC y RLS comprobados | NO-GO si un usuario accede a otra organización |
| P0 · Publicar Preview Vercel y dominio aprobado | Mario | D+2 | Plan y dominio según cuenta existente | URL HTTPS; QR probado desde móvil externo; rollback documentado | NO-GO si callback, variables u origen no coinciden |
| P0 · Ensayar el ciclo con actores distintos | Emma + Cristian | D+3 | Horas internas a presupuestar | Una experiencia consentida con evidencia, revisión y credencial | NO-GO si se necesita editar SQL para completar una experiencia ordinaria |
| Piloto · Formalizar alcance y reconocimiento | Guillermo + Academic/Growth Partners | Antes del piloto | Presupuesto y apoyos por aprobar | Acuerdo de alcance, responsables, compensación/reconocimiento e IP | NO-GO sin condiciones justas y supervisor disponible |
| P1 · Robustecer evidencia | Mario | Tras validar piloto | Cotizar almacenamiento y escaneo | Buckets privados, versiones/hash, URLs firmadas y retención | Riesgo de malware, fuga y enlaces cambiantes |
| P1 · Operación y observación | Emma + Mario | Antes de escala | Soporte, monitoreo, backups | Rate limit distribuido, paginación, recuperación probada, métricas por cohorte | NO-GO con snapshots completos a escala o sin restauración |
| P1 · Interoperabilidad | Mario | Tras uso validado | Estimación pendiente | Evaluación Open Badges/VC; pruebas de emisión/revocación | No afirmar conformidad antes de validarla |

P1 excluido del núcleo: IA, revisión por token sin cuenta, carga de archivos, notificaciones por correo, analítica avanzada, puntuación predictiva. P2 excluido: blockchain, app nativa, billing, marketplace, LMS, job board, SSO enterprise.

La expansión inicia con UNII / Alpha Campus como **PLAN**, sujeta a convenio y ejecución verificables; después Aguascalientes y, si los economics y la calidad lo permiten, Bajío y México. No se ha registrado aquí ningún acuerdo institucional real.

Antes de proponer precios: costo directo por reto = horas de coordinación + mentoría + validación + apoyos al talento + herramientas + infraestructura atribuible. Margen de contribución = ingreso cobrado menos ese costo; medir también CAC, conversión, recurrencia y capacidad de revisión. No recomendar escalamiento hasta observar margen positivo compatible con trato justo, calidad y tiempos de validación.
