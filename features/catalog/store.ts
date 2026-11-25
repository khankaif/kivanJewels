import { waLink } from '@/lib/whatsapp';

/** What the storefront says about the business. Placeholders until the real details are in. */
export const BRAND = 'Kaivan Jewels';
export const HEADLINE = 'Diamonds, made to be worn every day.';
export const ADDRESS = ['Shop address line', 'City, India'];
export const HOURS = 'Mon–Sat, 11am–7pm';
export const INSTAGRAM = 'yourhandle';
export const EMAIL = 'hello@example.com';

/** The home page's story: one large paragraph, then where the workshop is and what it stands for. */
export const STORY =
  'Every piece is set by hand in our workshop, from diamonds we grade and match ourselves. Clean lines, honest stones and gold made to be worn every day, not saved for a box.';
export const CITY = 'Mumbai, India';
export const VALUES = ['Natural and lab-grown diamonds', 'Certified 14k and 18k gold', 'Lifetime cleaning and repair'];

/**
 * Stock photos from Unsplash (free licence) until the shop's own shoot.
 * Every URL carries the same query, which next.config.ts allows exactly.
 */
const stock = (id: string) => `https://images.unsplash.com/photo-${id}?w=3200&q=80`;

/** Full-screen banner behind the brand name. null leaves the plain warm ground. */
export const HERO_IMAGE: string | null = stock('1611170947204-5ab96c3e37a1');

/** Full-screen panels after the banner, one small centred photo each (3:4 crop reads best). */
export const SHOWCASE: { src: string; alt: string; label?: string; caption?: string }[] = [
  {
    src: stock('1781901726877-0b5775eea722'),
    alt: 'Gold huggie earrings set with diamonds',
    label: '01',
    caption: 'Everyday diamonds · Huggies set by hand',
  },
  {
    src: stock('1747116404311-55f8d8944e83'),
    alt: 'Cushion-cut diamond ring with a halo',
    label: '02',
    caption: 'Selected stones · Cushion-cut halo',
  },
];

/**
 * SAMPLE pieces for the grid until the catalog is shot: names, prices and
 * photos are placeholders. Each enquires on WhatsApp; there are no piece pages.
 * The grid is four across; the one `wide` piece spans two, at the end, so it
 * lands on the right of the second row.
 */
export const PIECES: { name: string; price: number; src: string; wide?: boolean }[] = [
  { name: 'Princess solitaire ring', price: 84000, src: stock('1719924998065-0c60e329ef58') },
  { name: 'Knot band', price: 32000, src: stock('1793054515168-de083df1b024') },
  { name: 'Pavé band', price: 58000, src: stock('1481980235850-66e47651e431') },
  { name: 'Wedding band pair', price: 66000, src: stock('1739216906046-afc47ed589fb') },
  { name: 'Bar pendant set', price: 41000, src: stock('1793054733027-daea491b5cc2') },
  { name: 'Oval solitaire ring', price: 1_25_000, src: stock('1600143674013-a690b5d25104') },
  { name: 'Layered chains', price: 47000, src: stock('1633934542430-0905ccb5f050'), wide: true },
];

/** Full-screen photo of the shop near the end of the page. */
export const STORE_IMAGE: string | null = stock('1775021723698-b9afeaa084d1');

/** Made-to-order work. Each detail is a label and its value. */
export const BESPOKE = {
  intro: 'The workshop takes commissions: bring a design, a stone you already own, or an old piece to rework.',
  offers: ['Your own diamonds or heirloom stones', 'Old gold melted and reused', 'Design call on WhatsApp or video', 'Fittings at the shop'],
  details: [
    ['Starting budget', '₹50,000'],
    ['Lead time', '3–5 weeks'],
    ['Payment', '50% to begin, rest on delivery'],
  ] as [string, string][],
};

/** A WhatsApp chat with the shop, message pre-written. STORE_WHATSAPP is the shop's number. */
export const enquire = (text: string) => waLink(text, process.env.STORE_WHATSAPP);

/** An absolute storefront link, so a shared enquiry points at the piece. */
export function storeUrl(path: string): string {
  const host = process.env.STORE_HOST;
  if (!host) return path;
  return `${host.includes('localhost') ? 'http' : 'https'}://${host}${path}`;
}
