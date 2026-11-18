'use server';

import type { ActionState } from '@/lib/action-state';
import { fdBool, fdString, runAction } from '@/lib/server/action';
import { write } from '@/lib/server/backend';
import { AppError } from '@/lib/server/errors';

/** The signed-in person's choice about e-mail notices: on or off, and in which language. */
export async function setEmailSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const locale = fdString(fd, 'locale');
    if (locale !== '' && locale !== 'es' && locale !== 'en') throw new AppError('invalid_field', 400, 'locale');
    await write('sp_set_email_settings', { enabled: fdBool(fd, 'enabled'), locale: locale || null });
  });
}
