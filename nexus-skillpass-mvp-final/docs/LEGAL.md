# Aviso de privacidad y Términos y condiciones

> **Estado (13 nov 2026): borrador para revisión legal.** Los textos están escritos y la plataforma ya sabe
> mostrarlos y registrar quién los aceptó, pero **no están publicados**: en producción no existen las páginas,
> el registro conserva su frase corta y a nadie se le pide aceptar nada hasta que AINDEV los apruebe.
> Los redactó el equipo de desarrollo a partir de lo que la plataforma hace hoy; **debe revisarlos un abogado**.

## Qué hay

| Pieza | Dónde |
|---|---|
| Aviso de privacidad (español e inglés) | `src/lib/legal/privacy.ts` → `/legal/privacy` |
| Términos y condiciones (español e inglés) | `src/lib/legal/terms.ts` → `/legal/terms` |
| Versión vigente (una fecha) y datos de la entidad | `src/lib/legal/config.ts` (`LEGAL_VERSION`, variables `LEGAL_*`) |
| Casilla obligatoria en el registro | `src/components/legal-consent.tsx`, `src/actions/auth.ts` |
| Pantalla «Antes de continuar» para cuentas que no han aceptado la versión vigente | `/legal/accept`, `src/lib/server/legal.ts` |
| Registro de aceptaciones | tabla `legal_acceptances` (migración `20261113000001`) |

El texto en español es el que vale; el inglés es una traducción de cortesía y la página lo dice.

## Cómo funciona

- **Registro.** Con los textos publicados, no se puede crear una cuenta sin marcar «He leído el Aviso de
  privacidad y acepto los Términos y condiciones». La aceptación viaja con el alta y la base la guarda junto
  con la cuenta (`source = 'signup'`), con la versión y el idioma en que se leyó.
- **Cuentas que ya existían** (o cualquier cuenta cuando cambie la versión): al entrar ven «Antes de
  continuar» y no pasan a la plataforma hasta aceptar (`source = 'prompt'`). Pueden cerrar sesión y pedir su baja.
- **Qué se guarda:** usuario, versión, cuándo, cómo (registro o pantalla) e idioma. No se guarda la IP. Las
  filas no se pueden editar ni borrar desde la app; cada persona ve sólo las suyas y AINDEV las ve todas.
- **Nunca bloquea un alta:** si por cualquier motivo no queda registrada la aceptación del registro, la
  plataforma la pide en el primer inicio de sesión.
- Las personas de la DEMO no ven nada de esto.

## Cómo se publican

1. El abogado revisa los dos textos (PDF generados desde `/legal/privacy` y `/legal/terms`) y AINDEV decide los
   puntos de abajo. Los cambios de redacción se hacen en `privacy.ts` / `terms.ts`.
2. La migración `20261113000001` ya está aplicada en la base de producción (13 nov 2026).
3. En Vercel (`skillpass-prod`, Production) se configuran las cuatro variables y se redespliega:

   | Variable | Qué es |
   |---|---|
   | `LEGAL_ENTITY_NAME` | Razón social del responsable (p. ej. «…, S.A.S. de C.V.») |
   | `LEGAL_ENTITY_ADDRESS` | Domicilio completo para oír y recibir notificaciones |
   | `LEGAL_CONTACT_EMAIL` | Buzón para derechos ARCO y avisos legales (p. ej. `privacidad@aindev.com.mx`); alguien debe leerlo |
   | `LEGAL_JURISDICTION` | Ciudad y estado de los tribunales competentes (p. ej. «Aguascalientes, Aguascalientes») |

   Con las cuatro, los textos quedan publicados: aparecen las páginas y los enlaces del pie, el registro
   exige la casilla y las cuentas existentes aceptan al entrar. Sin alguna, nada de eso existe.

**Cambiar un texto después:** editar `privacy.ts` o `terms.ts` y poner la fecha del cambio en `LEGAL_VERSION`.
Todas las cuentas aceptan la versión nueva la siguiente vez que entren; las aceptaciones anteriores se conservan.

## Puntos que debe decidir AINDEV con su abogado

1. **Razón social, domicilio, buzón de privacidad y jurisdicción** (las cuatro variables).
2. **Edad mínima.** El borrador dice 18 años. Hay estudiantes de primer semestre con 17: si se les quiere
   admitir, hace falta un mecanismo de autorización de madre, padre o tutor, que la plataforma no tiene.
3. **Transferencias y consentimiento** (aviso, secciones 4 y 5): el borrador trata como parte del servicio
   que la empresa del reto y la universidad vean ciertos datos, y pide autorizarlo al aceptar. Confirmar que
   esa forma de consentimiento basta.
4. **Autoridad y plazos** (aviso, secciones 8 y 12): el borrador cita la ley vigente desde marzo de 2025, a
   la Secretaría Anticorrupción y Buen Gobierno como autoridad, y plazos de 20 y 15 días hábiles. Verificar.
5. **Proveedores fuera de México** (aviso, sección 5): Supabase, Vercel y Resend guardan y procesan datos en
   Estados Unidos. Revisar si conviene firmar sus acuerdos de tratamiento de datos (DPA).
6. **Relación estudiante–empresa** (términos, sección 3): el borrador dice que participar en un reto no crea
   relación laboral con AINDEV y que la relación con la empresa se rige por las condiciones del reto. Revisar
   frente a la legislación laboral y a los convenios con universidades (prácticas, servicio social).
7. **Responsabilidad y consumo** (términos, secciones 10, 11 y 13): limitación de responsabilidad, servicio
   en piloto y jurisdicción, frente a la Ley Federal de Protección al Consumidor.
8. **Finalidades adicionales** (aviso, sección 3): novedades y encuestas. Quitarlas si AINDEV no las usará.
9. **Baja de cuenta y conservación** (aviso, sección 7): hoy la baja se pide por correo y la hace AINDEV a
   mano; el borrador promete hacerlo normalmente en 30 días. Ojo: la base no deja borrar una cuenta que ya
   tiene historial (la bitácora es inmutable), así que la baja real consiste en anonimizar; falta construir
   esa función (mejora C11 de [STATUS](STATUS.md#para-operar-un-piloto-real)).
10. **Avisos e invitaciones por correo** (aviso, secciones 2, 3 y 5): cuando se enciendan los avisos por
    correo, los mensajes llevan el nombre de la persona y el título del reto, salen por Resend y cada quien
    puede apagarlos en Notificaciones. Una invitación llega a alguien que todavía no tiene cuenta ni ha
    aceptado nada: el correo dice quién la invita y por qué lo recibe, y enlaza al Aviso de privacidad
    cuando está publicado. Confirmar que eso basta como primer contacto.
11. **Convenios aparte:** estos textos no sustituyen el convenio con cada universidad ni los acuerdos de
    confidencialidad o propiedad intelectual entre empresa y estudiante.

## Pruebas

- Base de datos: `tests/database.test.ts`, «terms and privacy notice acceptance».
- App: `tests/unit/legal.test.ts` (configuración, textos en ambos idiomas, a quién se le pide, registro, aceptación).
- Navegador: `e2e/legal.spec.ts` (páginas, pie, traducción, casilla del registro). El bloqueo de cuentas reales
  se recorrió además en un navegador contra un Supabase simulado (ver QA-REPORT).
