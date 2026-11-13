'use server';

import { redirect } from 'next/navigation';
import type { ActionState } from '@/lib/action-state';
import { getLocale } from '@/lib/i18n/server';
import { LEGAL_VERSION, legalEntity } from '@/lib/legal/config';
import { fdBool, fdString, runAction } from '@/lib/server/action';
import { write } from '@/lib/server/backend';
import { AppError } from '@/lib/server/errors';
import { safeNextPath } from '@/lib/safety';

/** Records that the signed-in user accepts the current terms and privacy notice, then goes on. */
export async function acceptLegal(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const next = safeNextPath(fdString(fd, 'next'));
  const result = await runAction(async () => {
    if (!legalEntity()) throw new AppError('not_found', 404);
    if (!fdBool(fd, 'legal')) throw new AppError('legal_required', 400, 'legal');
    await write('sp_accept_legal', { version: LEGAL_VERSION, locale: await getLocale() });
  });
  if (result.ok) redirect(next);
  return result;
}
