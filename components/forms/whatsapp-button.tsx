import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { waLink } from '@/lib/whatsapp';

/** Opens WhatsApp with the message written; the person still presses send. */
export function WhatsAppButton({ text, phone, label = 'Remind', size = 'sm' }: {
  text: string; phone?: string | null; label?: string; size?: 'sm' | 'xs';
}) {
  return (
    <Button
      variant="ghost" size={label ? size : size === 'xs' ? 'icon-xs' : 'icon-sm'} nativeButton={false}
      aria-label={label || 'Message on WhatsApp'} className="text-muted-foreground"
      title={phone ? `Message on WhatsApp (${phone})` : 'Message on WhatsApp'}
      render={<a href={waLink(text, phone)} target="_blank" rel="noreferrer" />}
    >
      <MessageCircle data-icon={label ? 'inline-start' : undefined} />
      {label}
    </Button>
  );
}
