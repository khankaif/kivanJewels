'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Who placed the order: free text, because a new agent is just a new name,
 * with the people already on the book one tap away underneath.
 */
export function AgentField({ id, name = 'agent', agents, placeholder = 'Who placed it' }: {
  id: string; name?: string; agents: string[]; placeholder?: string;
}) {
  const [value, setValue] = useState('');
  const shown = agents.filter((a) => a !== value).slice(0, 6);
  return (
    <div className="space-y-1.5">
      <Input id={id} name={name} value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} />
      {shown.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {shown.map((a) => (
            <Button key={a} type="button" size="xs" variant="secondary" onClick={() => setValue(a)}>{a}</Button>
          ))}
        </div>
      )}
    </div>
  );
}
