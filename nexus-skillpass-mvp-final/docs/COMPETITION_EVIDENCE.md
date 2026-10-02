# Competition evidence pack

## PRODUCT

Implementación de un MVP de experiencia aplicada con evidencia URL, revisión humana, habilidades respaldadas, VATH, credenciales revocables y consulta pública. La evidencia ejecutada y los límites están en [VERIFICATION](VERIFICATION.md). DEMO significa datos ficticios; no tracción real.

## DEMO URL

Local: `http://127.0.0.1:3000/demo` mientras el servidor está activo. URL pública: **PENDIENTE DE DEPLOYMENT**. El dominio AINDEV no está conectado ni verificado en esta entrega.

## CORE WORKFLOW

Student → Challenge → Experience → Evidence → Human Validation → Verified Skills → SkillPass → Credential → Public Verification / QR. La aprobación es una transacción SQL; un estudiante no puede aprobarse a sí mismo. Las credenciales revocadas no suman VATH vigentes.

## TECH STACK

Next.js App Router, React, TypeScript y Tailwind; adaptador Supabase Auth/PostgreSQL/RLS; PGlite para demostración local aislada; Zod, Vitest, Playwright y QR local. Versiones exactas en package.json y lockfile. Sin dependencia de IA ni service role para operar la aplicación.

## INNOVATION

HIPÓTESIS de diferenciación: convertir experiencia supervisada en una afirmación trazable que relaciona persona, organización, entregable, skill y decisión humana, operada desde una red local de vinculación. No se afirma novedad absoluta ni liderazgo de mercado.

## FUTURE OF WORK

HIPÓTESIS: dar contexto verificable al trabajo aplicado puede mejorar las conversaciones sobre capacidades y oportunidades. El MVP no demuestra todavía causalidad sobre empleo, salarios o productividad.

## MARKET

Segmentos propuestos: universidades, empresas y estudiantes de Aguascalientes. Comprador, recurrencia, presupuesto y disposición de pago requieren entrevistas y piloto. No se estima TAM sin una investigación específica ni se cuentan fixtures como demanda.

## BUSINESS MODEL

PLAN: retos empresariales/implementación, programas institucionales y membresía corporativa; después SaaS/API si hay recurrencia demostrada. El estudiante no es el pagador principal. No hay billing. Antes de fijar precios se debe medir costo directo completo por reto y margen de contribución, incluyendo compensación o apoyos acordados.

## SCALABILITY

Monolito modular, esquema relacional, membresías por organización, RPC transaccionales y proyecciones públicas. Antes de escala: paginación, observabilidad, rate limiting compartido, procedimientos de soporte, backups/restauración, garantías de disponibilidad y esquema de consentimiento institucional.

## DATA MOAT

HIPÓTESIS futura: interacciones consentidas y verificadas pueden producir información útil sobre skills, experiencias y organizaciones. Hoy no se afirma disponer de datos masivos, un grafo comercial ni modelos propietarios. La calidad del validador, la evidencia y los derechos sobre los datos condicionan ese potencial.

## PRIVACY

Consentimiento del perfil y de cada evidencia, proyecciones públicas acotadas, RLS para lectura, RPC con autorización para escritura, rechazo de autoaprobación y evidencia inmutable tras envío. Los comentarios internos y el correo no se publican. URLs externas no equivalen a archivos inmutables; revisar [SECURITY](SECURITY.md).

## CURRENT STATUS

CONFIRMADO localmente sólo donde lo acredita VERIFICATION. Supabase remoto, Vercel, dominio, correo y Auth end-to-end real quedan sin verificar hasta conectar infraestructura. No se declara Definition of Done de producción completada. Storage, IA, tokens de revisión y estándares interoperables son ROADMAP.

## METRICS

La app calcula experiencias verificadas vigentes, habilidades distintas verificadas, horas declaradas y VATH a partir de registros. No se reportan usuarios reales, clientes, ingresos, pilotos ni colocaciones desde esta ejecución. El seed contiene un escenario ficticio de 32 horas declaradas y 28 verificadas; esos números sólo sirven para probar la distinción.

## COMPETITIVE CONTEXT — fuentes primarias consultadas 2026-09-28

| Referente | Lo que declara su fuente | Implicación para NEXUS |
| --- | --- | --- |
| [Credly by Pearson](https://info.credly.com/) | Plataforma de credenciales digitales e información sobre habilidades | Credenciales y skills ya tienen competidores; NEXUS debe validar su valor operativo y distribución |
| [Forage](https://www.theforage.com/) | Simulaciones de trabajo gratuitas y a ritmo propio, con tareas y certificados | Explicar que una experiencia supervisada y una simulación son contextos diferentes; no atribuir limitaciones no comprobadas al competidor |
| [Riipen](https://www.riipen.com/) | Plataforma de aprendizaje experiencial que conecta educación, estudiantes y empleadores | La vinculación mediante proyectos también existe; el enfoque regional y la ejecución necesitan evidencia de ventaja |
| [Open Badges / 1EdTech](https://www.1edtech.org/standards/open-badges) | Estándar de credenciales/badges digitales | Referencia de interoperabilidad futura; el MVP no declara compatibilidad ni certificación |

Esta comparación es una lectura acotada de páginas oficiales, no una auditoría exhaustiva de productos. No se han comprobado precios, contratos, condiciones de convocatorias ni elegibilidad para TecPrize. No afirmar candidatura aceptada, beneficio disponible o fecha límite sin investigación específica vigente.
