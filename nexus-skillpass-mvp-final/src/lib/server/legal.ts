import 'server-only';
import { cache } from 'react';
import { LEGAL_VERSION, legalEntity } from '@/lib/legal/config';
import { getMe, read } from './backend';

/**
 * True when the signed-in account still has to accept the current terms and privacy notice.
 * Never for DEMO personas, for deployments without the LEGAL_* values, or for databases without migration
 * 20261113000001 (they keep no acceptances, so there is nothing to ask).
 */
export const legalPending = cache(async (): Promise<boolean> => {
  if (!legalEntity()) return false;
  const me = await getMe();
  if (!me || me.mode !== 'supabase' || me.profile.is_demo) return false;
  const status = await read<{ accepted: boolean } | null>('sp_legal_status', { version: LEGAL_VERSION }).catch(() => null);
  return status?.accepted === false;
});
