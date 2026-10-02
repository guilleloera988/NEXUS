import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { AppError } from './http';
export const supabaseConfigured=()=>Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));
export async function supabaseServer() {
  if(!supabaseConfigured()) throw new AppError('Conecta Supabase con las variables de .env.example para usar cuentas reales. La DEMO está disponible en /demo.',503);
  const jar=await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookies:{getAll:()=>jar.getAll(),setAll:updates=>{for(const {name,value,options} of updates) jar.set(name,value,options);}}});
}
