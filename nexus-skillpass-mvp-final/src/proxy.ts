import { createServerClient } from '@supabase/ssr';
import { NextRequest,NextResponse } from 'next/server';
import { DEMO_COOKIE,verifyDemo } from '@/lib/demo-session';

export async function proxy(request:NextRequest) {
  let response=NextResponse.next({request});
  response.headers.set('Cache-Control','private, no-store');
  response.headers.set('X-Robots-Tag','noindex, nofollow');
  const protectedPage=/^\/(dashboard|profile|challenges|experiences|review|admin)(\/|$)/.test(request.nextUrl.pathname);
  const demo=await verifyDemo(request.cookies.get(DEMO_COOKIE)?.value);
  if(demo) return response;
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let authenticated=false;
  if(url&&key) {
    const supabase=createServerClient(url,key,{cookies:{getAll:()=>request.cookies.getAll(),setAll:updates=>{
      for(const {name,value} of updates) request.cookies.set(name,value);
      response=NextResponse.next({request});
      for(const {name,value,options} of updates) response.cookies.set(name,value,options);
      response.headers.set('Cache-Control','private, no-store');
      response.headers.set('X-Robots-Tag','noindex, nofollow');
    }}});
    const {data}=await supabase.auth.getUser();
    authenticated=Boolean(data.user);
  }
  if(protectedPage&&!authenticated) {
    const redirect=NextResponse.redirect(new URL('/login',request.url));
    for(const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    redirect.headers.set('Cache-Control','private, no-store');
    return redirect;
  }
  return response;
}
export const config={matcher:['/dashboard/:path*','/profile/:path*','/challenges/:path*','/experiences/:path*','/review/:path*','/admin/:path*','/api/state','/api/actions']};
