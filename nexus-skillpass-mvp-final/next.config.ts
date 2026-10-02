import type { NextConfig } from 'next';

const supabaseOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : '';
  } catch {
    return '';
  }
})();

const isDev = process.env.NODE_ENV === 'development';

// Strict CSP: no third-party scripts. Next.js inline bootstrap scripts need 'unsafe-inline'
// (no nonce pipeline in this MVP); everything else is same-origin or the Supabase project.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${supabaseOrigin ? ` ${supabaseOrigin}` : ''}`,
  "font-src 'self'",
  `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ''}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // PGlite (local DEMO database) ships WASM + data files; keep it out of the server bundle.
  serverExternalPackages: ['@electric-sql/pglite'],
  // SQL migrations, seed and demo files are read at runtime by the local DEMO.
  outputFileTracingIncludes: { '/**/*': ['./supabase/**/*'] },
  experimental: {
    serverActions: {
      // Evidence uploads go through a Server Action; the app enforces MAX_UPLOAD_MB (default 4 MB)
      // so uploads also fit the 4.5 MB request limit of Vercel functions.
      bodySizeLimit: '5mb',
    },
  },
  images: { formats: ['image/avif', 'image/webp'] },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ];
  },
};

export default config;
