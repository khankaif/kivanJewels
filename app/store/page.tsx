import { Fragment, type CSSProperties } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  BESPOKE, BRAND, CITY, HERO_IMAGE, HOURS, PIECES, SHOWCASE, STORE_IMAGE, STORY, VALUES, enquire,
} from '@/features/catalog/store';
import { mrp } from '@/lib/format';
import { cn } from '@/lib/utils';

/** The large serif paragraph the page speaks in: story and bespoke share it. */
const COPY = 'font-display text-[clamp(2rem,3.2vw,3.5625rem)] font-light leading-[1.05] tracking-[-0.03em] text-pretty';
const LABEL = 'text-xs uppercase tracking-[0.08em]';

/**
 * Brand page while the catalog is being shot: no database read, so it builds
 * as plain static HTML. Motion lives in StoreMotion (store layout); this page
 * only marks what moves: data-panel, data-clip/data-zoom, data-piece,
 * data-split, data-rise, data-rule, data-marquee, .reveal and the hero classes.
 * When the catalog is published, swap the sample grid for <Gallery>.
 */
export default function StorePage() {
  const words = STORY.trim().split(/\s+/);
  // Brand letters, numbered across words, so the intro can stagger them.
  let n = 0;
  const brandWords = BRAND.split(' ').map((w) => [...w].map((c) => ({ c, i: n++ })));

  return (
    <>
      {/* -mt-12 slides the banner under the sticky header, which is clear until you scroll. */}
      <section className="hero relative -mt-12 h-svh min-h-[28rem] overflow-clip bg-muted">
        {HERO_IMAGE && (
          <>
            <div className="hero-photo absolute -inset-y-[8%] inset-x-0">
              <Image
                src={HERO_IMAGE} alt="" fill loading="eager" fetchPriority="high" sizes="100vw"
                className="hero-img object-cover"
              />
            </div>
            {/* Scrims keep dark ink legible at both edges over any photograph. */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-linear-to-b from-background/55 to-transparent" />
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-linear-to-t from-background/85 via-background/30 to-transparent" />
          </>
        )}
        <div className="hero-name absolute inset-x-4 bottom-6 flex items-end justify-between gap-6 sm:inset-x-6">
          <h1 aria-label={BRAND} className="font-display text-[clamp(3.25rem,11.8vw,13.5rem)] font-light leading-[0.85] tracking-[-0.03em]">
            {brandWords.map((letters, w) => (
              <Fragment key={w}>
                {w > 0 && ' '}
                <span aria-hidden="true" className="inline-block whitespace-nowrap">
                  {letters.map(({ c, i }) => (
                    <span key={i} className="hero-char" style={{ '--i': i } as CSSProperties}>{c}</span>
                  ))}
                </span>
              </Fragment>
            ))}
          </h1>
          <span
            aria-hidden="true"
            className="hero-cue hidden shrink-0 items-center gap-2 pb-2 text-[0.6875rem] uppercase tracking-[0.16em] text-foreground/70 sm:inline-flex"
          >
            <span>Scroll</span>
            <span className="h-px w-6 bg-foreground/45" />
          </span>
        </div>
      </section>

      {SHOWCASE.map((s, i) => (
        <Panel
          key={s.src} src={s.src} alt={s.alt} label={s.label} caption={s.caption}
          motion={i === 0 ? 'expand' : 'drift'} warm={i % 2 === 1}
        />
      ))}

      <section id="about" className="scroll-mt-12 px-4 pt-24 pb-24 sm:px-6 sm:pt-30 sm:pb-32">
        {/* Words fill in as the paragraph scrolls up (StoreMotion). */}
        <p className={cn(COPY, 'reveal')}>
          {words.map((w, i) => (
            <Fragment key={i}>
              <span>{w}</span>
              {i < words.length - 1 ? ' ' : ''}
            </Fragment>
          ))}
        </p>
        <p data-rise className={cn(LABEL, 'mt-10 text-muted-foreground')}>{CITY}</p>
      </section>

      {/* What the shop stands for, drifting past; it surges and turns with the scroll. */}
      <div data-marquee className="overflow-clip border-y py-6 sm:py-8">
        <div data-track className="flex w-max">
          {[0, 1].map((copy) => (
            <ul key={copy} aria-hidden={copy === 1 || undefined} className="flex shrink-0 font-display text-3xl font-light tracking-[-0.02em] sm:text-5xl">
              {[...VALUES, ...VALUES].map((v, i) => (
                <li key={i} aria-hidden={i >= VALUES.length || undefined} className="flex items-center gap-8 pr-8 sm:gap-12 sm:pr-12">
                  {v}
                  <span aria-hidden="true" className="text-[0.5em] text-muted-foreground">✦</span>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>

      <section id="pieces" aria-label={`Pieces by ${BRAND}`} className="scroll-mt-12 px-4 pt-20 pb-25 sm:px-6">
        <div className="mb-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3">
            <h2 data-rise className={cn(LABEL, 'text-muted-foreground')}>Selected pieces</h2>
            <span data-rise className="text-xs text-muted-foreground">Enquire directly via WhatsApp</span>
          </div>
          <div data-rule className="h-px bg-border" />
        </div>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-14 lg:grid-cols-4 lg:gap-y-19">
          {PIECES.map((p) => (
            <li key={p.name} data-piece className={cn(p.wide && 'col-span-2')}>
              <a
                href={enquire(`Hi, I'd like to know more about the ${p.name}.`)} target="_blank" rel="noopener noreferrer"
                className="group flex h-full flex-col gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
              >
                {/* The wide piece fills its row's height on desktop, so both rows end level. */}
                <div data-clip className={cn('relative overflow-hidden bg-muted', p.wide ? 'aspect-[3/2] lg:aspect-auto lg:flex-1' : 'aspect-[3/4]')}>
                  <div data-zoom className="absolute inset-0">
                    <Image
                      src={p.src} alt={p.name} fill
                      sizes={p.wide ? '(min-width: 1024px) 50vw, 100vw' : '(min-width: 1024px) 25vw, 50vw'}
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                    />
                  </div>
                </div>
                <div data-caption className="flex items-baseline justify-between gap-3 text-sm leading-tight">
                  <div>
                    <div>{p.name}</div>
                    <div className="text-muted-foreground tabular-nums">{mrp(p.price)}</div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100">
                    Enquire →
                  </span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section id="bespoke" className="scroll-mt-12 px-4 pt-24 pb-28 sm:px-6 sm:pt-30 sm:pb-35">
        <p data-split className={cn(COPY, 'max-w-[55rem]')}>{BESPOKE.intro}</p>

        <h2 data-rise className={cn(LABEL, 'mt-16 text-muted-foreground')}>We offer</h2>
        <ul className="mt-4 space-y-1.5 font-display text-lg leading-snug">
          {BESPOKE.offers.map((o) => <li key={o} data-rise>{o}</li>)}
        </ul>

        <h2 data-rise className={cn(LABEL, 'mt-12 text-muted-foreground')}>Details</h2>
        <div data-rule className="mt-4 h-px max-w-md bg-border" />
        <dl className="mt-4 grid max-w-md grid-cols-[9.5rem_1fr] gap-y-2 font-display text-lg leading-snug">
          {BESPOKE.details.map(([k, v]) => (
            <Fragment key={k}>
              <dt data-rise className="text-muted-foreground">{k}</dt>
              <dd data-rise className="tabular-nums">{v}</dd>
            </Fragment>
          ))}
        </dl>

        <div data-rise className="mt-12 flex flex-wrap gap-2">
          {[
            ['Commission a piece', "Hi, I'd like to commission a piece."],
            ['Rework old jewellery', "Hi, I'd like to rework an old piece."],
          ].map(([label, text]) => (
            <Button
              key={label} variant="ghost" size="sm" nativeButton={false}
              className={cn(LABEL, 'h-9 bg-foreground/6 px-4 hover:bg-foreground/12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground')}
              render={<a href={enquire(text)} target="_blank" rel="noopener noreferrer" />}
            >
              <span>{label}</span>
              <span aria-hidden="true" className="transition-transform duration-200 group-hover/button:translate-x-0.5">→</span>
            </Button>
          ))}
        </div>
      </section>

      {STORE_IMAGE && (
        <Panel src={STORE_IMAGE} alt={`Inside ${BRAND}`} label="Workshop" caption={`${CITY} · ${HOURS}`} motion="reveal" />
      )}
    </>
  );
}

type PanelProps = {
  src: string; alt: string; label?: string; caption?: string; warm?: boolean;
  /** expand: pins and opens to full screen · drift: frame floats up, photo drifts · reveal: curtain lifts. */
  motion: 'expand' | 'drift' | 'reveal';
};

/** A full-screen section built around one photo: lots of air, one object. */
function Panel({ src, alt, label, caption, warm, motion }: PanelProps) {
  const captionRow = (label || caption) && (
    <>
      {label && <span className="uppercase tracking-[0.12em]">{label}</span>}
      {caption && <span>{caption}</span>}
    </>
  );
  const captionClass = 'flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted-foreground';

  // A full-bleed photo clipped to a centred frame (.panel-expand in globals.css).
  if (motion === 'expand') {
    return (
      <section data-panel="expand" className={cn('panel-expand relative h-svh min-h-[34rem] overflow-clip', warm && 'bg-muted')}>
        <div data-media className="absolute inset-0">
          <div data-zoom className="absolute inset-0">
            <Image src={src} alt={alt} fill sizes="100vw" className="object-cover" />
          </div>
        </div>
        {captionRow && <p data-caption className={captionClass}>{captionRow}</p>}
      </section>
    );
  }

  return (
    <section data-panel={motion} className={cn('grid h-svh min-h-[34rem] place-items-center px-4', warm && 'bg-muted')}>
      <figure className="w-[min(27rem,74vw)]">
        <div data-clip className="relative aspect-[3/4] overflow-hidden bg-muted">
          <div data-zoom className="absolute inset-0">
            <Image src={src} alt={alt} fill sizes="(min-width: 640px) 27rem, 74vw" className="object-cover" />
          </div>
        </div>
        {captionRow && <figcaption className={cn(captionClass, 'mt-3')}>{captionRow}</figcaption>}
      </figure>
    </section>
  );
}
