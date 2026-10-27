/**
 * A wa.me link with the message already written. No API, no account: it opens
 * WhatsApp (app or web) on the person's own number, ready to send or edit.
 *
 * Indian numbers are stored however people typed them; a bare 10-digit mobile
 * gets the 91 country code, anything else is passed through as digits.
 */
export function waLink(text: string, phone?: string | null): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  const to = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}
