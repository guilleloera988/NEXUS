import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  let origin = 'http://127.0.0.1:3000';
  try {
    origin = new URL(process.env.NEXT_PUBLIC_APP_URL || origin).origin;
  } catch {
    /* keep local default */
  }
  return [
    { url: `${origin}/`, changeFrequency: 'monthly', priority: 1 },
    { url: `${origin}/demo`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${origin}/verify`, changeFrequency: 'yearly', priority: 0.5 },
  ];
}
