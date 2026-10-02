import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { AppError,errorResponse,json,rateLimit,readBody } from '@/lib/http';
import { authSchema } from '@/lib/validation';
import { DEMO_COOKIE,DEMO_TTL,isDemoEnabled,newDemoId,signDemo,verifyDemo } from '@/lib/demo-session';
import { demoDb } from '@/lib/demo-db';
import { supabaseServer,supabaseConfigured } from '@/lib/supabase';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest) {
  try {
    const data=authSchema.parse(await readBody(request));
    const jar=await cookies();
    const ip=request.headers.get('x-forwarded-for')?.split(',')[0]||'local';
    rateLimit('auth:'+ip,30);
    if(data.intent==='demo') {
      if(!isDemoEnabled()) throw new AppError('La DEMO local está deshabilitada. Consulta docs/DEMO.md para ejecutarla.',503);
      const prior=await verifyDemo(jar.get(DEMO_COOKIE)?.value);
      const id=prior?.id||newDemoId();
      // Sign before allocating a database so a missing production secret fails safely.
      const token=await signDemo(id,data.role);
      await demoDb(id,!prior);
      jar.set(DEMO_COOKIE,token,{httpOnly:true,sameSite:'lax',secure:request.nextUrl.protocol==='https:',path:'/',maxAge:DEMO_TTL});
      return json({ok:true,authenticated:true,mode:'demo',demoId:id});
    }
    if(data.intent==='logout') {
      jar.delete(DEMO_COOKIE);
      if(supabaseConfigured()) {
        const supabase=await supabaseServer();
        const {error}=await supabase.auth.signOut({scope:'local'});
        if(error) throw new AppError('No se pudo cerrar la sesión. Intenta de nuevo.',502);
      }
      return json({ok:true});
    }
    const supabase=await supabaseServer();
    if(data.intent==='signup') {
      const origin=process.env.NEXT_PUBLIC_APP_URL||request.nextUrl.origin;
      const {data:result,error}=await supabase.auth.signUp({email:data.email,password:data.password,options:{data:{full_name:data.full_name},emailRedirectTo:new URL('/auth/callback',origin).toString()}});
      if(error) throw new AppError('No se pudo registrar la cuenta. Revisa tus datos o intenta más tarde.',400);
      jar.delete(DEMO_COOKIE);
      return json({ok:true,authenticated:Boolean(result.session),message:result.session?'Cuenta creada.':'Revisa tu correo para confirmar la cuenta antes de iniciar sesión.'});
    }
    const {error}=await supabase.auth.signInWithPassword({email:data.email,password:data.password});
    if(error) throw new AppError('Correo o contraseña incorrectos, o cuenta pendiente de confirmación.',401);
    jar.delete(DEMO_COOKIE);
    return json({ok:true,authenticated:true});
  } catch(error) { return errorResponse(error); }
}
