import { z } from 'zod';

const id = z.string().uuid();
const short = z.string().trim().min(1).max(180);
const text = z.string().trim().max(5000);
const optionalText = z.string().trim().max(500).default('');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s, 'Fecha inválida');
const skillIds = z.array(id).min(1).max(12).refine(a => new Set(a).size === a.length, 'Skills duplicadas');
const httpsUrl = z.string().trim().url().max(2048).refine(value => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password;
}, 'Usa una URL HTTPS sin credenciales');
const experience = z.object({
  challenge_id: id.nullish(), organization_id: id, title: short,
  description: text.min(10), responsibilities: text.min(3), deliverables: text.min(3),
  start_date: date, end_date: date, hours: z.number().positive().max(2000), skill_ids: skillIds,
}).strict();
const chronological = <T extends {start_date: string; end_date: string}>(s: T) => s.start_date <= s.end_date;
export const actionSchemas = {
  update_profile: z.object({full_name: short, headline: optionalText, location: optionalText, university: optionalText, career: optionalText, bio: text.default(''), interests: optionalText, semester: z.string().max(30).default(''), is_public: z.boolean()}).strict(),
  join_challenge: z.object({challenge_id: id}).strict(),
  create_experience: experience.refine(chronological, 'El periodo está invertido'),
  update_experience: experience.extend({id}).refine(chronological, 'El periodo está invertido'),
  add_evidence: z.object({experience_id:id,title:short,description:text.min(3),url:httpsUrl,kind:z.enum(['url','repository','document','image','presentation','result']),is_public:z.boolean()}).strict(),
  request_validation: z.object({experience_id:id}).strict(),
  validate_experience: z.object({experience_id:id,decision:z.enum(['approve','request_changes','reject']),comment:text.min(5),rating:z.number().int().min(1).max(5),verified_hours:z.number().min(0).max(2000)}).strict(),
  revoke_credential: z.object({credential_id:id,reason:text.min(5)}).strict(),
  create_organization: z.object({name:short,type:z.enum(['company','university','nonprofit','government','aindev'])}).strict(),
  create_skill: z.object({name:short,category:z.enum(['technical','business','human'])}).strict(),
  create_challenge: z.object({organization_id:id,title:short,description:text.min(10),problem:text.min(3),expected_outcome:text.min(3),modality:short,start_date:date,end_date:date,skill_ids:skillIds}).strict().refine(chronological,'El periodo está invertido'),
  set_member: z.object({user_id:id,organization_id:id,role:z.enum(['student','supervisor','university'])}).strict(),
};
export type ActionName = keyof typeof actionSchemas;
export function parseAction(input: unknown) {
  const envelope = z.object({action:z.enum(Object.keys(actionSchemas) as [ActionName,...ActionName[]]),payload:z.unknown()}).strict().parse(input);
  return {action:envelope.action,payload:actionSchemas[envelope.action].parse(envelope.payload)};
}
export const authSchema = z.discriminatedUnion('intent',[
  z.object({intent:z.literal('demo'),role:z.enum(['student','supervisor','university','admin']).default('student')}).strict(),
  z.object({intent:z.literal('logout')}).strict(),
  z.object({intent:z.literal('login'),email:z.string().email().max(254),password:z.string().min(8).max(128)}).strict(),
  z.object({intent:z.literal('signup'),email:z.string().email().max(254),password:z.string().min(12).max(128),full_name:short}).strict(),
]);
