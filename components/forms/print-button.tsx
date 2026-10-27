'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** The browser's own print dialog: paper, or "Save as PDF" to send. */
export function PrintButton() {
  return (
    <Button onClick={() => window.print()}>
      <Printer data-icon="inline-start" /> Print or save PDF
    </Button>
  );
}
