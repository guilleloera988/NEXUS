'use server';

import type { ActionState } from '@/lib/action-state';
import { fdString, runAction } from '@/lib/server/action';
import { write } from '@/lib/server/backend';
import { universityDecisionSchema, universityDomainsSchema } from '@/lib/schemas';

/** Approve or reject a student's request to be linked to the university, or remove a linked student. */
export async function decideUniversityRequest(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const input = universityDecisionSchema.parse({
      organization_id: fdString(fd, 'organization_id'), student_id: fdString(fd, 'student_id'), decision: fdString(fd, 'decision'),
    });
    await write('sp_decide_university_request', input);
    return { message: input.decision };
  });
}

/** Student e-mail domains, one per line (commas and spaces also separate them). */
export async function setUniversityDomains(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const domains = fdString(fd, 'student_email_domains').split(/[\s,;]+/).map((v) => v.trim()).filter(Boolean);
    const input = universityDomainsSchema.parse({ organization_id: fdString(fd, 'organization_id'), student_email_domains: domains });
    const result = await write<{ verified: number }>('sp_set_university_domains', input);
    return { message: 'saved', data: { verified: result.verified ?? 0 } };
  });
}
