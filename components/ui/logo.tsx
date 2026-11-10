import type { SVGProps } from 'react';
import { cn } from '@/lib/utils';

export type LogoVariant =
  | 'kinetic-asterisk'   // Dribbble reference (Dalibor Pajic): 6-armed kinetic split asterisk
  | 'radiant-bloom'      // Brilliant Earth signature: Petal-facet synthesis & optical diamond spark
  | 'trinity-marquise'   // Cartier & Tiffany Knot: Platinum ribbon monogram in a marquise contour
  | 'solitaire-star'     // Harry Winston & De Beers Forevermark: 8-point radiant diamond star
  | 'endless-ray';       // Hex-Prism Möbius: Continuous total internal reflection raypath

export interface LogoProps extends SVGProps<SVGSVGElement> {
  /**
   * Luxury brand direction:
   * - 'kinetic-asterisk' (default): The iconic 6-armed kinetic split asterisk from the Dribbble reference.
   * - 'radiant-bloom': Brilliant Earth ethos — organic petal curves meeting crystalline diamond fire.
   * - 'trinity-marquise': Cartier & Tiffany Knot — fluid precious metal ribbon forming 'K' within a marquise silhouette.
   * - 'solitaire-star': Harry Winston & De Beers — iconic 8-point high jewelry radiant cut star.
   * - 'endless-ray': Hex-Prism Möbius — continuous folding ray across 6 isometric crystal planes.
   */
  variant?: LogoVariant;
  /** Uniform solid 100% opacity */
  solid?: boolean;
}

const KINETIC_ARM_PATH =
  'M 41.61 6.7 L 58.69 7.0 L 58.69 33.23 L 59.61 34.45 L 83.09 20.72 L 84.31 21.94 L 84.0 22.25 L 85.22 23.47 L 84.92 23.77 L 86.44 25.6 L 86.44 26.52 L 89.8 31.4 L 89.8 32.31 L 91.93 35.36 L 91.02 36.89 L 90.71 36.58 L 83.7 41.16 L 82.78 41.16 L 81.56 42.38 L 80.65 42.38 L 79.43 43.6 L 78.51 43.6 L 78.21 44.21 L 68.15 49.7 L 69.98 51.52 L 70.28 51.22 L 71.5 52.44 L 72.41 52.44 L 79.43 57.01 L 80.34 57.01 L 81.56 58.23 L 91.93 64.33 L 90.41 67.08 L 89.49 67.69 L 89.19 69.21 L 83.09 79.28 L 82.78 78.67 L 82.48 78.97 L 75.77 75.31 L 69.06 71.04 L 68.15 71.04 L 66.93 69.82 L 66.62 70.13 L 62.35 65.86 L 62.66 65.55 L 61.13 63.11 L 61.44 62.5 L 60.83 62.2 L 60.83 57.62 L 61.74 57.32 L 59.91 55.18 L 50.46 38.11 L 48.63 36.28 L 48.32 36.58 L 44.97 34.45 L 41.92 30.48 L 41.92 29.26 L 41.31 28.65 L 41.61 28.04 L 41.0 27.74 L 41.31 7.0 Z';

/**
 * Kaivan Jewels — Brand Mark.
 *
 * Default: 6-armed kinetic split asterisk (Dribbble reference).
 * Two identical interlocking geometric components meeting along a diagonal S-curve cleft.
 */
export function Logo({
  className,
  variant = 'kinetic-asterisk',
  solid = false,
  ...props
}: LogoProps) {
  if (variant === 'kinetic-asterisk') {
    return (
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className={cn('shrink-0 select-none', className)}
        {...props}
      >
        {/* Component 1 (Top-Right / North-East Trio) */}
        <path d={KINETIC_ARM_PATH} fill="currentColor" />
        {/* Component 2 (Bottom-Left / South-West Trio, 180° rotation) */}
        <path
          d={KINETIC_ARM_PATH}
          transform="rotate(180 50 50)"
          fill="currentColor"
          fillOpacity={solid ? 1 : 0.88}
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn('shrink-0 select-none', className)}
      {...props}
    >
      {variant === 'radiant-bloom' && (
        <>
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M16 2.5C16 8 13.8 13 10 16C13.8 19 16 24 16 29.5C16 24 18.2 19 22 16C18.2 13 16 8 16 2.5ZM16 13.5L17.8 16L16 18.5L14.2 16L16 13.5Z"
            fill="currentColor"
          />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M2.5 16C8 16 13 13.8 16 10C19 13.8 24 16 29.5 16C24 16 19 18.2 16 22C13 18.2 8 16 2.5 16ZM16 13.5L17.8 16L16 18.5L14.2 16L16 13.5Z"
            fill="currentColor"
            fillOpacity={solid ? 1 : 0.82}
          />
        </>
      )}

      {variant === 'trinity-marquise' && (
        <>
          <path
            d="M16 3C22 8.5 25.5 12 25.5 16C25.5 20 22 23.5 16 29C10 23.5 6.5 20 6.5 16C6.5 12 10 8.5 16 3Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M12.5 9.5V22.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M20 10.5L13 16L20 21.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="13" cy="16" r="1.2" fill="currentColor" />
        </>
      )}

      {variant === 'solitaire-star' && (
        <>
          <path
            d="M16 2.5L18.8 13.2L29.5 16L18.8 18.8L16 29.5L13.2 18.8L2.5 16L13.2 13.2L16 2.5Z"
            fill="currentColor"
          />
          <path
            d="M16 9.5L18 14L22.5 16L18 18L16 22.5L14 18L9.5 16L14 14L16 9.5Z"
            fill="currentColor"
            fillOpacity={solid ? 0.35 : 0.45}
          />
          <circle cx="16" cy="16" r="1.3" fill="var(--background, #ffffff)" />
        </>
      )}

      {variant === 'endless-ray' && (
        <>
          <path d="M16 3L26.5 10.5L20 15L16 12L16 3Z" fill="currentColor" fillOpacity={solid ? 1 : 0.95} />
          <path d="M26.5 10.5L26.5 21.5L20 18V15L26.5 10.5Z" fill="currentColor" fillOpacity={solid ? 1 : 0.65} />
          <path d="M26.5 21.5L16 29L16 20L20 18L26.5 21.5Z" fill="currentColor" fillOpacity={solid ? 1 : 0.82} />
          <path d="M16 29L5.5 21.5L12 17L16 20L16 29Z" fill="currentColor" fillOpacity={solid ? 1 : 0.45} />
          <path d="M5.5 21.5L5.5 10.5L12 14V17L5.5 21.5Z" fill="currentColor" fillOpacity={solid ? 1 : 0.75} />
          <path d="M5.5 10.5L16 3V12L12 14L5.5 10.5Z" fill="currentColor" fillOpacity={solid ? 1 : 0.55} />
        </>
      )}
    </svg>
  );
}

/**
 * Branded squircle badge holding the mark.
 */
export function LogoBadge({
  className,
  logoClassName,
  variant = 'kinetic-asterisk',
  solid,
}: {
  className?: string;
  logoClassName?: string;
  variant?: LogoVariant;
  solid?: boolean;
}) {
  return (
    <span
      className={cn(
        'grid size-6 place-items-center rounded-md bg-primary text-primary-foreground shadow-2xs',
        className,
      )}
    >
      <Logo className={cn('size-3.5', logoClassName)} variant={variant} solid={solid} />
    </span>
  );
}
