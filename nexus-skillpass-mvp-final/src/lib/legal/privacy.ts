import type { LegalDocument, LegalText } from './config';

/*
 * Privacy notice (aviso de privacidad integral, LFPDPPP). DRAFT for legal review: it describes what the
 * platform really does today (see docs/SECURITY.md §3). Keep it in step with the product, and change
 * LEGAL_VERSION in config.ts with every change here. Spanish is the binding text; English is a courtesy.
 */
export const privacyNotice: LegalText = (locale, entity) => (locale === 'en' ? en(entity) : es(entity));

type Entity = Parameters<LegalText>[1];

const es = (e: Entity): LegalDocument => ({
  title: 'Aviso de privacidad',
  summary: 'SkillPass registra el trabajo que haces en retos reales para que una empresa lo valide y se convierta en una credencial verificable. '
    + 'Para eso necesitamos algunos datos tuyos. Aquí te decimos cuáles, para qué, quién los ve y cómo decides sobre ellos. '
    + 'Nada tuyo es público si tú no lo activas, y no vendemos tus datos.',
  sections: [
    {
      id: 'responsable', title: '1. Quién es responsable de tus datos',
      blocks: [
        `${e.name} («AINDEV»), con domicilio en ${e.address}, es responsable del tratamiento de tus datos personales en SkillPass by AINDEV NEXUS («SkillPass»), `
        + 'conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.',
        `Para cualquier asunto sobre tus datos personales escribe a ${e.email}.`,
      ],
    },
    {
      id: 'datos', title: '2. Qué datos recabamos',
      blocks: [
        'Recabamos los datos que tú nos das al crear tu cuenta y al usar la plataforma, y los que se generan con tu actividad:',
        { list: [
          'De tu cuenta: nombre completo, correo electrónico, contraseña (se guarda cifrada; nadie en AINDEV puede leerla), tipo de cuenta y, si tu rol lo requiere, el segundo factor de autenticación.',
          'De tu perfil, si eres estudiante: titular, biografía, ciudad, universidad, carrera, semestre, intereses, disponibilidad y las competencias que declaras.',
          'De tu organización, si representas a una empresa o universidad: nombre, sitio web, descripción, las personas que la integran en SkillPass, los correos de las personas que invitas y, en universidades, sus dominios de correo institucional.',
          'De tu actividad: los retos a los que aplicas y tu mensaje de motivación; tareas; evidencias (archivos y enlaces) y sus descripciones; registros de horas; solicitudes de validación; las evaluaciones, comentarios y decisiones de quienes validan tu trabajo; tus credenciales; los reportes que envías y tus notificaciones.',
          'Datos técnicos: fecha y hora de tus acciones (bitácora), las cookies necesarias para mantener tu sesión y, por seguridad, la dirección IP y los datos del navegador que registran nuestros proveedores de infraestructura.',
        ] },
        'No pedimos datos personales sensibles (como origen étnico, estado de salud, creencias u orientación sexual) ni datos financieros o bancarios. Te pedimos no incluirlos en tu perfil ni en tus evidencias.',
      ],
    },
    {
      id: 'finalidades', title: '3. Para qué usamos tus datos',
      blocks: [
        'Finalidades necesarias para darte el servicio:',
        { list: [
          'Crear y administrar tu cuenta e identificarte al entrar.',
          'Operar los retos: publicarlos, recibir postulaciones, asignar participantes y registrar tareas, evidencias y horas.',
          'Validar tu trabajo y emitir, mostrar, verificar y, en su caso, revocar credenciales.',
          'Comprobar tu vínculo con tu universidad y mostrarle información académica de sus estudiantes.',
          'Mostrar tu perfil a empresas verificadas y publicar tu página SkillPass, únicamente cuando tú lo activas.',
          'Enviarte comunicaciones del servicio: confirmación de cuenta, recuperación de contraseña y avisos sobre tus retos, validaciones y credenciales.',
          'Proteger la plataforma: prevenir fraude y abuso, revisar archivos con antivirus, limitar intentos de acceso, llevar una bitácora y atender incidentes.',
          'Cumplir obligaciones legales y atender requerimientos de autoridad competente.',
          'Elaborar estadísticas sobre el uso de la plataforma con datos agregados que no te identifican.',
        ] },
        'Finalidades adicionales, que no son necesarias para el servicio:',
        { list: [
          'Enviarte novedades e invitaciones sobre SkillPass.',
          'Invitarte a encuestas o entrevistas para mejorar la plataforma.',
        ] },
        `Puedes negarte a las finalidades adicionales en cualquier momento escribiendo a ${e.email}. Negarte no afecta tu uso de SkillPass.`,
      ],
    },
    {
      id: 'visibilidad', title: '4. Quién puede ver tus datos dentro de SkillPass',
      blocks: [
        'La plataforma muestra a cada persona sólo lo que necesita:',
        { list: [
          'La empresa del reto en el que participas y las personas que lo supervisan: tu nombre, tu perfil, tu postulación, tus tareas, las evidencias que envías, tus horas y el resultado de cada validación de ese reto.',
          'Tus compañeros del mismo reto: tu nombre y tu participación en el equipo. No ven tus horas.',
          'Tu universidad, cuando tu vínculo está verificado: tu nombre, carrera y semestre, y cifras resumidas (retos, horas validadas, competencias y credenciales). Mientras revisa tu solicitud de vinculación también ve tu correo. No ve tus evidencias ni el detalle de tus horas.',
          'Empresas verificadas, sólo si activas «Abierto a oportunidades»: tu perfil y tus competencias y credenciales verificadas.',
          'Cualquier persona, sólo si tú lo activas: tu página pública SkillPass. Además, quien tenga el código o el QR de una credencial puede verificarla y ver tu nombre, el reto, la empresa, las horas validadas, las competencias evaluadas y quién validó; puedes desactivar la verificación pública de cada credencial. En proyectos confidenciales no se muestran la empresa ni los detalles del proyecto.',
          'El equipo de AINDEV que administra la plataforma, para operarla, darte soporte y atender incidentes.',
        ] },
      ],
    },
    {
      id: 'transferencias', title: '5. Con quién compartimos tus datos',
      blocks: [
        'Compartimos tus datos con las empresas y universidades que participan contigo en SkillPass, y con el público cuando tú lo decides, en los términos de la sección 4. Estas comunicaciones son parte del servicio que solicitas o dependen de una decisión tuya dentro de la plataforma; al aceptar este aviso las autorizas.',
        'También podemos compartirlos con autoridades competentes cuando la ley lo exija.',
        'Para operar SkillPass usamos proveedores que tratan datos por cuenta nuestra y sólo para prestarnos su servicio: base de datos, autenticación y almacenamiento de archivos (Supabase); hospedaje de la aplicación (Vercel); envío de correos (Resend); y, cuando estén activos, el análisis antivirus de archivos y la verificación contra bots (Cloudflare Turnstile). Sus servidores están en Estados Unidos, por lo que tus datos se almacenan y procesan en ese país.',
        'No vendemos ni rentamos tus datos personales.',
      ],
    },
    {
      id: 'seguridad', title: '6. Cómo protegemos tus datos',
      blocks: [
        'Usamos conexiones cifradas, control de acceso por rol aplicado en la base de datos, archivos privados que sólo se abren con enlaces temporales, verificación en dos pasos para quienes administran y validan, y una bitácora de las acciones importantes.',
        'Ningún sistema es infalible. Si ocurre una vulneración de seguridad que afecte de forma significativa tus derechos, te avisaremos sin demora para que puedas tomar medidas.',
      ],
    },
    {
      id: 'conservacion', title: '7. Cuánto tiempo conservamos tus datos',
      blocks: [
        'Conservamos tus datos mientras tengas una cuenta en SkillPass. Si solicitas la baja de tu cuenta, los eliminaremos o los haremos anónimos en un plazo razonable, normalmente no mayor a 30 días, salvo los que debamos conservar por obligación legal o para resolver una controversia.',
      ],
    },
    {
      id: 'derechos', title: '8. Tus derechos y cómo ejercerlos',
      blocks: [
        'Tienes derecho a conocer qué datos tenemos de ti y cómo los usamos (acceso), a que los corrijamos (rectificación), a que los eliminemos cuando ya no deban tratarse (cancelación) y a oponerte a que los usemos para fines específicos (oposición). También puedes revocar tu consentimiento y pedirnos limitar el uso o la divulgación de tus datos.',
        'Muchas de estas decisiones puedes tomarlas tú mismo en la plataforma: editar tu perfil, y activar o desactivar tu página pública, tu aparición ante empresas y la verificación pública de cada credencial.',
        `Para ejercer tus derechos envía una solicitud a ${e.email} con:`,
        { list: [
          'Tu nombre completo y el correo de tu cuenta, u otro medio para responderte.',
          'Un documento que acredite tu identidad o, en su caso, la de tu representante.',
          'La descripción clara de los datos y del derecho que quieres ejercer.',
          'Cualquier dato que nos ayude a localizar tu información.',
        ] },
        'Te responderemos en un máximo de 20 días hábiles desde que recibamos tu solicitud completa y, si procede, la haremos efectiva dentro de los 15 días hábiles siguientes. Revocar tu consentimiento o cancelar datos necesarios para el servicio puede implicar que ya no podamos mantener tu cuenta.',
      ],
    },
    {
      id: 'cookies', title: '9. Cookies',
      blocks: [
        'SkillPass sólo usa las cookies necesarias para funcionar: mantener tu sesión, recordar tu idioma y, en la demo, tu escenario de prueba. No usamos cookies de publicidad ni herramientas de terceros que rastreen tu navegación.',
      ],
    },
    {
      id: 'menores', title: '10. Menores de edad',
      blocks: [
        'SkillPass está dirigido a personas mayores de 18 años. Si sabemos que una persona menor de edad creó una cuenta sin la autorización de su madre, padre o tutor, la daremos de baja.',
      ],
    },
    {
      id: 'cambios', title: '11. Cambios a este aviso',
      blocks: [
        'Publicaremos cualquier cambio en esta página, con su fecha. Si el cambio es importante, te pediremos aceptar la nueva versión la siguiente vez que entres a SkillPass.',
      ],
    },
    {
      id: 'autoridad', title: '12. Autoridad',
      blocks: [
        'Si consideras que tu derecho a la protección de datos personales fue vulnerado, puedes acudir ante la autoridad competente en la materia, que a la fecha de este aviso es la Secretaría Anticorrupción y Buen Gobierno.',
      ],
    },
  ],
});

const en = (e: Entity): LegalDocument => ({
  title: 'Privacy notice',
  summary: 'SkillPass records the work you do in real challenges so that a company can validate it and turn it into a verifiable credential. '
    + 'For that we need some of your data. Here we tell you which data, what for, who sees it and how you decide about it. '
    + 'Nothing of yours is public unless you turn it on, and we do not sell your data.',
  sections: [
    {
      id: 'responsable', title: '1. Who is responsible for your data',
      blocks: [
        `${e.name} ("AINDEV"), with address at ${e.address}, is responsible for processing your personal data in SkillPass by AINDEV NEXUS ("SkillPass"), `
        + 'under Mexico\'s Federal Law on Protection of Personal Data Held by Private Parties (Ley Federal de Protección de Datos Personales en Posesión de los Particulares).',
        `For any matter about your personal data, write to ${e.email}.`,
      ],
    },
    {
      id: 'datos', title: '2. What data we collect',
      blocks: [
        'We collect the data you give us when you create your account and use the platform, and the data your activity generates:',
        { list: [
          'Your account: full name, e-mail address, password (stored encrypted; nobody at AINDEV can read it), account type and, if your role requires it, your second authentication factor.',
          'Your profile, if you are a student: headline, biography, city, university, degree programme, semester, interests, availability and the competencies you declare.',
          'Your organization, if you represent a company or a university: name, website, description, the people who belong to it in SkillPass, the e-mail addresses of the people you invite and, for universities, their institutional e-mail domains.',
          'Your activity: the challenges you apply to and your motivation message; tasks; evidence (files and links) and its descriptions; hour records; validation requests; the assessments, comments and decisions of those who validate your work; your credentials; the reports you send and your notifications.',
          'Technical data: date and time of your actions (audit log), the cookies needed to keep your session and, for security, the IP address and browser data that our infrastructure providers record.',
        ] },
        'We do not ask for sensitive personal data (such as ethnic origin, health, beliefs or sexual orientation) or for financial or banking data. Please do not include them in your profile or your evidence.',
      ],
    },
    {
      id: 'finalidades', title: '3. What we use your data for',
      blocks: [
        'Purposes that are necessary to give you the service:',
        { list: [
          'Create and manage your account and identify you when you sign in.',
          'Run the challenges: publish them, receive applications, assign participants and record tasks, evidence and hours.',
          'Validate your work and issue, display, verify and, where applicable, revoke credentials.',
          'Check your link with your university and show it academic information about its students.',
          'Show your profile to verified companies and publish your SkillPass page, only when you turn it on.',
          'Send you service messages: account confirmation, password recovery and notices about your challenges, validations and credentials.',
          'Protect the platform: prevent fraud and abuse, scan files with antivirus, limit sign-in attempts, keep an audit log and handle incidents.',
          'Comply with legal obligations and requests from competent authorities.',
          'Produce statistics about the use of the platform with aggregated data that does not identify you.',
        ] },
        'Additional purposes, which are not necessary for the service:',
        { list: [
          'Send you news and invitations about SkillPass.',
          'Invite you to surveys or interviews to improve the platform.',
        ] },
        `You can refuse the additional purposes at any time by writing to ${e.email}. Refusing does not affect your use of SkillPass.`,
      ],
    },
    {
      id: 'visibilidad', title: '4. Who can see your data inside SkillPass',
      blocks: [
        'The platform shows each person only what they need:',
        { list: [
          'The company of the challenge you take part in and the people who supervise it: your name, your profile, your application, your tasks, the evidence you submit, your hours and the result of each validation in that challenge.',
          'Your teammates in the same challenge: your name and your participation in the team. They do not see your hours.',
          'Your university, when your link is verified: your name, degree programme and semester, and summary figures (challenges, validated hours, competencies and credentials). While it reviews your membership request it also sees your e-mail address. It does not see your evidence or the detail of your hours.',
          'Verified companies, only if you turn on "Open to opportunities": your profile and your verified competencies and credentials.',
          'Anyone, only if you turn it on: your public SkillPass page. In addition, whoever holds the code or the QR of a credential can verify it and see your name, the challenge, the company, the validated hours, the competencies assessed and who validated them; you can turn off public verification for each credential. For confidential projects the company and the project details are not shown.',
          'The AINDEV team that administers the platform, to operate it, support you and handle incidents.',
        ] },
      ],
    },
    {
      id: 'transferencias', title: '5. Who we share your data with',
      blocks: [
        'We share your data with the companies and universities that take part with you in SkillPass, and with the public when you decide so, as described in section 4. These disclosures are part of the service you request or depend on a decision you make inside the platform; by accepting this notice you authorize them.',
        'We may also share your data with competent authorities when the law requires it.',
        'To operate SkillPass we use providers that process data on our behalf and only to provide their service to us: database, authentication and file storage (Supabase); application hosting (Vercel); e-mail delivery (Resend); and, when active, antivirus scanning of files and bot protection (Cloudflare Turnstile). Their servers are in the United States, so your data is stored and processed in that country.',
        'We do not sell or rent your personal data.',
      ],
    },
    {
      id: 'seguridad', title: '6. How we protect your data',
      blocks: [
        'We use encrypted connections, role-based access control enforced in the database, private files that open only through temporary links, two-step verification for those who administer and validate, and an audit log of important actions.',
        'No system is infallible. If a security breach significantly affects your rights, we will tell you without delay so that you can take measures.',
      ],
    },
    {
      id: 'conservacion', title: '7. How long we keep your data',
      blocks: [
        'We keep your data while you have a SkillPass account. If you ask us to close your account, we will delete or anonymize your data within a reasonable period, normally no longer than 30 days, except for what we must keep by legal obligation or to resolve a dispute.',
      ],
    },
    {
      id: 'derechos', title: '8. Your rights and how to exercise them',
      blocks: [
        'You have the right to know what data we hold about you and how we use it (access), to have it corrected (rectification), to have it deleted when it should no longer be processed (cancellation) and to object to its use for specific purposes (opposition). You can also withdraw your consent and ask us to limit the use or disclosure of your data.',
        'You can make many of these decisions yourself in the platform: edit your profile, and turn on or off your public page, your visibility to companies and the public verification of each credential.',
        `To exercise your rights, send a request to ${e.email} with:`,
        { list: [
          'Your full name and the e-mail address of your account, or another way to answer you.',
          'A document that proves your identity or, where applicable, that of your representative.',
          'A clear description of the data and of the right you want to exercise.',
          'Anything that helps us locate your information.',
        ] },
        'We will answer within 20 business days of receiving your complete request and, if it proceeds, carry it out within the following 15 business days. Withdrawing your consent or cancelling data that the service needs may mean we can no longer keep your account.',
      ],
    },
    {
      id: 'cookies', title: '9. Cookies',
      blocks: [
        'SkillPass uses only the cookies it needs to work: to keep your session, remember your language and, in the demo, your test scenario. We do not use advertising cookies or third-party tools that track your browsing.',
      ],
    },
    {
      id: 'menores', title: '10. Minors',
      blocks: [
        'SkillPass is intended for people aged 18 or over. If we learn that a minor created an account without the authorization of their mother, father or guardian, we will close it.',
      ],
    },
    {
      id: 'cambios', title: '11. Changes to this notice',
      blocks: [
        'We will publish any change on this page, with its date. If the change is important, we will ask you to accept the new version the next time you sign in to SkillPass.',
      ],
    },
    {
      id: 'autoridad', title: '12. Authority',
      blocks: [
        'If you believe your right to the protection of personal data has been infringed, you may go to the competent authority, which at the date of this notice is Mexico\'s Secretaría Anticorrupción y Buen Gobierno.',
      ],
    },
  ],
});
