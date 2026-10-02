# Seguridad y privacidad

Esta es una descripción de controles del MVP y de sus límites, no una certificación ni una auditoría independiente. Las comprobaciones efectivamente ejecutadas se registran en [VERIFICATION.md](VERIFICATION.md). La ausencia de credenciales externas impide afirmar que RLS y Auth ya se verificaron en un proyecto Supabase remoto.

## Fronteras de confianza

El navegador se trata como entrada no confiable. Las rutas API validan payloads y recuperan la identidad de sesión; las RPC comprueban propietario, rol, membresía y estado antes de escribir. Un `user_id`, `role`, `verified` o `organization_id` enviado por el cliente no otorga autorización. RLS restringe las lecturas de tablas. Las escrituras de negocio se concentran en funciones transaccionales con comprobaciones explícitas.

Las funciones privilegiadas deben fijar `search_path`, usar parámetros y comprobar identidad internamente. Se revocan permisos que permitirían eludir el flujo normal. No basta con que la interfaz oculte un botón; las pruebas intentan las acciones denegadas directamente.

## Matriz de acceso

| Capacidad | Estudiante | Supervisor | Universidad | Admin | Anónimo |
| --- | --- | --- | --- | --- | --- |
| Perfil propio | Leer/editar campos permitidos | Leer/editar campos permitidos | Leer/editar campos permitidos | Leer/gestionar según acción | Sólo proyección pública opt-in |
| Participar/registrar experiencia | Propia | No como supervisor | No | No como admin | No |
| Evidencia | Agregar a experiencia propia editable; sin edición/borrado de piezas | Experiencias de organización autorizada | Relación académica no concede evidencia privada de otra organización | Acceso administrativo | Sólo evidencia pública del perfil publicado |
| Validación | Solicitar propia | Aprobar/cambios/rechazar de su organización, nunca propia | No | Supervisión autorizada, nunca autoaprobación | No |
| Organización/skills/retos | Directorio y retos abiertos | Directorio y retos de alcance permitido | Directorio y retos de alcance permitido | Crear organizaciones, skills y retos | Proyección mínima pertinente |
| Revocación | No | No | No | Sí, con razón | Consulta de estado público |
| Bitácora | Según alcance de lectura | Según alcance de lectura | Según alcance de lectura | Acceso autorizado | No |

El alcance institucional se determina por membresías; escribir el nombre de una universidad en el perfil no establece relación autorizada con ella. Los permisos sobre organizaciones no son tenant isolation completo: usuarios autenticados descubren el directorio y los retos abiertos. Las experiencias, evidencia y comentarios sí tienen reglas de acceso acotadas. Admin asigna membresías y roles organizacionales; el alta de otro admin requiere una operación administrativa controlada.

## Controles

- Supabase Auth maneja registro/login/logout y sesión real; el rol de alta pública es siempre estudiante.
- La aplicación usa clave pública Supabase y JWT de usuario. No requiere service role para el flujo ordinario.
- UUID y slugs estables reducen colisiones; no se consideran sustitutos de autorización.
- Evidencia sólo acepta URL HTTPS y se muestra como enlace; no se descarga ni ejecuta desde el servidor.
- React presenta texto como texto; no se renderiza HTML arbitrario de descripciones o comentarios.
- Validaciones y credenciales se crean mediante una transacción. No se aceptan horas verificadas mayores que las declaradas.
- El estudiante no puede cambiar la evidencia de una experiencia ya sometida a revisión para alterar retrospectivamente su aprobación.
- Revocar conserva el registro y modifica el estado público; sus horas y habilidades dejan de contabilizar como vigentes.
- API pública devuelve campos seleccionados y no correos, comentarios privados, logs internos ni evidencia no publicada.
- La DEMO usa cookie del servidor y un contexto separado. El parámetro público `demo` no concede sesión ni acceso de escritura.
- Las acciones mutables exigen JSON y un `Origin` coincidente con el origen configurado, y limitan el tamaño del body. Auth y acciones incorporan límites de solicitudes por proceso; no sustituyen un limitador distribuido.
- El body se limita a 24 KB durante la lectura, incluyendo peticiones sin Content-Length. La protección de origen usa el host del navegador en local y el origen configurado cuando se establece NEXT_PUBLIC_APP_URL.
- La migración 003 restringe evidencia y comentarios privados a su propietario y revisores, incluso cuando un observador universitario comparte organización. También elimina grants anónimos heredados por defecto y protege la identidad de experiencias y credenciales finales frente a reescrituras accidentales.
- La cookie DEMO está firmada, es HttpOnly y SameSite=Lax; usa Secure bajo HTTPS. Su vencimiento de ocho horas no elimina el escenario guardado ni revoca sus enlaces públicos. La limpieza de disco es explícita.

## Privacidad operativa

Publicar un perfil implica hacer consultables los campos profesionales mostrados, experiencias con credencial, su historial revocado y evidencia expresamente publicada. La aprobación pública identifica por nombre al supervisor; comunicarlo al asignar su rol y antes de validar. No recoger documentos de identidad, domicilio completo ni información sensible innecesaria. Despublicar evita futuras lecturas desde la app; no elimina capturas previas o copias guardadas por terceros. Explicar este límite en onboarding del piloto.

No existe carga de archivos en P0: Storage requiere buckets privados, límites de tipo/tamaño, URLs firmadas, escaneo y política de retención antes de habilitarse. Una URL externa marcada pública puede seguir disponible en su sitio de origen aunque NEXUS la oculte.

## Riesgos y gates pendientes

1. **Infraestructura remota:** probar con cuentas reales las policies, membresías, sesión, confirmación de email y callbacks. La DEMO no cubre estos servicios.
2. **Abuso y operación:** revisar rate limiting distribuido, cuotas, monitoreo, alertas, backups y recuperación antes de abrir un registro masivo.
3. **Gobierno de datos:** definir aviso de privacidad, consentimiento, retención, atención de derechos y tratamiento de menores con responsables y asesoría local antes de un piloto real.
4. **Confianza del validador:** verificar quién representa a cada organización al asignar membresías; una aprobación registra la acción de esa cuenta, no acredita por sí sola la identidad legal de la persona.
5. **Enlaces externos:** el sistema verifica sintaxis y procedencia de la validación, no garantiza veracidad o disponibilidad permanente de cada evidencia enlazada.

Las credenciales actuales son registros de NEXUS con consulta en línea, no firmas criptográficas portables ni cumplimiento declarado de Open Badges/W3C VC. No comunicar esas capacidades hasta implementarlas y probarlas.
