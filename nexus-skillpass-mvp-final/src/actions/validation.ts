'use server';

import type { ActionState } from '@/lib/action-state';
import { fdJson, runAction } from '@/lib/server/action';
import { write } from '@/lib/server/backend';
import { validationSchema } from '@/lib/schemas';

export async function completeValidation(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const input = validationSchema.parse(fdJson(fd));
    const result = await write<{ outcome: string; credential_code: string | null }>('sp_complete_validation', input);
    return { message: 'completed', data: { outcome: result.outcome, credential_code: result.credential_code } };
  });
}
