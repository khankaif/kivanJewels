import Image from 'next/image';
import kdLogo from '@/public/kd-logo.png';
import kdMark from '@/public/kd-mark.png';
import { cn } from '@/lib/utils';

export type LogoVariant = 'mark' | 'full';

export interface LogoProps {
  className?: string;
  /**
   * - 'mark' (default): Gold diamond-ring K crest cropped from KD_logo.PNG for headers and badges.
   * - 'full': Complete Kaivan Jewels lockup with wordmark and tagline.
   */
  variant?: LogoVariant;
  alt?: string;
}

/**
 * Kaivan Jewels — Brand Mark & Lockup.
 */
export function Logo({
  className,
  variant = 'mark',
  alt = '',
}: LogoProps) {
  if (variant === 'full') {
    return (
      <Image
        src={kdLogo}
        alt={alt}
        loading="eager"
        sizes="240px"
        className={cn('h-auto w-auto shrink-0 object-contain select-none', className)}
      />
    );
  }

  return (
    <Image
      src={kdMark}
      alt={alt}
      loading="eager"
      sizes="64px"
      className={cn('size-6 shrink-0 object-contain select-none', className)}
    />
  );
}

/**
 * Branded dark obsidian squircle badge holding the gold crest mark.
 */
export function LogoBadge({
  className,
  logoClassName,
  variant = 'mark',
}: {
  className?: string;
  logoClassName?: string;
  variant?: LogoVariant;
}) {
  return (
    <span
      className={cn(
        'grid size-6 shrink-0 place-items-center rounded-md bg-neutral-950 ring-1 ring-border/50 shadow-2xs',
        className,
      )}
    >
      <Logo className={cn('size-4.5', logoClassName)} variant={variant} />
    </span>
  );
}
