'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import {
  Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { searchAction } from '@/features/search/actions';
import type { Hit } from '@/features/search/queries';
import { waLink } from '@/lib/whatsapp';

/** Shown on an empty query: the things you open the app to do. */
const ACTIONS: Hit[] = [
  { kind: 'stock', label: 'Add diamonds', sub: 'on bill or on memo', href: '/stock?new=1' },
  { kind: 'requirement', label: 'New requirement', sub: 'a customer asked for something', href: '/sales?new=1' },
  { kind: 'bill', label: 'Add bill', sub: 'sale, purchase, or charges only', href: '/accounts/bills?new=1' },
  { kind: 'party', label: 'New party', sub: 'supplier or client', href: '/parties?new=1' },
];

const GROUPS: [Hit['kind'], string][] = [
  ['stock', 'Stock'], ['party', 'Parties'], ['bill', 'Bills'], ['requirement', 'Requirements'],
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>(ACTIONS);
  // cmdk tracks the highlighted row by its value; we key rows by href.
  const [active, setActive] = useState('');
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
  // a burst of keystrokes into one round trip. Searching happens on the server,
  // so cmdk's own filtering is off.
  useEffect(() => {
    const t = setTimeout(() => {
      startTransition(async () => setHits(q.trim() ? await searchAction(q) : ACTIONS));
    }, q.trim() ? 150 : 0);
    return () => clearTimeout(t);
  }, [q]);

  const go = (href: string) => {
    setOpen(false);
    setQ('');
    router.push(href);
  };

  return (
    <>
      <Button
        variant="outline" size="sm" onClick={() => setOpen(true)} aria-label="Search"
        className="w-full justify-start gap-2 bg-background font-normal text-muted-foreground"
      >
        <Search />
        <span className="truncate">Search</span>
        <Kbd className="ml-auto">⌘K</Kbd>
      </Button>
      <CommandDialog
        open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQ(''); }}
        title="Search" description="Search stock by spec, parties, bills and requirements"
        className="sm:max-w-xl"
      >
        <Command
          shouldFilter={false} value={active} onValueChange={setActive}
          onKeyDown={(e) => {
            // ⌘↵ on a parcel goes straight to selling it.
            const hit = hits.find((h) => h.href === active);
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && hit?.sellHref) {
              e.preventDefault();
              go(hit.sellHref);
            }
          }}
        >
          <CommandInput value={q} onValueChange={setQ} placeholder="Try “9-9.5 round def vvs”, a party, or a bill no." />
          <CommandList>
            <CommandEmpty>Nothing matches.</CommandEmpty>
            {GROUPS.map(([kind, heading]) => {
              const rows = hits.filter((h) => h.kind === kind);
              if (!rows.length) return null;
              return (
                <CommandGroup key={kind} heading={q.trim() ? heading : undefined}>
                  {rows.map((h) => (
                    <CommandItem key={h.href} value={h.href} onSelect={() => go(h.href)} className="group/hit gap-3">
                      <span className="font-medium">{h.label}</span>
                      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{h.sub}</span>
                      {h.sellHref && (
                        // Only on the highlighted row, so the list stays quiet.
                        <span className="hidden shrink-0 items-center gap-1 group-data-selected/hit:flex">
                          <Button
                            size="xs" variant="ghost" nativeButton={false} title="Share on WhatsApp"
                            onClick={(e) => e.stopPropagation()}
                            render={<a href={waLink(h.offer ?? '')} target="_blank" rel="noreferrer" />}
                          >
                            WhatsApp
                          </Button>
                          <Button
                            size="xs" variant="outline" title="Sell (⌘↵)"
                            onClick={(e) => { e.stopPropagation(); go(h.sellHref!); }}
                          >
                            Sell
                          </Button>
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
