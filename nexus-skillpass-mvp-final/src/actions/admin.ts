'use server';

import type { ActionState } from '@/lib/action-state';
import { fdBool, fdString, runAction } from '@/lib/server/action';
import { write } from '@/lib/server/backend';
import { competencySchema, incidentUpdateSchema, orgStatusSchema, revokeSchema, userRoleSchema } from '@/lib/schemas';

export async function setOrganizationStatus(fd: FormData) {
  await runAction(async () => {
    await write('sp_admin_set_org_status', orgStatusSchema.parse({ organization_id: fdString(fd, 'organization_id'), status: fdString(fd, 'status') }));
  });
}

export async function setUserRole(fd: FormData) {
  await runAction(async () => {
    await write('sp_admin_set_user_role', userRoleSchema.parse({ user_id: fdString(fd, 'user_id'), role: fdString(fd, 'role') }));
  });
}

export async function revokeCredential(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await write('sp_revoke_credential', revokeSchema.parse({ credential_id: fdString(fd, 'credential_id'), reason: fdString(fd, 'reason') }));
    return { message: 'done' };
  });
}

export async function saveCompetency(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await write('sp_admin_save_competency', competencySchema.parse({
      id: fdString(fd, 'id'), slug: fdString(fd, 'slug'), name_es: fdString(fd, 'name_es'), name_en: fdString(fd, 'name_en'),
      category: fdString(fd, 'category'), description_es: fdString(fd, 'description_es'), description_en: fdString(fd, 'description_en'),
      is_active: fdBool(fd, 'is_active'),
    }));
    return { message: 'saved' };
  });
}

export async function updateIncident(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await write('sp_admin_update_incident', incidentUpdateSchema.parse({
      incident_id: fdString(fd, 'incident_id'), status: fdString(fd, 'status'), resolution: fdString(fd, 'resolution'),
    }));
    return { message: 'saved' };
  });
}
