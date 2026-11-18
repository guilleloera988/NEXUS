import type { MetadataRoute } from 'next';

const origin = () => {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000').origin;
  } catch {
    return 'http://127.0.0.1:3000';
  }
};

/** Public marketing pages are indexable; private areas, verification pages and APIs are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: '*',
      allow: ['/', '/demo'],
      disallow: ['/api/', '/verify/', '/skillpass/', '/dashboard', '/challenges', '/workspace', '/validations', '/my-skillpass',
        '/profile', '/talent', '/organization', '/notifications', '/admin', '/onboarding', '/login', '/signup', '/auth/'],
    }],
    sitemap: `${origin()}/sitemap.xml`,
  };
}
