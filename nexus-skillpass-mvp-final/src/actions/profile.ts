'use server';

import { redirect } from 'next/navigation';
import type { ActionState } from '@/lib/action-state';
import { fdAll, fdBool, fdString, runAction } from '@/lib/server/action';
import { getMe, write } from '@/lib/server/backend';
import { AppError } from '@/lib/server/errors';
import {
  incidentSchema, inviteSchema, organizationOnboardingSchema, organizationSchema, privacySchema, staffProfileSchema, studentProfileSchema,
} from '@/lib/schemas';

const lines = (value: string) => value.split(/\r?\n|,/).map((v) => v.trim()).filter(Boolean);

function studentInput(fd: FormData) {
  return studentProfileSchema.parse({
    full_name: fdString(fd, 'full_name'), headline: fdString(fd, 'headline'), bio: fdString(fd, 'bio'), location: fdString(fd, 'location'),
    university_id: fdString(fd, 'university_id'), career: fdString(fd, 'career'), semester: fdString(fd, 'semester'),
    interests: fdAll(fd, 'interests'), skill_ids: fdAll(fd, 'skill_ids'), availability: fdString(fd, 'availability') || 'part_time',
    hours_per_week: fdString(fd, 'hours_per_week'), open_to_opportunities: fdBool(fd, 'open_to_opportunities'),
  });
}

export async function completeOnboarding(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    const me = await getMe();
    if (!me) throw new AppError('auth_required', 401);
    const role = me.profile.role;
    if (role === 'student') {
      await write('sp_complete_onboarding', studentInput(fd));
    } else if ((role === 'company' || role === 'university') && me.memberships.length === 0) {
      await write('sp_complete_onboarding', organizationOnboardingSchema.parse({
        full_name: fdString(fd, 'full_name'), headline: fdString(fd, 'headline'), organization_name: fdString(fd, 'organization_name'),
        industry: fdString(fd, 'industry'), size: fdString(fd, 'size'), location: fdString(fd, 'location'), website: fdString(fd, 'website'),
        description: fdString(fd, 'description'), needs: fdString(fd, 'needs'), campus: fdString(fd, 'campus'), programs: lines(fdString(fd, 'programs')),
      }));
    } else {
      await write('sp_complete_onboarding', staffProfileSchema.parse({ full_name: fdString(fd, 'full_name'), headline: fdString(fd, 'headline') }));
    }
  });
  if (result.ok) redirect('/dashboard');
  return result;
}

export async function updateProfile(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const me = await getMe();
    if (!me) throw new AppError('auth_required', 401);
    if (me.profile.role === 'student') {
      const input = studentInput(fd);
      await write('sp_update_profile', { ...input, open_to_opportunities: me.profile.open_to_opportunities });
    } else {
      await write('sp_update_profile', staffProfileSchema.parse({ full_name: fdString(fd, 'full_name'), headline: fdString(fd, 'headline'), bio: fdString(fd, 'bio') }));
    }
    return { message: 'saved' };
  });
}

export async function updatePrivacy(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await write('sp_update_privacy', privacySchema.parse({
      skillpass_public: fdBool(fd, 'skillpass_public'), open_to_opportunities: fdBool(fd, 'open_to_opportunities'),
      public_show_university: fdBool(fd, 'public_show_university'), public_show_career: fdBool(fd, 'public_show_career'),
    }));
    return { message: 'saved' };
  });
}

export async function setCredentialVerification(fd: FormData) {
  await runAction(async () => {
    await write('sp_set_credential_verification', { credential_id: fdString(fd, 'credential_id'), enabled: fdBool(fd, 'enabled') });
  });
}

export async function updateOrganization(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await write('sp_update_organization', organizationSchema.parse({
      organization_id: fdString(fd, 'organization_id'), name: fdString(fd, 'name'), industry: fdString(fd, 'industry'), size: fdString(fd, 'size'),
      location: fdString(fd, 'location'), website: fdString(fd, 'website'), description: fdString(fd, 'description'), needs: fdString(fd, 'needs'),
      campus: fdString(fd, 'campus'), programs: lines(fdString(fd, 'programs')),
    }));
    return { message: 'saved' };
  });
}

export async function inviteMember(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const result = await write<{ status: string }>('sp_invite_member', inviteSchema.parse({
      organization_id: fdString(fd, 'organization_id'), email: fdString(fd, 'email'), member_role: fdString(fd, 'member_role'),
    }));
    return { message: result.status === 'added' ? 'added' : 'invited' };
  });
}

export async function revokeInvitation(fd: FormData) {
  await runAction(async () => { await write('sp_revoke_invitation', { invitation_id: fdString(fd, 'invitation_id') }); });
}

export async function removeMember(fd: FormData) {
  await runAction(async () => { await write('sp_remove_member', { organization_id: fdString(fd, 'organization_id'), user_id: fdString(fd, 'user_id') }); });
}

export async function markNotificationsRead(fd: FormData) {
  await runAction(async () => {
    const ids = fdAll(fd, 'id');
    await write('sp_mark_notifications_read', ids.length ? { ids } : { all: true });
  });
}

export async function reportIncident(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await write('sp_report_incident', incidentSchema.parse({
      entity_type: fdString(fd, 'entity_type') || 'other', entity_id: fdString(fd, 'entity_id'), category: fdString(fd, 'category'), description: fdString(fd, 'description'),
    }));
    return { message: 'done' };
  });
}
