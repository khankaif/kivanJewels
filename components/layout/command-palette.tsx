'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { searchAction } from '@/features/search/actions';
import type { Hit } from '@/features/search/queries';

/** Shown on an empty query: the three things you open the app to type. */
const ACTIONS: Hit[] = [
  { kind: 'stock', label: 'Add diamonds', sub: 'on bill or on memo', href: '/stock?new=1' },
  { kind: 'requirement', label: 'New requirement', sub: 'a customer asked for something', href: '/sales?new=1' },
  { kind: 'party', label: 'New party', sub: 'supplier or client', href: '/parties?new=1' },
];

const KIND_LABEL: Record<Hit['kind'], string> = {
  stock: 'Stock', party: 'Party', bill: 'Bill', requirement: 'Requirement',
};

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>(ACTIONS);
  const [cursor, setCursor] = useState(0);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 150ms is under the threshold where typing feels laggy and still collapses
  // a burst of keystrokes into one round trip.
  useEffect(() => {
    if (!q.trim()) {
      setHits(ACTIONS);
      setCursor(0);
      return;
    }
    const t = setTimeout(() => {
      startTransition(async () => {
        setHits(await searchAction(q));
        setCursor(0);
      });
    }, 150);
    return () => clearTimeout(t);
  }, [q]);

  const go = (hit: Hit | undefined) => {
    if (!hit) return;
    setOpen(false);
    setQ('');
    router.push(hit.href);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQ(''); }}>
      <DialogContent className="max-w-lg gap-0 p-0" showCloseButton={false}>
        <DialogTitle className="sr-only">Search</DialogTitle>
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, hits.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
            if (e.key === 'Enter') { e.preventDefault(); go(hits[cursor]); }
          }}
          placeholder="Search stock, parties, bills, requirements…"
          className="h-12 rounded-none border-0 border-b text-base shadow-none focus-visible:ring-0"
        />
        <ul className="max-h-80 overflow-y-auto p-1">
          {hits.map((h, i) => (
            <li key={`${h.kind}-${h.href}-${i}`}>
              <button
                type="button"
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(h)}
                className={cn(
                  'flex w-full items-baseline gap-3 rounded-md px-3 py-2 text-left text-sm',
                  i === cursor && 'bg-accent text-accent-foreground',
                )}
              >
                <span className="font-medium">{h.label}</span>
                <span className="flex-1 truncate text-xs text-muted-foreground">{h.sub}</span>
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {KIND_LABEL[h.kind]}
                </span>
              </button>
            </li>
          ))}
          {!hits.length && (
            <li className="px-3 py-8 text-center text-sm text-muted-foreground">Nothing matches.</li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
