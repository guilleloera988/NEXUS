import Image from 'next/image';
import Link from 'next/link';

/** Real SkillPass emblem (from the official logo) + typographic wordmark for crisp rendering at any size. */
export function BrandMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  return <Image src="/brand/skillpass-mark.png" alt="" width={size} height={size} className={className} priority />;
}

export function Wordmark({ tone = 'dark', compact = false }: { tone?: 'dark' | 'light'; compact?: boolean }) {
  return (
    <span className="flex flex-col leading-none">
      <span className={`text-[1.15rem] font-extrabold tracking-[0.06em] ${tone === 'light' ? 'text-white' : 'text-ink-950'}`}>
        SKILL<span className="gold-text">PASS</span>
      </span>
      {!compact && (
        <span className={`mt-1 text-[9px] font-semibold tracking-[0.22em] ${tone === 'light' ? 'text-ink-400' : 'text-ink-500'}`}>BY AINDEV NEXUS</span>
      )}
    </span>
  );
}

export function BrandLink({ tone = 'dark', href = '/', compact = false }: { tone?: 'dark' | 'light'; href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-lg" aria-label="SkillPass by AINDEV NEXUS">
      <BrandMark size={compact ? 32 : 38} />
      <Wordmark tone={tone} compact={compact} />
    </Link>
  );
}

/** Full official logo image (emblem + wordmark) for light, spacious contexts. */
export function FullLogo({ width = 220, className = '' }: { width?: number; className?: string }) {
  return <Image src="/brand/skillpass-logo.png" alt="SkillPass" width={width} height={Math.round(width * 0.635)} className={className} priority />;
}
