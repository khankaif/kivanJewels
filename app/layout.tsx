import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

// The app is set in Inter at 13px, as Twenty's workspace is, with tabular
// figures for money. The storefront loads its own display face.
const text = Inter({ variable: '--font-text', subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: 'Kaivan Jewels',
  description: 'Kaivan Jewels — diamond trading, memos and accounts',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${text.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
