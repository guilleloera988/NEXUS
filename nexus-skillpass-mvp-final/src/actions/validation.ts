'use server';

import { redirect } from 'next/navigation';
import type { ActionState } from '@/lib/action-state';
import { fdJson, runAction } from '@/lib/server/action';
import { write } from '@/lib/server/backend';
import { validationSchema } from '@/lib/schemas';

export async function completeValidation(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let requestId = '';
  const result = await runAction(async () => {
    const input = validationSchema.parse(fdJson(fd));
    requestId = input.request_id;
    const saved = await write<{ outcome: string; credential_code: string | null }>('sp_complete_validation', input);
    return { message: 'completed', data: { outcome: saved.outcome, credential_code: saved.credential_code } };
  });
  // The request is now read-only; show the confirmation on the resolved view.
  if (result.ok && requestId) redirect(`/validations/${requestId}?done=1`);
  return result;
}
