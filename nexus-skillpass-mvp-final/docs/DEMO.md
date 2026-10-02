# Demostración NEXUS SkillPass

Todos los nombres, experiencias, horas y credenciales del escenario son **DEMO**. No representan tracción, desempeño real, clientes, convenios ni certificaciones oficiales. La demostración local usa PostgreSQL PGlite y un selector de personajes; no debe describirse como prueba de Supabase Auth.

## Preparación

1. Seguir la instalación del README, iniciar la app y abrir `/demo`.
   Para presentar la versión compilada: `npm run build` y `npm run demo:serve`. La URL permanece local a esta computadora; se necesita hosting/HTTPS para un QR accesible desde teléfonos externos.
2. Mantener el mismo navegador y sus cookies para conservar el escenario al cambiar de personaje.
3. Abrir Estudiante. Confirmar que aparece la marca DEMO y la experiencia verificada de ejemplo.
4. Para una presentación de 90 segundos, dejar preparada otra experiencia del reto con evidencia y solicitud pendiente usando el ensayo completo siguiente. La preparación es visible y no representa un proceso automático.
5. Tener una ventana privada disponible para verificar el enlace compartido sin autenticación.

## Guion de 90 segundos

| Tiempo | Pantalla y acción | Frase del fundador |
| --- | --- | --- |
| 0–10 s | Landing → Explorar demo | “NEXUS conecta experiencia, evidencia y validación humana. Este escenario es ficticio y está marcado DEMO.” |
| 10–22 s | Dashboard estudiante → reto | “Ana participa en un reto de una organización y registra el trabajo que realizó.” |
| 22–35 s | Experiencia preparada | “Relaciona habilidades, horas declaradas y evidencia. Hasta aquí no hay horas verificadas.” |
| 35–50 s | `/demo` → Supervisor → revisión | “El supervisor autorizado revisa la evidencia y confirma únicamente las horas y el desempeño observados.” |
| 50–63 s | Aprobar la solicitud | “La aprobación crea una validación auditable y una credencial; las habilidades pasan a estar respaldadas.” |
| 63–75 s | Estudiante → SkillPass | “El perfil conecta cada afirmación verificada con su experiencia y credencial.” |
| 75–85 s | Copiar URL/QR → ventana privada | “Cualquier tercero puede comprobar el estado vigente con la URL. El QR sólo facilita llegar a ella.” |
| 85–90 s | Dashboard | “Estos indicadores se calculan desde registros; DEMO no equivale a impacto real ni a garantía de empleo.” |

## Ensayo completo funcional

1. En `/demo`, seleccionar Estudiante y abrir Perfil. Actualizar los datos profesionales y activar la visibilidad pública para compartir. No ingresar datos personales reales en este entorno.
2. Abrir Retos y el reto de transformación digital de una PYME. Registrar participación.
3. Crear experiencia asociada al reto: título, descripción, responsabilidades, entregables, fechas, horas y al menos una habilidad.
4. Abrir la experiencia creada y agregar una URL HTTPS de evidencia, con título y descripción. Elegir explícitamente si es pública. Una URL de ejemplo ilustra el mecanismo; no debe presentarse como entregable real de un estudiante.
5. Solicitar validación. Observar `pending_validation`. No sumar estas horas a VATH.
6. Regresar a `/demo` y seleccionar Supervisor, conservando las cookies del escenario. Abrir la revisión pendiente, examinar evidencia, escribir comentario, asignar rating y registrar horas verificadas que no excedan las declaradas.
7. Aprobar. Confirmar estado `verified`, credencial generada, habilidades y VATH actualizados.
8. Volver como Estudiante, abrir SkillPass, copiar su enlace y mostrar QR. Abrir el enlace en una ventana privada. La URL DEMO incluye el identificador del escenario; conservarlo completo.
9. Abrir la credencial desde el SkillPass. Confirmar persona, actividad, organización, fecha, habilidades, ID y estado. No debe aparecer correo, comentario privado ni evidencia marcada privada.
10. Como Admin, revocar la credencial con una razón. Volver al enlace público y confirmar `REVOKED`; comprobar que ya no contribuye a VATH ni habilidades vigentes.

## Pruebas de confianza para el fundador

- Intentar aprobar como estudiante o universidad: la acción debe rechazarse en el servidor/base de datos.
- Solicitar validación sin evidencia o sin skills: debe fallar con un error útil.
- Solicitar cambios y reenviar: el estudiante corrige antes de una nueva revisión.
- Abrir un UUID inexistente de credencial: debe mostrar `INVALID`, sin revelar registros internos.
- Desactivar la publicación del perfil: los enlaces públicos dejan de exponerlo, aunque quien conservó una captura previa pueda mantenerla.
- Recargar una página después de editar: los cambios deben mantenerse en la base del escenario.

## Límites de la presentación

El flujo con usuarios reales exige provisionar organizaciones y supervisores y validar Supabase Auth en un proyecto configurado. No hay emails de solicitud automáticos, subida de archivos, validación sin cuenta, IA, pagos o blockchain. Los supervisores encuentran solicitudes en su bandeja de revisión. La versión local no es una URL publicada ni puede abrirse desde un teléfono externo salvo que se prepare un entorno accesible y seguro.
