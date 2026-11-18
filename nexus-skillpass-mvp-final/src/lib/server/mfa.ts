import 'server-only';
import { cache } from 'react';
import type { Role } from '@/lib/types';
import { getSession, read } from './backend';
import { supabaseServer } from './supabase';

/** Roles that must complete the second factor before using the platform when the database requires it. */
export const MFA_ROLES: readonly Role[] = ['admin', 'supervisor'];

export interface MfaState {
  /** platform_settings.mfa_required (false in DEMO, and on databases without migration 20261103000002). */
  required: boolean;
  /** Assurance level of the current session, as the database reads it from the verified JWT. */
  aal: string;
  /** The user's verified TOTP factor, if any. */
  factorId: string | null;
}

const OFF: MfaState = { required: false, aal: 'aal1', factorId: null };

/** Second-factor state of the signed-in Supabase user. The database enforces it; this only drives the screens. */
export const getMfaState = cache(async (): Promise<MfaState> => {
  const session = await getSession();
  if (session?.mode !== 'supabase') return OFF;
  const status = await read<{ required: boolean; aal: string } | null>('sp_mfa_status').catch(() => null);
  if (!status?.required) return { ...OFF, aal: status?.aal ?? 'aal1' };
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.mfa.listFactors();
  return { required: true, aal: status.aal, factorId: data?.totp?.[0]?.id ?? null };
});

/** True when the session still has to complete the second factor (for everyone, or only for MFA_ROLES). */
export const mfaPending = (state: MfaState, role?: Role) =>
  state.required && state.aal !== 'aal2' && (role === undefined || MFA_ROLES.includes(role));
