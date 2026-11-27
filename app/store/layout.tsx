import type { Metadata } from 'next';
import Link from 'next/link';
import { Cormorant_Garamond } from 'next/font/google';
import { ADDRESS, BRAND, EMAIL, HEADLINE, HOURS, INSTAGRAM, enquire } from '@/features/catalog/store';
import { Logo } from '@/components/ui/logo';
import { NewsletterForm } from '@/features/catalog/components/newsletter-form';
import { StoreMotion } from '@/features/catalog/components/store-motion';

/**
 * The public storefront. Served on its own host: proxy.ts rewrites
 * `<STORE_HOST>/x` to `/store/x`, so every link in here is written without the
 * `/store` prefix. Nothing under this layout reads a session.
 */
const display = Cormorant_Garamond({ variable: '--font-title', subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: { default: BRAND, template: `%s · ${BRAND}` },
  description: `${BRAND} — ${HEADLINE}`,
};

export default function StoreLayout({ children }: LayoutProps<'/store'>) {
  return (
    <div className={`store ${display.variable} flex min-h-screen flex-col bg-background text-foreground`}>
      <StoreMotion />
      {/* One slim line: name left, links right, small type so the photos lead. */}
      <header className="store-header sticky top-0 z-20">
        <div
          aria-hidden="true"
          className="store-header-surface pointer-events-none absolute inset-0 -z-10 border-b border-border/80 bg-background/88 backdrop-blur-md"
        />
        <div className="flex h-12 items-center justify-between gap-2 px-3 text-xs min-[400px]:px-4 sm:gap-6 sm:px-6 sm:text-[0.8125rem]">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 font-medium uppercase tracking-[0.06em] min-[400px]:tracking-[0.12em] transition-opacity hover:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
          >
            <Logo className="size-6" />
            <span>{BRAND}</span>
          </Link>
          <nav aria-label="Storefront" className="flex items-center gap-3 min-[400px]:gap-3.5 sm:gap-5">
            <Link href="/#about" className="max-[359px]:hidden underline-offset-4 transition-opacity hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground">About</Link>
            <Link href="/#pieces" className="underline-offset-4 transition-opacity hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground">Pieces</Link>
            <Link href="/#bespoke" className="underline-offset-4 transition-opacity hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground">Bespoke</Link>
            <a href="#contact" className="underline-offset-4 transition-opacity hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground">Contact</a>
          </nav>
        </div>
        <div
          aria-hidden="true"
          className="store-progress pointer-events-none absolute inset-x-0 bottom-0 h-px bg-foreground/45"
        />
      </header>

      <main className="flex-1">{children}</main>

      <footer id="contact" className="mt-24 scroll-mt-12 border-t bg-muted">
        <div className="grid gap-10 px-4 py-16 sm:grid-cols-[2fr_1fr_1fr] sm:px-6">
          <div className="space-y-5">
            <h2 data-split className="font-display text-3xl font-light tracking-[-0.02em]">Stay close to what’s new</h2>
            <NewsletterForm />
            <p className="max-w-sm text-sm text-muted-foreground">New pieces, private previews and the odd story from the workshop. No spam.</p>
          </div>
          <FooterColumn title="Visit">
            {ADDRESS.map((l) => <li key={l}>{l}</li>)}
            <li>{HOURS}</li>
          </FooterColumn>
          <FooterColumn title="Contact">
            <li><a href={enquire('Hi!')} target="_blank" rel="noopener noreferrer" className="hover:underline">WhatsApp</a></li>
            <li><a href={`https://instagram.com/${INSTAGRAM}`} target="_blank" rel="noopener noreferrer" className="hover:underline">Instagram</a></li>
            <li><a href={`mailto:${EMAIL}`} className="hover:underline">{EMAIL}</a></li>
          </FooterColumn>
        </div>
        <div className="border-t">
          <div className="px-4 py-6 text-xs text-muted-foreground sm:px-6">
            © {new Date().getFullYear()} {BRAND}
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{title}</h2>
      <ul className="space-y-2 text-sm">{children}</ul>
    </div>
  );
}
