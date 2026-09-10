'use client';

import { useEffect, useState } from 'react';

/**
 * Remembers the last value typed into a field, per browser.
 *
 * Convenience only -- nothing here is authoritative, and a cleared or blocked
 * store just means an empty field. Read happens in an effect, never during
 * render, or the server and client markup disagree on first paint.
 */
export function useLastUsed(key: string, fallback = ''): [string, (v: string) => void] {
  const [value, setValue] = useState(fallback);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored) setValue(stored);
    } catch { /* private mode, blocked storage: keep the fallback */ }
  }, [key]);

  return [value, (v: string) => {
    setValue(v);
    try { window.localStorage.setItem(key, v); } catch { /* ignore */ }
  }];
}
