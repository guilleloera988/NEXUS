// Fictional demo personas (see supabase/seed.sql). Safe to import from client code.
export const DEMO_PERSONAS = {
  student: { userId: '10000000-0000-4000-8000-000000000001', email: 'maria.torres@demo.skillpass.invalid', name: 'María Torres' },
  company: { userId: '10000000-0000-4000-8000-000000000003', email: 'laura.rios@demo.skillpass.invalid', name: 'Laura Ríos' },
  supervisor: { userId: '10000000-0000-4000-8000-000000000002', email: 'carlos.mendez@demo.skillpass.invalid', name: 'Carlos Méndez' },
  university: { userId: '10000000-0000-4000-8000-000000000004', email: 'elena.vazquez@demo.skillpass.invalid', name: 'Dra. Elena Vázquez' },
  admin: { userId: '10000000-0000-4000-8000-000000000005', email: 'admin@demo.skillpass.invalid', name: 'Equipo AINDEV (DEMO)' },
} as const;

export type DemoPersona = keyof typeof DEMO_PERSONAS;
export const DEMO_PERSONA_KEYS = Object.keys(DEMO_PERSONAS) as DemoPersona[];

/** Stable identifiers of the guided demo scenario. */
export const DEMO_IDS = {
  challenge: '40000000-0000-4000-8000-000000000001',
  completedChallenge: '40000000-0000-4000-8000-000000000002',
  studentSlug: 'maria-torres-demo',
  seededCredential: 'SKP-2026-4A7C-91D2',
} as const;

export function personaForUser(userId: string | null | undefined): DemoPersona | null {
  if (!userId) return null;
  return DEMO_PERSONA_KEYS.find((key) => DEMO_PERSONAS[key].userId === userId) ?? null;
}
