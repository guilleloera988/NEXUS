import type { LegalDocument, LegalText } from './config';

/*
 * Terms and conditions. DRAFT for legal review: it describes how the platform works today. Keep it in
 * step with the product, and change LEGAL_VERSION in config.ts with every change here. Spanish is the
 * binding text; English is a courtesy.
 */
export const termsOfService: LegalText = (locale, entity) => (locale === 'en' ? en(entity) : es(entity));

type Entity = Parameters<LegalText>[1];

const es = (e: Entity): LegalDocument => ({
  title: 'Términos y condiciones',
  summary: 'SkillPass conecta a estudiantes, empresas y universidades alrededor de retos reales. Los estudiantes trabajan en un reto, una persona de la empresa valida ese trabajo '
    + 'y el resultado es una credencial verificable. Estos términos explican las reglas para usar la plataforma. Al crear una cuenta o usar SkillPass los aceptas.',
  sections: [
    {
      id: 'servicio', title: '1. Qué es SkillPass y quién lo opera',
      blocks: [
        `SkillPass by AINDEV NEXUS («SkillPass») es una plataforma operada por ${e.name} («AINDEV»), con domicilio en ${e.address}.`,
        'En SkillPass, las empresas verificadas publican retos; los estudiantes aplican, trabajan y registran evidencias y horas; las personas que supervisan el reto validan ese trabajo, y la plataforma emite credenciales que cualquiera puede verificar con un código o un QR. Las universidades verificadas ven el avance de sus estudiantes.',
        'AINDEV opera la plataforma. No es empleador de los estudiantes, no es agencia de colocación y no es parte de los acuerdos entre estudiantes, empresas y universidades.',
      ],
    },
    {
      id: 'cuenta', title: '2. Tu cuenta',
      blocks: [
        { list: [
          'Debes tener 18 años o más para crear una cuenta.',
          'Los datos que registres deben ser verdaderos y estar actualizados. Una cuenta es personal: no la compartas ni la uses a nombre de otra persona.',
          'Cuida tu contraseña y avísanos si crees que alguien más entró a tu cuenta. Las cuentas que administran la plataforma o validan trabajo usan verificación en dos pasos.',
          'Si representas a una empresa o a una universidad, declaras que tienes autorización para actuar en su nombre. AINDEV verifica a las organizaciones antes de que puedan publicar retos o administrar estudiantes, y puede retirar esa verificación.',
        ] },
      ],
    },
    {
      id: 'retos', title: '3. Retos',
      blocks: [
        'La empresa que publica un reto es responsable de su contenido y de cumplir lo que ofrece: el problema, los entregables, las fechas, la compensación, la propiedad intelectual y la confidencialidad que declara.',
        'Cada reto indica si tiene compensación y de qué tipo. Para cuidar un trato justo, los retos sin compensación tienen un máximo de horas estimadas.',
        'Participar en un reto no crea una relación laboral con AINDEV. La relación entre el estudiante y la empresa se rige por las condiciones del reto y por los acuerdos que ellos celebren, y cada parte es responsable de cumplir las obligaciones legales que le correspondan.',
        'El estudiante decide a qué retos aplica y puede retirar su postulación. La empresa decide a quién acepta y puede dar por terminada una participación conforme a las condiciones del reto.',
      ],
    },
    {
      id: 'contenido', title: '4. Tu contenido',
      blocks: [
        'Tú conservas los derechos sobre lo que subes a SkillPass (perfil, evidencias, descripciones, comentarios). Nos das permiso para guardarlo, procesarlo y mostrarlo a las personas que deben verlo según las reglas de la plataforma, con el único fin de operar el servicio.',
        'Eres responsable de lo que subes. No subas:',
        { list: [
          'Contenido que no sea tuyo o para el que no tengas permiso, incluida información confidencial de terceros.',
          'Datos personales de otras personas sin su autorización, ni datos personales sensibles.',
          'Archivos con software malicioso, ni contenido ilegal, engañoso, ofensivo o que vulnere derechos de otras personas.',
        ] },
        'Los archivos pasan por controles de seguridad y pueden rechazarse. AINDEV puede retirar contenido que incumpla estos términos.',
      ],
    },
    {
      id: 'propiedad', title: '5. Propiedad intelectual y confidencialidad de los retos',
      blocks: [
        'La propiedad intelectual de lo que se produce en un reto se rige por la política que la empresa declara al publicarlo y por los acuerdos entre la empresa y el estudiante. AINDEV no adquiere derechos sobre ese trabajo.',
        'Si un reto es confidencial o limita lo que puede publicarse, todas las personas que participan deben respetarlo, dentro y fuera de SkillPass. La plataforma oculta al público los datos de los proyectos confidenciales, pero cada participante es responsable de lo que comparte por otros medios.',
        'La marca, el diseño y el software de SkillPass pertenecen a AINDEV o a sus licenciantes. Estos términos no te dan derechos sobre ellos más allá de usar la plataforma.',
      ],
    },
    {
      id: 'credenciales', title: '6. Validación y credenciales',
      blocks: [
        'Una credencial refleja lo que una persona de la empresa validó: las horas que verificó y las competencias que evaluó con base en tus evidencias. No es un título ni un certificado oficial, y AINDEV no garantiza las competencias de ninguna persona.',
        'Quien valida debe hacerlo con honestidad y sólo sobre trabajo que realmente revisó. Nadie puede validar su propio trabajo.',
        'AINDEV puede revocar una credencial si detecta un error, datos falsos o fraude. La revocación queda visible al verificarla.',
        'Tú decides si tu página SkillPass es pública y si cada credencial puede verificarse públicamente.',
      ],
    },
    {
      id: 'universidades', title: '7. Universidades',
      blocks: [
        'El vínculo entre un estudiante y una universidad se confirma con el correo institucional o con la aprobación del personal de la universidad. La universidad puede rechazar o retirar ese vínculo.',
        'La universidad se compromete a usar la información de sus estudiantes sólo para fines académicos y de seguimiento, conforme a su propio aviso de privacidad.',
      ],
    },
    {
      id: 'conducta', title: '8. Lo que no está permitido',
      blocks: [
        { list: [
          'Registrar horas, evidencias o validaciones falsas, o acordar validaciones que no correspondan al trabajo realizado.',
          'Hacerte pasar por otra persona u organización, o crear cuentas para evadir una suspensión.',
          'Acosar, discriminar o tratar de forma abusiva a otras personas.',
          'Intentar entrar a cuentas o datos ajenos, eludir las medidas de seguridad, sobrecargar el servicio o extraer información de forma automatizada.',
          'Usar SkillPass para fines ilegales o distintos a los descritos en estos términos.',
        ] },
        'Si ves algo que incumple estas reglas, repórtalo desde la plataforma o al correo de contacto.',
      ],
    },
    {
      id: 'suspension', title: '9. Suspensión y baja',
      blocks: [
        'Si incumples estos términos, AINDEV puede limitar o suspender tu cuenta, retirar contenido o revocar credenciales. Cuando sea posible te avisaremos y te daremos oportunidad de aclarar la situación.',
        `Puedes dejar de usar SkillPass cuando quieras y pedir la baja de tu cuenta escribiendo a ${e.email}.`,
      ],
    },
    {
      id: 'servicio-piloto', title: '10. Disponibilidad del servicio',
      blocks: [
        'SkillPass está en etapa piloto. Trabajamos para que funcione de forma continua y segura, pero puede cambiar, tener interrupciones o errores. Te recomendamos conservar copia de tus archivos importantes.',
        'Durante el piloto el uso de la plataforma no tiene costo. Si eso cambia, lo avisaremos con anticipación y no se aplicará sin tu aceptación.',
      ],
    },
    {
      id: 'responsabilidad', title: '11. Responsabilidad',
      blocks: [
        'AINDEV responde por la operación de la plataforma y por el tratamiento de tus datos conforme al Aviso de Privacidad. En la medida que la ley lo permita, AINDEV no es responsable de:',
        { list: [
          'El contenido, las ofertas o la conducta de estudiantes, empresas y universidades, ni del cumplimiento de los acuerdos entre ellos.',
          'Las decisiones que terceros tomen con base en un perfil o una credencial.',
          'Daños indirectos o pérdida de oportunidades derivados del uso de la plataforma o de su interrupción.',
        ] },
        'Nada de lo anterior limita los derechos que la ley te reconoce y que no pueden renunciarse.',
      ],
    },
    {
      id: 'cambios', title: '12. Cambios a estos términos',
      blocks: [
        'Podemos actualizar estos términos. Publicaremos la nueva versión en esta página con su fecha y, si el cambio es importante, te pediremos aceptarla la siguiente vez que entres. Si no estás de acuerdo, puedes pedir la baja de tu cuenta.',
      ],
    },
    {
      id: 'ley', title: '13. Ley aplicable y jurisdicción',
      blocks: [
        `Estos términos se rigen por las leyes de los Estados Unidos Mexicanos. Para cualquier controversia, las partes se someten a los tribunales competentes de ${e.jurisdiction}, sin perjuicio de los derechos que la ley reconoce a las personas consumidoras.`,
      ],
    },
    {
      id: 'contacto', title: '14. Contacto',
      blocks: [
        `Para dudas sobre estos términos o sobre tu cuenta escribe a ${e.email}.`,
      ],
    },
  ],
});

const en = (e: Entity): LegalDocument => ({
  title: 'Terms and conditions',
  summary: 'SkillPass connects students, companies and universities around real challenges. Students work on a challenge, a person from the company validates that work '
    + 'and the result is a verifiable credential. These terms explain the rules for using the platform. By creating an account or using SkillPass you accept them.',
  sections: [
    {
      id: 'servicio', title: '1. What SkillPass is and who operates it',
      blocks: [
        `SkillPass by AINDEV NEXUS ("SkillPass") is a platform operated by ${e.name} ("AINDEV"), with address at ${e.address}.`,
        'In SkillPass, verified companies publish challenges; students apply, work and record evidence and hours; the people who supervise the challenge validate that work, and the platform issues credentials that anyone can verify with a code or a QR. Verified universities see the progress of their students.',
        'AINDEV operates the platform. It is not the students\' employer, it is not a placement agency and it is not a party to the agreements between students, companies and universities.',
      ],
    },
    {
      id: 'cuenta', title: '2. Your account',
      blocks: [
        { list: [
          'You must be 18 or older to create an account.',
          'The data you register must be true and up to date. An account is personal: do not share it or use it on behalf of someone else.',
          'Look after your password and tell us if you believe someone else accessed your account. Accounts that administer the platform or validate work use two-step verification.',
          'If you represent a company or a university, you declare that you are authorized to act on its behalf. AINDEV verifies organizations before they can publish challenges or manage students, and may withdraw that verification.',
        ] },
      ],
    },
    {
      id: 'retos', title: '3. Challenges',
      blocks: [
        'The company that publishes a challenge is responsible for its content and for honouring what it offers: the problem, the deliverables, the dates, the compensation, the intellectual property and the confidentiality it declares.',
        'Each challenge states whether it is compensated and how. To keep things fair, challenges without compensation have a maximum number of estimated hours.',
        'Taking part in a challenge does not create an employment relationship with AINDEV. The relationship between the student and the company is governed by the conditions of the challenge and by the agreements they make, and each party is responsible for meeting its own legal obligations.',
        'The student decides which challenges to apply to and may withdraw an application. The company decides whom to accept and may end a participation under the conditions of the challenge.',
      ],
    },
    {
      id: 'contenido', title: '4. Your content',
      blocks: [
        'You keep the rights to what you upload to SkillPass (profile, evidence, descriptions, comments). You give us permission to store it, process it and show it to the people who must see it under the rules of the platform, only to operate the service.',
        'You are responsible for what you upload. Do not upload:',
        { list: [
          'Content that is not yours or that you have no permission to use, including confidential information of third parties.',
          'Personal data of other people without their authorization, or sensitive personal data.',
          'Files with malicious software, or content that is illegal, misleading, offensive or that infringes the rights of others.',
        ] },
        'Files go through security checks and may be refused. AINDEV may remove content that breaches these terms.',
      ],
    },
    {
      id: 'propiedad', title: '5. Intellectual property and confidentiality of challenges',
      blocks: [
        'The intellectual property of what is produced in a challenge is governed by the policy the company declares when publishing it and by the agreements between the company and the student. AINDEV acquires no rights over that work.',
        'If a challenge is confidential or limits what may be published, everyone taking part must respect it, inside and outside SkillPass. The platform hides the details of confidential projects from the public, but each participant is responsible for what they share by other means.',
        'The SkillPass brand, design and software belong to AINDEV or its licensors. These terms give you no rights over them beyond using the platform.',
      ],
    },
    {
      id: 'credenciales', title: '6. Validation and credentials',
      blocks: [
        'A credential reflects what a person from the company validated: the hours they verified and the competencies they assessed based on your evidence. It is not a degree or an official certificate, and AINDEV does not guarantee anyone\'s competencies.',
        'Whoever validates must do so honestly and only for work they actually reviewed. Nobody may validate their own work.',
        'AINDEV may revoke a credential if it finds an error, false data or fraud. The revocation is visible when the credential is verified.',
        'You decide whether your SkillPass page is public and whether each credential can be verified publicly.',
      ],
    },
    {
      id: 'universidades', title: '7. Universities',
      blocks: [
        'The link between a student and a university is confirmed with the institutional e-mail address or with the approval of the university\'s staff. The university may reject or withdraw that link.',
        'The university undertakes to use its students\' information only for academic and follow-up purposes, under its own privacy notice.',
      ],
    },
    {
      id: 'conducta', title: '8. What is not allowed',
      blocks: [
        { list: [
          'Recording false hours, evidence or validations, or arranging validations that do not match the work done.',
          'Impersonating another person or organization, or creating accounts to evade a suspension.',
          'Harassing, discriminating against or abusing other people.',
          'Trying to access other people\'s accounts or data, bypassing security measures, overloading the service or extracting information by automated means.',
          'Using SkillPass for illegal purposes or for purposes other than those described in these terms.',
        ] },
        'If you see something that breaks these rules, report it from the platform or to the contact address.',
      ],
    },
    {
      id: 'suspension', title: '9. Suspension and closing your account',
      blocks: [
        'If you breach these terms, AINDEV may limit or suspend your account, remove content or revoke credentials. Where possible we will tell you and give you the chance to explain.',
        `You can stop using SkillPass whenever you want and ask us to close your account by writing to ${e.email}.`,
      ],
    },
    {
      id: 'servicio-piloto', title: '10. Availability of the service',
      blocks: [
        'SkillPass is in a pilot stage. We work to keep it running continuously and securely, but it may change, be interrupted or contain errors. We recommend that you keep a copy of your important files.',
        'During the pilot the platform is free to use. If that changes, we will give notice in advance and it will not apply without your acceptance.',
      ],
    },
    {
      id: 'responsabilidad', title: '11. Liability',
      blocks: [
        'AINDEV answers for the operation of the platform and for the processing of your data under the Privacy Notice. To the extent the law allows, AINDEV is not liable for:',
        { list: [
          'The content, offers or conduct of students, companies and universities, or the performance of the agreements between them.',
          'Decisions that third parties make based on a profile or a credential.',
          'Indirect damages or loss of opportunities arising from the use of the platform or from its interruption.',
        ] },
        'Nothing above limits the rights the law grants you and that cannot be waived.',
      ],
    },
    {
      id: 'cambios', title: '12. Changes to these terms',
      blocks: [
        'We may update these terms. We will publish the new version on this page with its date and, if the change is important, we will ask you to accept it the next time you sign in. If you do not agree, you can ask us to close your account.',
      ],
    },
    {
      id: 'ley', title: '13. Governing law and jurisdiction',
      blocks: [
        `These terms are governed by the laws of the United Mexican States. For any dispute, the parties submit to the competent courts of ${e.jurisdiction}, without prejudice to the rights the law grants to consumers.`,
      ],
    },
    {
      id: 'contacto', title: '14. Contact',
      blocks: [
        `For questions about these terms or about your account, write to ${e.email}.`,
      ],
    },
  ],
});
