import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseConfig } from './env';
import { AppError } from './errors';

/** Supabase client bound to the visitor's cookies (their JWT); RLS applies to every call. */
export async function supabaseServer() {
  const config = supabaseConfig();
  if (!config) throw new AppError('supabase_not_configured', 503);
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (updates) => {
        try {
          for (const { name, value, options } of updates) jar.set(name, value, options);
        } catch {
          // Called from a Server Component render: cookies are read-only there. The proxy refreshes them.
        }
      },
    },
  });
}
