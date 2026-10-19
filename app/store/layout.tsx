import type { Metadata } from 'next';
import Link from 'next/link';
import { Cormorant_Garamond } from 'next/font/google';

/**
 * The public storefront. Served on its own host: proxy.ts rewrites
 * `<STORE_HOST>/x` to `/store/x`, so every link in here is written without the
 * `/store` prefix. Nothing under this layout reads a session.
 */
const BRAND = 'Kaivan Jewels';

const display = Cormorant_Garamond({
  variable: '--font-display', subsets: ['latin'], weight: ['400', '500', '600'], display: 'swap',
});

export const metadata: Metadata = {
  title: { default: BRAND, template: `%s · ${BRAND}` },
  description: `${BRAND} — fine jewellery set with diamonds.`,
};

export default function StoreLayout({ children }: LayoutProps<'/store'>) {
  return (
    <div className={`${display.variable} flex min-h-screen flex-col bg-background`}>
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-center px-4">
          <Link href="/" className="font-[family-name:var(--font-display)] text-2xl tracking-[0.2em] uppercase">
            {BRAND}
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-12">{children}</main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {BRAND}
      </footer>
    </div>
  );
}
