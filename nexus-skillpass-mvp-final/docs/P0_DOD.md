# P0 y Definition of Done

La cobertura local se comprueba mediante tests; una implementación no acredita un servicio externo no conectado. La columna de evidencia identifica los casos implementados y los gates necesarios, no declara que la última ejecución haya pasado. Ver resultados exactos y fecha en [VERIFICATION](VERIFICATION.md).

| # | Requisito | Implementación | Casos de prueba / gate |
| --- | --- | --- | --- |
| 1 | Registrar/loguear usuario | Supabase Auth, /signup, /login, callback, proxy, logout | Implementado; servicio real NO VERIFICADO sin claves |
| 2 | Visualizar estudiante | /dashboard, /profile | E2E local y snapshot SQL |
| 3 | Participar en reto | /challenges/[id], join_challenge | E2E + SQL, participación idempotente |
| 4 | Registrar experiencia | /experiences/new, actualización en estados editables | E2E + SQL |
| 5 | Asociar skills | Catálogo y experience_skills | Formulario + SQL |
| 6 | Agregar evidencia | URL HTTPS, metadata, privacidad por pieza | E2E + validación Zod + SQL |
| 7 | Solicitar validación | Bandeja organizacional y estado bloqueado | E2E + SQL |
| 8 | Aprobar | Supervisor independiente, rúbrica, horas acotadas | E2E + SQL adversarial |
| 9 | Reflejar skill verificada | Derivación desde credencial vigente, student_skills view | E2E + SQL |
| 10 | Generar credencial | Emisión atómica en aprobación | E2E + SQL |
| 11 | SkillPass público | /skillpass/[slug], consentimiento | E2E anónimo y SQL |
| 12 | Verificación pública | /verify/[id], VERIFIED / REVOKED / INVALID | E2E + SQL |
| 13 | Compartir URL/QR | QR local, copiar enlace, sin terceros | Decodificación real QR en E2E |
| 14 | Dashboard | Métricas derivadas, permisos por rol | E2E + cálculo aprobado/revocado |
| 15 | Build sin errores críticos | npm run build | Resultado registrado en VERIFICATION |

Otros P0 implementados: landing en español y responsive; /demo con accesos guiados; documentación; migraciones; RLS; estructura preparada para GitHub. Verificar el estado de Git y los gates locales antes de afirmar repositorio limpio. Deployment: código e instrucciones preparados, publicación remota pendiente de cuentas/variables. **No cerrar la Definition of Done completa hasta pasar los gates locales, #1 con Supabase real y deployment verificado.**

P1 incluido sólo de forma mínima: observatorio universitario de estudiantes asignados y distribución de skills. No existen predicciones de empleabilidad. Los estados y las pruebas no acreditan la autenticidad material del contenido alojado fuera de NEXUS.
