'use server';

import { redirect } from 'next/navigation';
import type { ActionState } from '@/lib/action-state';
import { fdJson, fdString, runAction } from '@/lib/server/action';
import { write } from '@/lib/server/backend';
import {
  applySchema, challengeSchema, challengeStatusSchema, decisionSchema, endAssignmentSchema, inviteToChallengeSchema,
} from '@/lib/schemas';

export async function saveChallenge(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let id = '';
  const result = await runAction(async () => {
    const input = challengeSchema.parse(fdJson(fd));
    const saved = await write<{ id: string }>('sp_save_challenge', input);
    id = saved.id;
    const publish = fdString(fd, 'publish');
    if (publish === 'recruiting') await write('sp_set_challenge_status', { challenge_id: id, status: 'recruiting' });
    return { id, message: 'created' };
  });
  if (result.ok && id) redirect(`/challenges/${id}`);
  return result;
}

export async function setChallengeStatus(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await write('sp_set_challenge_status', challengeStatusSchema.parse({ challenge_id: fdString(fd, 'challenge_id'), status: fdString(fd, 'status') }));
    return { message: 'saved' };
  });
}

export async function applyToChallenge(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await write('sp_apply', applySchema.parse({
      challenge_id: fdString(fd, 'challenge_id'), motivation: fdString(fd, 'motivation'), availability_note: fdString(fd, 'availability_note'),
    }));
    return { message: 'applicationSent' };
  });
}

export async function withdrawApplication(fd: FormData) {
  await runAction(async () => { await write('sp_withdraw_application', { application_id: fdString(fd, 'application_id') }); });
}

export async function decideApplication(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await write('sp_decide_application', decisionSchema.parse({
      application_id: fdString(fd, 'application_id'), decision: fdString(fd, 'decision'), note: fdString(fd, 'note'),
    }));
    return { message: 'saved' };
  });
}

export async function endAssignment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await write('sp_end_assignment', endAssignmentSchema.parse({ assignment_id: fdString(fd, 'assignment_id'), reason: fdString(fd, 'reason') }));
    return { message: 'saved' };
  });
}

export async function inviteToChallenge(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await write('sp_invite_to_challenge', inviteToChallengeSchema.parse({
      challenge_id: fdString(fd, 'challenge_id'), student_id: fdString(fd, 'student_id'), message: fdString(fd, 'message'),
    }));
    return { message: 'inviteSent' };
  });
}
