'use client';

import 'lenis/dist/lenis.css';
import { usePathname } from 'next/navigation';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);
// Phones resize the viewport as the address bar shows/hides; re-measuring on
// that would make pinned sections jump mid-scroll.
ScrollTrigger.config({ ignoreMobileResize: true });

const EASE = 'expo.out';

/**
 * The storefront's scroll choreography. The page is server-rendered and only
 * marks what moves (data-* attributes and a few classes); everything here
 * animates between states the CSS already lays out, so without JS, or with
 * reduced motion, the page is complete and still.
 *
 * Rebuilt on every route change: useGSAP's context reverts every tween,
 * ScrollTrigger, pin and SplitText it created.
 */
export function StoreMotion() {
  const pathname = usePathname();

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const all = <T extends Element = HTMLElement>(sel: string) => gsap.utils.toArray<T>(sel);
        const one = (root: Element, sel: string) => root.querySelector<HTMLElement>(sel);

        // Smooth wheel scrolling, driven by GSAP's ticker so ScrollTrigger and
        // Lenis read the same frame. Touch keeps native scrolling (syncTouch off).
        const lenis = new Lenis({ anchors: { offset: -48 } });
        lenis.on('scroll', ScrollTrigger.update);
        const raf = (t: number) => lenis.raf(t * 1000);
        gsap.ticker.add(raf);
        gsap.ticker.lagSmoothing(0);

        // Header: clear over the banner, frosted after; hides going down, returns going up.
        const header = document.querySelector<HTMLElement>('.store-header');
        const hero = document.querySelector<HTMLElement>('.hero');
        if (hero) {
          gsap.fromTo('.store-header-surface', { opacity: 0 }, {
            opacity: 1, ease: 'none',
            scrollTrigger: { start: 0, end: () => innerHeight * 0.3, scrub: true },
          });
        }
        gsap.to('.store-progress', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });
        if (header) {
          let hidden = false;
          ScrollTrigger.create({
            start: 0, end: 'max',
            onUpdate: (self) => {
              const hide = self.direction === 1 && self.scroll() > innerHeight;
              if (hide === hidden) return;
              hidden = hide;
              gsap.to(header, { yPercent: hide ? -100 : 0, duration: 0.6, ease: 'power3.out', overwrite: true });
            },
          });
        }

        // Banner: the photo sinks slower than the page, the name lifts away.
        if (hero) {
          gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } })
            .to('.hero-photo', { yPercent: 12, scale: 1.08, ease: 'none' }, 0)
            .to('.hero-name', { yPercent: -60, opacity: 0, ease: 'none' }, 0);
        }

        // Signature moment: the section pins and the framed photo opens to full screen.
        for (const s of all('[data-panel="expand"]')) {
          gsap.timeline({ scrollTrigger: { trigger: s, start: 'top top', end: '+=120%', pin: true, scrub: true } })
            .fromTo(s, { '--x': 0 }, { '--x': 1, ease: 'power2.inOut' }, 0)
            .fromTo(one(s, '[data-zoom]'), { scale: 1.3 }, { scale: 1, ease: 'power2.inOut' }, 0)
            .to(one(s, '[data-caption]'), { opacity: 0, y: -12, duration: 0.2, ease: 'none' }, 0);
        }

        // Framed panel: the frame floats up once; the photo drifts inside it.
        for (const s of all('[data-panel="drift"]')) {
          gsap.from(one(s, 'figure'), {
            y: 90, opacity: 0, duration: 1.6, ease: EASE,
            scrollTrigger: { trigger: s, start: 'top 65%', once: true },
          });
          gsap.fromTo(one(s, '[data-zoom]'), { yPercent: -7, scale: 1.16 }, {
            yPercent: 7, scale: 1.16, ease: 'none',
            scrollTrigger: { trigger: s, start: 'top bottom', end: 'bottom top', scrub: true },
          });
        }

        // Curtain panel: uncovered upward as it arrives, zooming out as it opens.
        for (const s of all('[data-panel="reveal"]')) {
          gsap.timeline({ scrollTrigger: { trigger: s, start: 'top 85%', end: 'center center', scrub: true } })
            .fromTo(one(s, '[data-clip]'), { '--r': 1 }, { '--r': 0, ease: 'none' }, 0)
            .fromTo(one(s, '[data-zoom]'), { scale: 1.3 }, { scale: 1, ease: 'none' }, 0);
        }

        // Story: words fill in from faint ink as the paragraph crosses the screen.
        for (const p of all('.reveal')) {
          gsap.fromTo(p.children, { opacity: 0.12 }, {
            opacity: 1, ease: 'none', stagger: 0.1,
            scrollTrigger: { trigger: p, start: 'top 80%', end: 'bottom 40%', scrub: true },
          });
        }

        // Marquee: endless drift that surges with scroll speed and follows its direction.
        for (const m of all('[data-marquee]')) {
          const loop = gsap.to(one(m, '[data-track]'), { xPercent: -50, ease: 'none', duration: 40, repeat: -1 });
          loop.totalTime(loop.duration() * 100); // room to run backwards
          ScrollTrigger.create({
            trigger: m, start: 'top bottom', end: 'bottom top',
            onUpdate: (self) => {
              const surge = 1 + Math.min(Math.abs(self.getVelocity()) / 300, 6);
              gsap.to(loop, { timeScale: self.direction * surge, duration: 0.25, overwrite: true });
              gsap.to(loop, { timeScale: self.direction, duration: 1.4, delay: 0.25, ease: 'power2.out' });
            },
          });
        }

        // Pieces: each photo's curtain lifts while it zooms out; captions follow.
        // Batched, so cards entering together cascade left to right.
        const pieces = all('[data-piece]');
        const part = (els: Element[], sel: string) => els.map((el) => el.querySelector(sel)).filter(Boolean);
        gsap.set(part(pieces, '[data-clip]'), { '--r': 1 });
        gsap.set(part(pieces, '[data-zoom]'), { scale: 1.25 });
        gsap.set(part(pieces, '[data-caption]'), { opacity: 0, y: 16 });
        ScrollTrigger.batch(pieces, {
          start: 'top 88%', once: true,
          onEnter: (batch) => {
            gsap.timeline()
              .to(part(batch, '[data-clip]'), { '--r': 0, duration: 1.3, ease: 'expo.inOut', stagger: 0.12 }, 0)
              .to(part(batch, '[data-zoom]'), { scale: 1, duration: 1.8, ease: EASE, stagger: 0.12 }, 0.1)
              .to(part(batch, '[data-caption]'), { opacity: 1, y: 0, duration: 1, ease: EASE, stagger: 0.12 }, 0.55);
          },
        });

        // Hairlines draw across from the left.
        for (const r of all('[data-rule]')) {
          gsap.from(r, {
            scaleX: 0, transformOrigin: '0 50%', duration: 1.4, ease: EASE,
            scrollTrigger: { trigger: r, start: 'top 92%', once: true },
          });
        }

        // Large copy rises line by line from behind a mask. autoSplit re-splits
        // on resize and font load; returning the tween lets it be rebuilt.
        for (const el of all('[data-split]')) {
          SplitText.create(el, {
            type: 'lines', mask: 'lines', autoSplit: true,
            onSplit: (self) => gsap.from(self.lines, {
              yPercent: 105, duration: 1.3, ease: EASE, stagger: 0.09,
              scrollTrigger: { trigger: el, start: 'top 85%', once: true },
            }),
          });
        }

        // Smaller blocks float up, staggered when they arrive together.
        gsap.set('[data-rise]', { opacity: 0, y: 40 });
        ScrollTrigger.batch('[data-rise]', {
          start: 'top 92%', once: true,
          onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 1.1, ease: EASE, stagger: 0.08 }),
        });

        // Web fonts change text heights; re-measure trigger points once they land.
        document.fonts?.ready.then(() => ScrollTrigger.refresh());

        return () => {
          gsap.ticker.remove(raf);
          gsap.ticker.lagSmoothing(500, 33);
          lenis.destroy();
        };
      });
    },
    { dependencies: [pathname], revertOnUpdate: true },
  );

  return null;
}
