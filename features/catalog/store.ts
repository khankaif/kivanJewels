import { waLink } from '@/lib/whatsapp';

/** What the storefront says about the business. Placeholders until the real details are in. */
export const BRAND = 'Kaivan Jewels';
export const HEADLINE = 'Diamonds, made to be worn every day.';
export const ADDRESS = ['Shop address line', 'City, India'];
export const HOURS = 'Mon–Sat, 11am–7pm';
export const INSTAGRAM = 'yourhandle';
export const EMAIL = 'hello@example.com';

/** A WhatsApp chat with the shop, message pre-written. STORE_WHATSAPP is the shop's number. */
export const enquire = (text: string) => waLink(text, process.env.STORE_WHATSAPP);

/** An absolute storefront link, so a shared enquiry points at the piece. */
export function storeUrl(path: string): string {
  const host = process.env.STORE_HOST;
  if (!host) return path;
  return `${host.includes('localhost') ? 'http' : 'https'}://${host}${path}`;
}
