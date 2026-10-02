# AINDEV NEXUS | SkillPass

**Experiencia real → evidencia → validación humana → habilidades verificadas → SkillPass compartible.**

MVP en español de AINDEV TECH MÉXICO. Permite registrar trabajo aplicado, vincular habilidades y evidencia, solicitar una revisión profesional y generar una credencial consultable por URL y QR. Las horas declaradas se separan de las horas verificadas (VATH). No promete empleo, certificación oficial ni convenios institucionales.

## Estado y alcance

El repositorio incluye la aplicación, esquema PostgreSQL reproducible, políticas RLS, un adaptador Supabase y una DEMO local aislada con PostgreSQL embebido PGlite. Los datos de la DEMO son ficticios y se identifican como tales. La DEMO permite ejecutar las mismas transiciones de negocio en base de datos sin secretos externos; no sustituye la comprobación de Supabase Auth ni un deployment real.

Consultar [VERIFICATION.md](docs/VERIFICATION.md) para resultados efectivamente ejecutados y [P0_DOD.md](docs/P0_DOD.md) para trazabilidad. No se debe anunciar el MVP como completamente desplegado o la Definition of Done como cerrada mientras existan gates pendientes.

## Desarrollo local

Requisitos: Node.js compatible con la versión de Next.js fijada en el lockfile, npm y un navegador moderno. Usar Node.js 22 LTS o posterior compatible.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Abrir `http://127.0.0.1:3000/demo`. No es necesario configurar Supabase para probar la DEMO local. Seguir las variables y valores de `.env.example`; no guardar secretos en Git. `NEXT_PUBLIC_APP_URL` define el origen de enlaces compartidos y callbacks y debe coincidir con la URL del entorno.

Para una presentación local con la compilación de producción:

```powershell
npm run build
npm run demo:serve
```

Este lanzador genera o reutiliza una clave local privada en `.demo-data/.session-key` y sirve sólo en `127.0.0.1`. No publica una URL externa ni requiere modificar `.env.example`. Para detenerlo, Ctrl+C. No ejecutar al mismo tiempo dos procesos sobre la misma carpeta de datos.

La cookie DEMO dura ocho horas y se renueva al cambiar de personaje. Los escenarios y sus URLs públicas persisten en disco después de vencer la cookie; no existe eliminación automática. Se permiten 30 escenarios por defecto y se mantienen hasta tres bases abiertas simultáneamente. Las nuevas migraciones se aplican al abrir cada escenario, con seguimiento en `.nexus-migrations.json`. Los escenarios creados antes de ese seguimiento reconocen las dos migraciones iniciales por su esquema.

Para liberar capacidad, **detener primero el servidor**, listar escenarios con `npm run demo:cleanup` y eliminar únicamente un escenario ficticio elegido con `npm run demo:cleanup -- UUID`. El script verifica que el UUID resuelva a una carpeta directa dentro del directorio DEMO. El borrado es permanente y hace que sus enlaces dejen de funcionar; no afecta Supabase ni elimina la clave local. No compartir `.demo-data`, cookies ni trazas de navegador.

## Modos de ejecución

| Modo | Base de datos | Identidad | Uso |
| --- | --- | --- | --- |
| DEMO local | PGlite persistente en disco, aislado por sesión DEMO | Selector de personaje ficticio y cookie de sesión del servidor | Pruebas, presentación local y ensayo del ciclo |
| Supabase | PostgreSQL del proyecto configurado | Supabase Auth con sesión por cookies | Piloto con usuarios autorizados tras verificar configuración |

La DEMO no es un mecanismo de acceso a usuarios reales. Compartir su identificador permite consultar únicamente el subconjunto público del escenario. No otorga una sesión privada.

El disco local de la DEMO requiere un proceso Node con almacenamiento persistente. No desplegar este modo como si fuera una base durable en funciones Vercel. Para Vercel, usar Supabase y deshabilitar la DEMO local; preparar un entorno de demostración separado antes de publicar `/demo` funcional allí.

## Supabase

1. Crear un proyecto Supabase dedicado al entorno.
2. Configurar URL y clave pública/anon según `.env.example`. La aplicación no necesita una clave service role.
3. Aplicar los archivos de `supabase/migrations/` en orden, usando Supabase CLI o una conexión PostgreSQL administrativa autorizada. El esquema se mantiene en código.
4. Configurar Site URL y las redirect URLs de Auth para el origen local o publicado, incluido `/auth/callback`.
5. Registrar usuarios reales mediante `/signup`; la alta pública siempre crea rol `student`.
6. Provisionar administradores y membresías con una operación administrativa controlada, como se explica en [DEPLOYMENT.md](docs/DEPLOYMENT.md).
7. Verificar registro, confirmación de correo, login, recuperación de sesión, logout, RLS y aislamiento entre organizaciones contra ese proyecto.

`supabase/seed.sql` contiene únicamente fixtures DEMO. No ejecutarlo sobre producción con datos reales. Leer su preámbulo y [DATA_MODEL.md](docs/DATA_MODEL.md) antes de usarlo. No existen contraseñas de producción compartidas ni cuentas privilegiadas precreadas en la aplicación.

## Personajes y rutas de demostración

Los botones de `/demo` abren los personajes Estudiante, Supervisor, Universidad y Admin. El estudiante ficticio es Ana Martínez; la empresa y universidad de ejemplo son DEMO, no socios confirmados. El cambio de personaje conserva el escenario para completar el ciclo. Las instrucciones detalladas están en [DEMO.md](docs/DEMO.md).

Rutas principales: `/`, `/demo`, `/login`, `/signup`, `/dashboard`, `/profile`, `/challenges`, `/experiences/new`, `/review`, `/admin`, `/skillpass/[slug]` y `/verify/[id]`.

## Comprobaciones

```powershell
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm run start
```

Los tests de base de datos deben verificar invariantes y permisos, y los E2E el recorrido real de navegador. Una compilación exitosa no acredita por sí sola un deployment, Auth remoto ni políticas RLS aplicadas a un proyecto externo. Consultar los resultados registrados antes de repetir afirmaciones de funcionamiento.

## Arquitectura y documentos

- [ARCHITECTURE](docs/ARCHITECTURE.md): componentes, fronteras de confianza y decisiones.
- [DATA_MODEL](docs/DATA_MODEL.md): relaciones, estados, métricas e integridad.
- [SECURITY](docs/SECURITY.md): permisos, controles, privacidad y límites.
- [DEPLOYMENT](docs/DEPLOYMENT.md): Supabase, Vercel, dominio y gates de publicación.
- [DEMO](docs/DEMO.md): guion de 90 segundos y ensayo completo.
- [ROADMAP](docs/ROADMAP.md): pendientes priorizados y criterios go/no-go.
- [COMPETITION_EVIDENCE](docs/COMPETITION_EVIDENCE.md): evidencia para evaluación y fuentes primarias.
- [PITCH](docs/PITCH.md): narrativa comercial sin tracción inventada.
- [P0_DOD](docs/P0_DOD.md): cobertura de requisitos y Definition of Done.
- [VERIFICATION](docs/VERIFICATION.md): resultados y restricciones verificables.

Se difieren Storage, validación mediante token sin cuenta, IA, pagos, blockchain, SSO e integraciones. La evidencia se registra mediante URL HTTPS y metadatos. La credencial es un registro verificable dentro de NEXUS; no se presenta como certificación académica oficial ni como una credencial criptográfica interoperable.
