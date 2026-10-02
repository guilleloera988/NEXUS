import type { MetadataRoute } from 'next';
export default function robots():MetadataRoute.Robots {return {rules:{userAgent:'*',allow:'/',disallow:['/api/','/dashboard','/profile','/review','/admin','/experiences','/challenges','/skillpass/','/verify/','/login','/signup','/demo']}};}
