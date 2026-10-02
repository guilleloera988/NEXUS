import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { DEMO_PERSONAS } from '@/lib/demo-personas';
import type { Me } from '@/lib/types';
import { demoRpc } from './demo-db';
import { DEMO_COOKIE, verifyDemoSession, type DemoSession } from './demo-session';
import { demoMode, supabaseConfig } from './env';
import { AppError, fromDatabaseError } from './errors';
import { supabaseServer } from './supabase';

/** Every RPC the application may call. Anything else is rejected before reaching the database. */
const READ_RPCS = [
  'sp_me', 'sp_lookups', 'sp_org_overview', 'sp_student_dashboard', 'sp_challenges', 'sp_challenge', 'sp_workspace',
  'sp_validation_queue', 'sp_validation', 'sp_skillpass_me', 'sp_talent_profile', 'sp_talent', 'sp_company_dashboard',
  'sp_university_dashboard', 'sp_admin_overview', 'sp_admin_list', 'sp_notifications', 'sp_evidence_file',
] as const;
const WRITE_RPCS = [
  'sp_accept_invitations', 'sp_complete_onboarding', 'sp_update_profile', 'sp_update_privacy', 'sp_update_organization',
  'sp_invite_member', 'sp_revoke_invitation', 'sp_remove_member', 'sp_save_challenge', 'sp_set_challenge_status', 'sp_apply',
  'sp_withdraw_application', 'sp_decide_application', 'sp_end_assignment', 'sp_invite_to_challenge', 'sp_save_task',
  'sp_set_task_status', 'sp_delete_task', 'sp_add_evidence', 'sp_update_evidence', 'sp_delete_evidence',
  'sp_set_evidence_visibility', 'sp_save_vath', 'sp_delete_vath', 'sp_submit_for_validation', 'sp_complete_validation',
  'sp_set_credential_verification', 'sp_revoke_credential', 'sp_admin_set_org_status', 'sp_admin_set_user_role',
  'sp_admin_set_member', 'sp_admin_save_competency', 'sp_report_incident', 'sp_admin_update_incident', 'sp_mark_notifications_read',
] as const;
const PUBLIC_RPCS = ['sp_public_skillpass', 'sp_public_credential', 'sp_public_evidence_file'] as const;

export type ReadRpc = (typeof READ_RPCS)[number];
export type WriteRpc = (typeof WRITE_RPCS)[number];
export type PublicRpc = (typeof PUBLIC_RPCS)[number];
const ALLOWED = new Set<string>([...READ_RPCS, ...WRITE_RPCS]);

export type Session =
  | { mode: 'demo'; userId: string; demo: DemoSession }
  | { mode: 'supabase'; userId: string };

/** Resolves the visitor: a signed local demo session, or a Supabase Auth user. Cached per request. */
export const getSession = cache(async (): Promise<Session | null> => {
  if (demoMode() === 'local') {
    const demo = await verifyDemoSession((await cookies()).get(DEMO_COOKIE)?.value);
    if (demo) return { mode: 'demo', userId: DEMO_PERSONAS[demo.persona].userId, demo };
  }
  if (!supabaseConfig()) return null;
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { mode: 'supabase', userId: data.user.id };
});

async function call<T>(session: Session, fn: string, payload: unknown): Promise<T> {
  if (!ALLOWED.has(fn)) throw new AppError('forbidden', 403);
  try {
    if (session.mode === 'demo') return await demoRpc<T>(session.demo.id, session.userId, fn, payload);
    const supabase = await supabaseServer();
    const { data, error } = await supabase.rpc(fn, { p: payload ?? {} });
    if (error) throw error;
    return data as T;
  } catch (error) {
    throw fromDatabaseError(error);
  }
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new AppError('auth_required', 401);
  return session;
}

/** Read RPC with the visitor's identity (RLS applies). */
export async function read<T>(fn: ReadRpc, payload: Record<string, unknown> = {}): Promise<T> {
  return call<T>(await requireSession(), fn, payload);
}

/** Mutation RPC with the visitor's identity (authorization enforced in the database). */
export async function write<T = Record<string, unknown>>(fn: WriteRpc, payload: Record<string, unknown> = {}): Promise<T> {
  return call<T>(await requireSession(), fn, payload);
}

/** Anonymous verification RPCs. `demoId` selects an isolated local demo scenario. */
export async function publicRead<T>(fn: PublicRpc, payload: Record<string, unknown>, demoId?: string | null): Promise<T | null> {
  try {
    if (demoId) {
      if (demoMode() !== 'local') return null;
      return await demoRpc<T>(demoId, null, fn, payload);
    }
    const config = supabaseConfig();
    if (!config) return null;
    const supabase = await supabaseServer();
    const { data, error } = await supabase.rpc(fn, { p: payload });
    if (error) throw error;
    return (data ?? null) as T | null;
  } catch (error) {
    const appError = fromDatabaseError(error);
    if (appError.key === 'demo_expired') return null;
    throw appError;
  }
}

/** Current user profile + memberships, or null when signed out. Cached per request. */
export const getMe = cache(async (): Promise<Me | null> => {
  const session = await getSession();
  if (!session) return null;
  try {
    const me = await call<Me | null>(session, 'sp_me', {});
    return me ? { ...me, mode: session.mode, demoId: session.mode === 'demo' ? session.demo.id : null } : null;
  } catch (error) {
    if (error instanceof AppError && (error.key === 'demo_expired' || error.status === 401 || error.status === 403)) return null;
    throw error;
  }
});
