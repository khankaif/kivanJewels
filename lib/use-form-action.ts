import { useActionState } from 'react';
import { toast } from 'sonner';

type Result = { error: string } | { ok: string } | null;

/**
 * useActionState plus what to do once the action succeeds: close the sheet,
 * clear the form. Success is confirmed with a toast, since the sheet that would
 * have shown it has just closed; errors stay inline, next to what caused them.
 */
export function useFormAction<S extends Result>(
  action: (prev: S, fd: FormData) => Promise<S>,
  onOk: (fd: FormData) => void,
) {
  return useActionState<S, FormData>(async (prev, fd) => {
    const res = await action(prev, fd);
    if (res && 'ok' in res) {
      toast.success(res.ok);
      onOk(fd);
    }
    return res;
  }, null as Awaited<S>);
}
