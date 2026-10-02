'use client';

import dynamic from 'next/dynamic';

/** The walkthrough depends on localStorage and the current URL, so it renders on the client only. */
export const GuidedDemoLoader = dynamic(() => import('./guided-demo').then((m) => m.GuidedDemo), { ssr: false });
