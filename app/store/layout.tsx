import type { Metadata } from 'next';
import Link from 'next/link';
import { Cormorant_Garamond } from 'next/font/google';
import { ADDRESS, BRAND, EMAIL, HEADLINE, HOURS, INSTAGRAM, enquire } from '@/features/catalog/store';

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
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-8">
          <span />
          <Link href="/" className="font-display text-2xl font-medium tracking-[0.04em] sm:text-3xl">
            {BRAND}
          </Link>
          <a href="#contact" className="justify-self-end text-sm underline-offset-4 hover:underline">
            Contact
          </a>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer id="contact" className="mt-24 border-t bg-muted">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:grid-cols-[2fr_1fr_1fr] sm:px-8">
          <div className="font-display text-3xl font-medium">{BRAND}</div>
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
          <div className="mx-auto max-w-7xl px-4 py-6 text-xs text-muted-foreground sm:px-8">
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
