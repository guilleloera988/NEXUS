import { DEMO_IDS, type DemoPersona } from './demo-personas';

/** Evaluator walkthrough: each step names the persona it needs and where it happens. */
export const GUIDE_STEPS: { persona: DemoPersona; href: string }[] = [
  { persona: 'student', href: '/dashboard' },
  { persona: 'student', href: `/challenges/${DEMO_IDS.challenge}` },
  { persona: 'student', href: `/workspace/${DEMO_IDS.challenge}` },
  { persona: 'student', href: `/workspace/${DEMO_IDS.challenge}?tab=evidence` },
  { persona: 'student', href: `/workspace/${DEMO_IDS.challenge}?tab=validation` },
  { persona: 'supervisor', href: '/validations' },
  { persona: 'student', href: '/my-skillpass' },
  { persona: 'student', href: '/demo/latest-credential' },
  { persona: 'university', href: '/dashboard' },
];

export const GUIDE_STEP_KEY = 'sp_guide_step';
export const GUIDE_OPEN_KEY = 'sp_guide_open';
