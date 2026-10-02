# Registro de verificación

Este documento distingue implementación de evidencia de ejecución. Inicio y consulta de fuentes: 2026-09-28. Verificación final local: **2026-09-30**, zona America/Mexico_City. Los resultados siguientes corresponden al código entregado, con las tres migraciones aplicadas. Se ejecutaron en Windows con Node.js y Chromium; no acreditan un servicio remoto ni una auditoría independiente.

| Comprobación | Resultado ejecutado | Evidencia y alcance |
| --- | --- | --- |
| Instalación reproducible | PASS | `npm ci`: 428 paquetes instalados, código de salida 0; versiones fijadas en package-lock.json |
| Lint | PASS | `npm run lint`: código de salida 0, sin errores ni advertencias |
| Typecheck | PASS | `npm run typecheck`: generación de tipos Next.js y TypeScript, código de salida 0 |
| Tests unitarios/base de datos | PASS | `npm test`: **34 pruebas, 5 archivos**, aproximadamente 38 segundos |
| E2E navegador | PASS | `npm run test:e2e`: **3 pruebas**, 35.6 segundos, contra la compilación de producción local |
| Build producción | PASS | `npm run build` / `next build --webpack`: compilación, TypeScript y generación de páginas, código de salida 0 |
| Servidor de producción local | PASS | `npm run demo:serve`; `/demo` respondió HTTP 200 en `http://127.0.0.1:3000` |
| Inspección visual desktop/móvil | PASS | Capturas de la ejecución de producción a 1280 px y 390 px; inspección visual y aserción E2E sin desbordamiento horizontal móvil |
| Dependencias de producción | PASS al consultar | `npm audit --omit=dev --json`: 0 vulnerabilidades reportadas; es una consulta puntual, no garantía futura |
| Supabase registro/login/sesión | NO VERIFICADO | Proyecto configurado y prueba remota |
| Migrations/RLS en Supabase remoto | NO VERIFICADO | Aplicación y pruebas con usuarios separados |
| Vercel/HTTPS/dominio | NO DESPLEGADO | URL accesible y pruebas de publicación |
| GitHub Actions | PREPARADO, NO EJECUTADO EN GITHUB | Workflow versionado; no existe ejecución remota que acreditar |

## Qué cubren las pruebas

- **20 pruebas SQL**: ejecución real de las migrations y el seed sobre PostgreSQL PGlite; RLS en las 15 tablas; permisos anónimos y autenticados; protección de roles; denegación de escrituras directas; aislamiento de organizaciones; restricción de evidencia privada a observadores universitarios; participación en retos; evidencia y skills obligatorias; bloqueo de autovalidación; aprobación atómica; límites de horas; correcciones, rechazo, revocación y consentimiento público. También prueban que las migrations preservan una tabla ajena a NEXUS.
- **8 pruebas de validación**: rechazo de inyección de rol, acciones no permitidas, URLs inseguras, fechas inválidas y datos manipulados; aceptación de una evidencia mínima válida.
- **4 pruebas HTTP**: comprobación de origen, rechazo de origen hostil, límite de bytes incluso sin Content-Length y errores JSON controlados.
- **1 prueba de sesión**: firma del rol DEMO y rechazo de cookie manipulada o de un identificador público usado como sesión.
- **1 prueba de persistencia DEMO**: reapertura de bases en disco, seguimiento de las tres migrations, límite de bases abiertas y aislamiento entre escenarios.

Los tres E2E comprueban:

1. Alta de escenario DEMO, edición de perfil, participación en reto, experiencia de 16 horas declaradas, evidencia, solicitud, aprobación de 12 horas por supervisor, skills verificadas, credencial y SkillPass. El test **decodifica los píxeles del QR** y compara la URL; otro contexto de navegador abre la consulta pública. Finalmente un administrador revoca la credencial y se comprueba su estado público y la retirada de sus VATH.
2. Redirección de rutas privadas, respuesta explícita cuando falta configuración Auth, identificadores públicos inválidos y protección de origen de peticiones.
3. Denegación de acciones administrativas a estudiantes, retiro del consentimiento de publicación y resistencia a manipulación de sesión.

## Evidencia visual incluida

Las capturas fueron generadas por Playwright contra el servidor de producción local; contienen exclusivamente personajes y registros DEMO. La URL del QR es local y requiere que ese servidor y su escenario sigan disponibles.

- [Landing desktop](../artifacts/landing-desktop.png)
- [Credencial desktop](../artifacts/credential-desktop.png)
- [SkillPass desktop](../artifacts/skillpass-desktop.png)
- [SkillPass móvil](../artifacts/skillpass-mobile.png)

Los escenarios de prueba, las cookies, las trazas de navegador y el directorio `.demo-data` se excluyen del repositorio. Las capturas muestran identificadores públicos de datos ficticios, no credenciales de autenticación.

## Reproducción y límites

Ejecutar `npm ci`, `npm run lint`, `npm run typecheck`, `npm test` y `npm run build`. Para repetir el recorrido sobre producción local, instalar Chromium con `npx playwright install chromium`, iniciar `npm run demo:serve` en una terminal y ejecutar `npm run test:e2e` en otra. No mantener otro servidor en el puerto 3000 durante ese procedimiento. La configuración E2E reutiliza el servidor local; si no hay uno, inicia el servidor de desarrollo, que no acredita por sí mismo el build de producción.

Los resultados locales pueden confirmar PostgreSQL embebido, reglas de negocio, integración del adaptador DEMO y navegación. No prueban la infraestructura remota. La Definition of Done permanece abierta hasta completar las verificaciones externas obligatorias. Ninguna cifra del seed cuenta como usuario, cliente, ingreso o impacto real.
