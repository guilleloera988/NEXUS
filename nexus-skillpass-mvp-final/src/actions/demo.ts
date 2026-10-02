'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ActionState } from '@/lib/action-state';
import { DEMO_PERSONAS, DEMO_PERSONA_KEYS, type DemoPersona } from '@/lib/demo-personas';
import { fdString, rateLimit, runAction } from '@/lib/server/action';
import { createDemoScenario, demoScenarioExists } from '@/lib/server/demo-db';
import { DEMO_COOKIE, signDemoSession, verifyDemoSession } from '@/lib/server/demo-session';
import { demoMode, demoTtlHours } from '@/lib/server/env';
import { AppError } from '@/lib/server/errors';
import { supabaseServer } from '@/lib/server/supabase';

function safeNext(value: string) {
  return value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') ? value : '/dashboard';
}

/**
 * Signs the visitor in as a fictional demo persona.
 * local    → isolated PGlite scenario per visitor (reused when switching persona).
 * supabase → password sign-in to the demo accounts of a dedicated Supabase demo project.
 */
export async function enterDemo(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const persona = fdString(fd, 'persona') as DemoPersona;
  const next = safeNext(fdString(fd, 'next') || '/dashboard');
  const fresh = fdString(fd, 'fresh') === '1';
  const result = await runAction(async () => {
    if (!DEMO_PERSONA_KEYS.includes(persona)) throw new AppError('invalid_field', 400, 'persona');
    const h = await headers();
    rateLimit(`demo:${h.get('x-forwarded-for')?.split(',')[0] ?? 'local'}`, 30);
    const mode = demoMode();
    const jar = await cookies();
    if (mode === 'local') {
      const current = await verifyDemoSession(jar.get(DEMO_COOKIE)?.value);
      const id = !fresh && current && (await demoScenarioExists(current.id)) ? current.id : await createDemoScenario();
      jar.set(DEMO_COOKIE, await signDemoSession(id, persona), {
        httpOnly: true, sameSite: 'lax', secure: h.get('x-forwarded-proto') === 'https', path: '/', maxAge: demoTtlHours() * 3600,
      });
      return;
    }
    if (mode === 'supabase') {
      const password = process.env.NEXUS_DEMO_PASSWORD;
      if (!password) throw new AppError('demo_disabled', 503);
      const supabase = await supabaseServer();
      const { error } = await supabase.auth.signInWithPassword({ email: DEMO_PERSONAS[persona].email, password });
      if (error) throw new AppError('demo_disabled', 503);
      return;
    }
    throw new AppError('demo_disabled', 503);
  });
  if (result.ok) redirect(next);
  return result;
}

export async function exitDemo() {
  (await cookies()).delete(DEMO_COOKIE);
  redirect('/demo');
}

/** Form-action variant used by the persona switcher and the guided demo. */
export async function switchPersona(fd: FormData) {
  await enterDemo({ ok: false }, fd);
}
