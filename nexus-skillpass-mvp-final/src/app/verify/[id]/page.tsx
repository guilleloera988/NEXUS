import { Suspense } from 'react';
import { PublicCredential } from '@/components/skillpass';
export default function Page(){return <Suspense fallback={<main>Abriendo registro público…</main>}><PublicCredential/></Suspense>}
