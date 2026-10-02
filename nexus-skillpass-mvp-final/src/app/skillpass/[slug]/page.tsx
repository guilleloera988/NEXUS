import { Suspense } from 'react';
import { PublicSkillPass } from '@/components/skillpass';
export default function Page(){return <Suspense fallback={<main>Abriendo registro público…</main>}><PublicSkillPass/></Suspense>}
